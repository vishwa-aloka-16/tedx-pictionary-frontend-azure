import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

function harness(storage) {
  const source = readFileSync(new URL("../src/lib/adminSession.js", import.meta.url), "utf8").replaceAll("export function", "function");
  const context = vm.createContext({ window: { sessionStorage: storage } });
  vm.runInContext(`${source}\nglobalThis.api = {getAdminToken, saveAdminToken, clearAdminToken};`, context);
  return context.api;
}

test("Admin stores only the token in tab session storage and clears it on logout", () => {
  const values = new Map();
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
  const api = harness(storage);
  assert.equal(api.getAdminToken(), null);
  api.saveAdminToken("opaque-session-token");
  assert.equal(harness(storage).getAdminToken(), "opaque-session-token");
  assert.deepEqual([...values.values()], ["opaque-session-token"]);
  api.clearAdminToken();
  assert.equal(api.getAdminToken(), null);
  assert.equal(values.size, 0);
});

test("Admin can sign in and out in memory when browser storage is disabled", () => {
  const blocked = () => { throw new Error("storage blocked"); };
  const api = harness({ getItem: blocked, setItem: blocked, removeItem: blocked });
  api.saveAdminToken("opaque-session-token");
  assert.equal(api.getAdminToken(), "opaque-session-token");
  api.clearAdminToken();
  assert.equal(api.getAdminToken(), null);
});
