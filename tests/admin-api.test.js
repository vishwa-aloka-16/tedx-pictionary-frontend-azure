import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

function harness() {
  const requests = [];
  const source = readFileSync(new URL("../src/lib/gameApi.js", import.meta.url), "utf8")
    .replace(/import\s*\{[\s\S]*?\}\s*from\s*"[^"]+";/g, "")
    .replaceAll("import.meta.env", "env")
    .replace(/export (function|const)/g, "$1");
  const context = vm.createContext({
    env: { VITE_API_URL: "https://game.example.com" },
    getAdminToken: () => "opaque-admin-token",
    observeServerClock() {}, notifyBackendReady() {}, getClientId: () => "client-id",
    AbortController, Date,
    window: { setTimeout: () => 1, clearTimeout() {} },
    fetch: async (url, options) => {
      requests.push({ url, options });
      return { ok: true, json: async () => ({ status: "ok" }) };
    },
  });
  vm.runInContext(`${source}\nglobalThis.api = {loginAdmin, logoutAdmin, getAdminSettings, updateAdminSettings, resetDashboard, getLeaderboard};`, context);
  return { api: context.api, requests };
}

test("Admin settings, reset and logout requests send the bearer token", async () => {
  const { api, requests } = harness();
  await api.getAdminSettings();
  await api.updateAdminSettings({ round_seconds: 40 });
  await api.resetDashboard();
  await api.logoutAdmin();
  for (const { options } of requests) assert.equal(options.headers.Authorization, "Bearer opaque-admin-token");
});

test("password is sent only in the login body and public requests do not include the Admin token", async () => {
  const { api, requests } = harness();
  await api.loginAdmin("test-password");
  assert.equal(requests[0].url, "https://game.example.com/admin/login");
  assert.equal(requests[0].options.headers.Authorization, undefined);
  assert.deepEqual(JSON.parse(requests[0].options.body), { password: "test-password" });
  await api.getLeaderboard();
  assert.equal(requests[1].options.headers.Authorization, undefined);
  assert.doesNotMatch(requests[1].url, /test-password|opaque-admin-token/);
});
