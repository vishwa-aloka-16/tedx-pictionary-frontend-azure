import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

function source(name) {
  return readFileSync(new URL(`../src/hooks/${name}.js`, import.meta.url), "utf8")
    .replace(/import\s*\{[\s\S]*?\}\s*from\s*"[^"]+";/g, "")
    .replace(/import .*? from "[^"]+";/g, "")
    .replace("export default function", "function");
}

function browser(extra = {}) {
  let next = 0;
  const timers = new Map(), intervals = new Map(), windowEvents = new Map(), documentEvents = new Map();
  const states = [], effects = [];
  const context = vm.createContext({
    AbortController,
    useRef: (current) => ({ current }),
    useState: (initial) => {
      const index = states.length;
      states.push(typeof initial === "function" ? initial() : initial);
      return [states[index], (value) => { states[index] = typeof value === "function" ? value(states[index]) : value; }];
    },
    useCallback: (fn) => fn,
    useEffect: (fn) => effects.push(fn),
    document: { visibilityState: "visible", addEventListener: (name, fn) => documentEvents.set(name, fn), removeEventListener: (name) => documentEvents.delete(name) },
    window: {
      setTimeout: (fn, delay) => { timers.set(++next, { fn, delay }); return next; },
      clearTimeout: (id) => timers.delete(id),
      setInterval: (fn, delay) => { intervals.set(++next, { fn, delay }); return next; },
      clearInterval: (id) => intervals.delete(id),
      addEventListener: (name, fn) => windowEvents.set(name, fn),
      removeEventListener: (name) => windowEvents.delete(name),
    }, ...extra,
  });
  return { context, states, timers, intervals, effects, documentEvents, windowEvents,
    mount() { const cleanup = effects.map((fn) => fn()).filter(Boolean); return () => cleanup.forEach((fn) => fn()); },
    async flush() { await new Promise((resolve) => setImmediate(resolve)); },
  };
}

function gameBrowser(session = { gameId: "g", playerId: "p" }, fetchGame) {
  const sockets = [];
  let loads = 0, expired = 0;
  class Socket {
    static OPEN = 1;
    static CONNECTING = 0;
    constructor(url) { this.url = url; this.readyState = 0; this.sent = []; sockets.push(this); }
    open() { this.readyState = 1; this.onopen?.(); }
    send(text) { this.sent.push(text); }
    close(code = 1000) { this.readyState = 3; this.onclose?.({ code }); }
  }
  const h = browser({ session, WebSocket: Socket, WS_URL: "wss://game.test", notifyBackendReady() {},
    newerGame: (_old, incoming) => incoming,
    getGame: async () => { loads++; return fetchGame ? fetchGame(loads) : { id: "g", phase: "PAUSED", snapshot_seq: loads }; },
    onExpired: () => { expired++; },
  });
  vm.runInContext(`${source("useGameConnection")}\nglobalThis.hook = useGameConnection(session, onExpired);`, h.context);
  h.unmount = h.mount();
  return { ...h, sockets, loads: () => loads, expired: () => expired,
    visibility(value) { h.context.document.visibilityState = value; h.documentEvents.get("visibilitychange")(); },
  };
}

test("screen lock notifies backend and unlock immediately reconnects and fetches game state", async () => {
  const h = gameBrowser();
  h.sockets[0].open(); await h.flush();
  assert.equal(h.loads(), 1);
  assert.equal([...h.intervals.values()][0].delay, 3000);
  h.visibility("hidden");
  assert.deepEqual(h.sockets[0].sent, ["away"]);
  assert.equal(h.intervals.size, 0);
  assert.equal(h.timers.size, 0);
  h.visibility("visible");
  assert.equal(h.sockets.length, 2);
  h.sockets[1].open(); await h.flush();
  assert.equal(h.loads(), 2);
  assert.equal(h.states[0].phase, "PAUSED");
  h.unmount();
  assert.equal(h.documentEvents.size + h.windowEvents.size, 0);
});

test("old socket close cannot expire or reconnect over a newer connection", () => {
  const h = gameBrowser();
  h.sockets[0].open();
  h.visibility("hidden"); h.visibility("visible");
  h.sockets[1].open();
  h.sockets[0].onclose({ code: 4403 });
  assert.equal(h.expired(), 0);
  assert.equal(h.timers.size, 0);
  h.sockets[1].close(4403);
  assert.equal(h.expired(), 1);
  h.unmount();
});

test("network disconnect retries while visible but does not reconnect a hidden page", () => {
  const h = gameBrowser();
  h.sockets[0].open(); h.sockets[0].close(1001);
  assert.equal([...h.timers.values()][0].delay, 1500);
  h.visibility("hidden");
  assert.equal(h.timers.size, 0);
  h.visibility("visible");
  assert.equal(h.sockets.length, 2);
  h.unmount();
});

test("queued session does not create an invalid game connection", () => {
  const h = gameBrowser({ queueId: "ticket" });
  assert.equal(h.sockets.length, 0);
  assert.equal(h.loads(), 0);
  assert.equal(h.states[2], "");
  h.unmount();
});

for (const status of [403, 404]) {
  test(`expired seat is detected even when the WebSocket never opens (HTTP ${status})`, async () => {
    const h = gameBrowser(undefined, async () => { throw Object.assign(new Error("Session expired"), { status }); });
    h.sockets[0].close(1006);
    await h.flush();
    assert.equal(h.expired(), 1);
    assert.equal(h.states[0], null);
    assert.equal(h.states[1], "disconnected");
    assert.equal(h.timers.size, 0);
    assert.equal(h.intervals.size, 0);
    h.visibility("hidden"); h.visibility("visible");
    assert.equal(h.sockets.length, 1);
    h.unmount();
  });
}

test("returning after the seat expires clears the previously displayed game", async () => {
  const h = gameBrowser(undefined, async (request) => {
    if (request > 1) throw Object.assign(new Error("Player not in game"), { status: 403 });
    return { id: "g", phase: "DRAWING", snapshot_seq: 1 };
  });
  h.sockets[0].open(); await h.flush();
  assert.equal(h.states[0].phase, "DRAWING");
  h.visibility("hidden"); h.visibility("visible");
  h.sockets[1].close(1006); await h.flush();
  assert.equal(h.expired(), 1);
  assert.equal(h.states[0], null);
  assert.equal(h.timers.size, 0);
  h.unmount();
});

test("temporary backend failure keeps the session and allows reconnection", async () => {
  const h = gameBrowser(undefined, async (request) => {
    if (request === 1) throw Object.assign(new Error("Service unavailable"), { status: 503 });
    return { id: "g", phase: "PAUSED", snapshot_seq: 2 };
  });
  h.sockets[0].close(1006); await h.flush();
  assert.equal(h.expired(), 0);
  const [key, timer] = [...h.timers.entries()][0];
  h.timers.delete(key); timer.fn();
  h.sockets[1].open(); await h.flush();
  assert.equal(h.states[0].phase, "PAUSED");
  assert.equal(h.states[1], "connected");
  assert.equal(h.expired(), 0);
  h.unmount();
});

test("an expired response arriving after leaving the screen is ignored", async () => {
  let reject;
  const h = gameBrowser(undefined, () => new Promise((_resolve, fail) => { reject = fail; }));
  h.unmount();
  reject(Object.assign(new Error("Expired"), { status: 403 }));
  await h.flush();
  assert.equal(h.expired(), 0);
  assert.equal(h.timers.size, 0);
});

test("queue polls its position and hands off the server-assigned seat", async () => {
  let matched, requests = 0;
  const h = browser({
    getQueueStatus: async () => ++requests === 1 ? { queued: true, position: 2 } : { queued: false, player_id: "p", game: { id: "g" } },
    onMatched: (result) => { matched = result; }, onExpired() {},
  });
  vm.runInContext(`${source("useMatchmakingQueue")}\nuseMatchmakingQueue("ticket", onMatched, onExpired);`, h.context);
  const unmount = h.mount(); await h.flush();
  assert.equal(h.states[0], 2);
  const [key, timer] = [...h.timers.entries()].find(([, value]) => value.delay === 2000);
  h.timers.delete(key); timer.fn(); await h.flush();
  assert.equal(matched.player_id, "p");
  assert.equal(matched.game.id, "g");
  assert.equal(h.timers.size, 0);
  unmount();
});

test("leaving a queue ignores an outstanding promotion response", async () => {
  let resolve, matched = 0;
  const h = browser({ getQueueStatus: () => new Promise((done) => { resolve = done; }), onMatched: () => matched++, onExpired() {} });
  vm.runInContext(`${source("useMatchmakingQueue")}\nuseMatchmakingQueue("ticket", onMatched, onExpired);`, h.context);
  const unmount = h.mount(); unmount();
  resolve({ queued: false, player_id: "p", game: { id: "g" } }); await h.flush();
  assert.equal(matched, 0);
  assert.equal(h.timers.size, 0);
});
