import { observeServerClock } from "./serverClock";
import { notifyBackendReady } from "./backendReadiness";
import { getClientId } from "./session";
import { getAdminToken } from "./adminSession";

export const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://127.0.0.1:8000";

export const WS_URL = API_URL.replace(
  /^http/,
  "ws",
);

async function apiRequest(path, options = {}) {
  const started = Date.now();
  // AbortSignal.timeout is unavailable in some mobile browsers.
  const controller = options.signal ? null : new AbortController();
  const timeout = controller ? window.setTimeout(() => controller.abort(), 15000) : null;
  try {
  const response = await fetch(
    `${API_URL}${path}`,
    {
      ...options,
      signal: options.signal ?? controller.signal,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {}),
      },
    },
  );

  const data = await response
    .json()
    .catch(() => ({}));

  if (!response.ok) {
    const error = new Error(
      data.detail || "Something went wrong.",
    );
    error.status = response.status;
    throw error;
  }

  const state = data.game ?? data;
  observeServerClock(state.server_time, started, Date.now());
  notifyBackendReady();

  return data;
  } finally {
    if (timeout !== null) window.clearTimeout(timeout);
  }
}

function adminRequest(path, options = {}) {
  const token = getAdminToken();
  return apiRequest(path, { ...options, headers: { ...options.headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
}

export function loginAdmin(password) {
  return apiRequest("/admin/login", { method: "POST", body: JSON.stringify({ password }) });
}

export function logoutAdmin() {
  return adminRequest("/admin/logout", { method: "POST" });
}

export function getAdminSettings() {
  return adminRequest("/admin");
}

export function getArtwork(artworkId, signal) {
  return apiRequest(`/artworks/${encodeURIComponent(artworkId)}`, { signal });
}

export function updateAdminSettings(settings) {
  return adminRequest("/admin", {
    method: "PUT",
    body: JSON.stringify(settings),
  });
}

export function joinMatchmaking(name) {
  return apiRequest("/matchmaking/join", {
    method: "POST",
    body: JSON.stringify({ name, client_id: getClientId() }),
  });
}

export function getGame(gameId, playerId) {
  return apiRequest(
    `/games/${gameId}?player_id=${encodeURIComponent(
      playerId,
    )}`,
  );
}

export function markPlayerReady(
  gameId,
  playerId,
) {
  return apiRequest(`/games/${gameId}/ready`, {
    method: "POST",
    body: JSON.stringify({
      player_id: playerId,
    }),
  });
}

export function submitDrawing(
  gameId,
  playerId,
  imageDataUrl,
) {
  return apiRequest(`/games/${gameId}/predict`, {
    method: "POST",
    body: JSON.stringify({
      player_id: playerId,
      image_data_url: imageDataUrl,
    }),
  });
}

export function restartGame(
  gameId,
  playerId,
) {
  return apiRequest(`/games/${gameId}/restart`, {
    method: "POST",
    body: JSON.stringify({
      player_id: playerId,
    }),
  });
}

export function leaveGame(gameId, playerId) {
  return apiRequest(`/games/${gameId}/leave`, {
    method: "POST",
    keepalive: true,
    body: JSON.stringify({
      player_id: playerId,
    }),
  });
}

export function getLeaderboard() {
  return apiRequest("/leaderbord");
}

export function resetDashboard() {
  return adminRequest("/admin/reset-dashboard", {
    method: "POST",
  });
}

export function submitRoundDrawing(gameId, playerId, eventId, imageDataUrl) {
  return apiRequest(`/games/${gameId}/round-drawing`, {
    method: "POST",
    body: JSON.stringify({ player_id: playerId, event_id: eventId, image_data_url: imageDataUrl }),
  });
}

export function checkBackend(signal) {
  return apiRequest("/health", { signal, cache: "no-store" });
}
