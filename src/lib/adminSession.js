const KEY = "ai-pictionary-admin-token";
let memoryToken = null;

export function getAdminToken() {
  try { return window.sessionStorage.getItem(KEY) || memoryToken; } catch { return memoryToken; }
}

export function saveAdminToken(token) {
  memoryToken = token;
  try { window.sessionStorage.setItem(KEY, token); } catch { /* Login still works in memory. */ }
}

export function clearAdminToken() {
  memoryToken = null;
  try { window.sessionStorage.removeItem(KEY); } catch { /* Storage may be disabled. */ }
}
