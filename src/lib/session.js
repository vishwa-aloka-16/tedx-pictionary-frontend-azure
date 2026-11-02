const SESSION_KEY =
  "ai-pictionary-player-session";

export function getStoredSession() {
  try {
    const value =
      sessionStorage.getItem(SESSION_KEY);

    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

export function saveSession(session) {
  sessionStorage.setItem(
    SESSION_KEY,
    JSON.stringify(session),
  );
}

export function removeSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

export function formatPrompt(prompt = "") {
  return prompt
    .split(" ")
    .map(
      (word) =>
        word.charAt(0).toUpperCase() +
        word.slice(1),
    )
    .join(" ");
}

export function getClientId() {
  const key = "ai-pictionary-client-id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = Array.from(crypto.getRandomValues(new Uint8Array(24)), (byte) => byte.toString(16).padStart(2, "0")).join("");
    localStorage.setItem(key, id);
  }
  return id;
}
