import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("../src/hooks/useDrawingCanvas.js", import.meta.url), "utf8")
  .replace(/import\s*\{[\s\S]*?\}\s*from\s*"[^"]+";/g, "")
  .replace("export default function", "function");

function canvasBrowser(respond = async () => ({ accepted: false })) {
  const refs = [], states = [], callbacks = [], effects = [], timers = new Map();
  let refIndex, stateIndex, callbackIndex, effectIndex, id = 0, clears = 0, strokes = 0, calls = 0;
  let pendingEffects = [];
  const changed = (old, next) => !old || next.some((value, index) => !Object.is(value, old[index]));
  const canvas = {
    width: 700, height: 560,
    getContext: () => ({ fillRect() { clears++; }, beginPath() {}, moveTo() {}, lineTo() {}, stroke() { strokes++; } }),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 700, height: 560 }),
    setPointerCapture() {}, hasPointerCapture: () => false,
    toDataURL: () => `data:image/png;base64,drawing-${strokes}`,
  };
  const context = vm.createContext({
    useRef: (initial) => refs[refIndex++] ?? (refs[refIndex - 1] = { current: initial }),
    useState: (initial) => {
      const key = stateIndex++;
      if (!(key in states)) states[key] = initial;
      return [states[key], (value) => { states[key] = value; }];
    },
    useCallback: (fn, deps) => {
      const key = callbackIndex++;
      if (changed(callbacks[key]?.deps, deps)) callbacks[key] = { fn, deps };
      return callbacks[key].fn;
    },
    useEffect: (fn, deps) => {
      const key = effectIndex++;
      if (changed(effects[key]?.deps, deps)) pendingEffects.push(() => {
        effects[key]?.cleanup?.(); effects[key] = { deps, cleanup: fn() };
      });
    },
    serverNow: () => 100,
    submitDrawing: async () => { calls++; return respond(); }, submitRoundDrawing: async () => {},
    window: {
      setTimeout: (fn, delay) => { timers.set(++id, { fn, delay }); return id; },
      clearTimeout: (key) => timers.delete(key), requestAnimationFrame: (fn) => fn(),
    },
  });
  vm.runInContext(source, context);
  let hook;
  const props = { gameId: "game", playerId: "player", roundNumber: 1, phase: "DRAWING" };
  function render(change = {}) {
    Object.assign(props, change); context.props = props;
    refIndex = stateIndex = callbackIndex = effectIndex = 0;
    pendingEffects = [];
    vm.runInContext("globalThis.hook = useDrawingCanvas(props);", context);
    hook = context.hook; hook.canvasRef.current = canvas;
    pendingEffects.forEach((effect) => effect());
  }
  render();
  return { render, timers, calls: () => calls, clears: () => clears, strokes: () => strokes,
    draw() {
      hook.startDrawing({ isPrimary: true, button: 0, pointerId: 1, clientX: 10, clientY: 10, preventDefault() {} });
      hook.stopDrawing({ pointerId: 1 });
    },
    async tick() {
      const [key, timer] = timers.entries().next().value;
      timers.delete(key); timer.fn();
      await new Promise((resolve) => setImmediate(resolve));
    },
    async flush() { await new Promise((resolve) => setImmediate(resolve)); },
    unmount() { effects.forEach((effect) => effect.cleanup?.()); },
  };
}

test("pause and resume countdown preserve ink and block drawing and inference until resumed", async () => {
  const h = canvasBrowser();
  h.draw();
  assert.equal(h.strokes(), 1);
  const initialClears = h.clears();
  h.render({ phase: "PAUSED" }); h.draw();
  assert.equal(h.strokes(), 1);
  assert.equal(h.timers.size, 0);
  h.render({ phase: "RESUMING" }); h.draw();
  assert.equal(h.strokes(), 1);
  assert.equal(h.clears(), initialClears);
  h.render({ phase: "DRAWING" });
  await h.tick();
  assert.equal(h.calls(), 1);
  assert.equal(h.clears(), initialClears);
  h.render({ roundNumber: 2 });
  assert.equal(h.clears(), initialClears + 1);
  h.unmount();
});

test("an inference response from before pause is discarded and fresh recognition restarts", async () => {
  let resolve;
  const h = canvasBrowser(() => new Promise((done) => { resolve = done; }));
  h.draw(); await h.tick();
  h.render({ phase: "PAUSED" }); h.render({ phase: "RESUMING" }); h.render({ phase: "DRAWING" });
  await h.tick(); // Old request still running: no overlapping inference.
  assert.equal(h.calls(), 1);
  resolve({ accepted: true }); await h.flush();
  assert.equal(h.timers.size, 1); // Discard stale acceptance and request a fresh guess.
  await h.tick();
  assert.equal(h.calls(), 2);
  h.unmount();
});
