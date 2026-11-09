import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("../src/hooks/useEntryReadiness.js", import.meta.url), "utf8")
  .replace(/import .*? from "[^"]+";/g, "").replace("export default function", "function");
function harness(prepare, active = true) {
  const states = [], effects = [], timers = new Map(); let id = 0, clock = 0, requests = 0;
  const context = vm.createContext({ active, AbortController, Date: { now: () => clock },
    useState: (initial) => {
      const index = states.length; states.push(initial);
      return [initial, (value) => { states[index] = typeof value === 'function' ? value(states[index]) : value; }];
    },
    useEffect: (fn) => effects.push(fn),
    prepareMatchmaking: (signal) => { requests++; return prepare(signal); },
    window: {
      setTimeout: (fn, delay) => { timers.set(++id, { fn, delay }); return id; },
      clearTimeout: (key) => timers.delete(key),
    },
  });
  vm.runInContext(`${source}\nuseEntryReadiness(active);`, context);
  const cleanups = effects.map((effect) => effect()).filter(Boolean);
  return { states, timers, requests: () => requests, setClock: (value) => { clock = value; },
    flush: () => new Promise((resolve) => setImmediate(resolve)), unmount: () => cleanups.forEach((fn) => fn()),
  };
}
test('opening player entry prepares services before allowing registration', async () => {
  let resolve;
  const h = harness(() => new Promise((done) => { resolve = done; }));
  await h.flush(); assert.equal(h.requests(), 1); assert.equal(h.states[0], false);
  resolve({ status: 'ok' }); await h.flush(); assert.equal(h.states[0], true);
  assert.equal(h.timers.size, 0); h.unmount();
});
test('leaving registration cancels readiness and ignores a late response', async () => {
  let resolve, signal;
  const h = harness((value) => { signal = value; return new Promise((done) => { resolve = done; }); });
  await h.flush(); h.unmount(); assert.equal(signal.aborted, true);
  resolve({ status: 'ok' }); await h.flush(); assert.equal(h.states[0], false);
});
test('sleeping-service failures retry and eventually offer a useful error', async () => {
  const h = harness(async () => { throw new Error('service sleeping'); });
  await h.flush();
  const [key, timer] = [...h.timers.entries()].find(([, t]) => t.delay === 2000);
  h.timers.delete(key); h.setClock(121000); timer.fn(); await h.flush();
  assert.equal(h.requests(), 2); assert.match(h.states[1], /not ready/i);
  assert.equal(h.timers.size, 0); h.unmount();
});
test('services are not prepared before player entry is opened', async () => {
  const h = harness(async () => ({ status: 'ok' }), false);
  await h.flush(); assert.equal(h.requests(), 0); h.unmount();
});
