import { useCallback, useEffect, useRef, useState } from "react";
import { getGame, WS_URL } from "../lib/gameApi";
import { newerGame } from "../lib/serverClock";
import { notifyBackendReady } from "../lib/backendReadiness";

export default function useGameConnection(session, onSessionExpired) {
  const socketRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const heartbeatRef = useRef(null);

  const [game, updateGame] = useState(null);
  const setGame = useCallback((state) => updateGame((current) => newerGame(current, state)), []);
  const [connection, setConnection] =
    useState("disconnected");

  const [connectionError, setConnectionError] =
    useState("");

  useEffect(() => {
    // Do not call the backend with an incomplete session.
    if (!session?.gameId || !session?.playerId) {
      setGame(null);
      setConnection("disconnected");

      if (session && !session.queueId) {
        setConnectionError(
          "Invalid saved game session. Please return to the welcome screen.",
        );
      }

      return undefined;
    }

    let active = true;
    let validationInFlight = false;

    function expireGameSession() {
      if (!active) return;
      active = false;
      clearTimers();
      const socket = socketRef.current;
      socketRef.current = null;
      socket?.close();
      setGame(null);
      setConnection("disconnected");
      setConnectionError("");
      onSessionExpired?.();
    }

    async function loadInitialState() {
      if (!active || validationInFlight) return;
      validationInFlight = true;
      try {
        const state = await getGame(
          session.gameId,
          session.playerId,
        );

        if (active) {
          setGame(state);
          setConnectionError("");
        }
      } catch (error) {
        if (active) {
          if (error.status === 403 || error.status === 404) {
            expireGameSession();
            return;
          }
          setConnectionError(
            error.message || "Could not load the game.",
          );
        }
      } finally {
        validationInFlight = false;
      }
    }

    function clearTimers() {
      window.clearTimeout(reconnectTimerRef.current);
      window.clearInterval(heartbeatRef.current);
    }

    function connectWebSocket(force = false) {
      if (!active || document.visibilityState === "hidden") return;
      const previous = socketRef.current;
      if (!force && previous && [WebSocket.OPEN, WebSocket.CONNECTING].includes(previous.readyState)) return;
      clearTimers();
      socketRef.current = null;
      previous?.close();
      setConnection("connecting");
      const socket = new WebSocket(`${WS_URL}/ws/games/${encodeURIComponent(session.gameId)}?player_id=${encodeURIComponent(session.playerId)}`);
      socketRef.current = socket;
      // A rejected WebSocket handshake can appear as code 1006, without an
      // onopen event. Validate membership independently so expired seats cannot
      // leave the old drawing screen reconnecting forever.
      loadInitialState();
      const current = () => active && socketRef.current === socket;
      socket.onopen = () => {
        if (!current()) return;
        setConnection("connected");
        setConnectionError("");
        loadInitialState();
        heartbeatRef.current = window.setInterval(() => {
          if (current() && socket.readyState === WebSocket.OPEN) socket.send("ping");
        }, 3000);
      };
      socket.onmessage = (event) => {
        if (!current()) return;
        try {
          const message = JSON.parse(event.data);
          if (message.type === "game_state") {
            notifyBackendReady();
            setGame(message.game);
          }
        } catch { /* Ignore malformed messages. */ }
      };
      socket.onerror = () => { if (current()) setConnection("disconnected"); };
      socket.onclose = (event) => {
        if (!current()) return;
        clearTimers();
        socketRef.current = null;
        if (event.code === 4403) {
          expireGameSession();
          return;
        }
        loadInitialState();
        setConnection("connecting");
        if (document.visibilityState !== "hidden") {
          reconnectTimerRef.current = window.setTimeout(() => connectWebSocket(), 1500);
        }
      };
    }

    function visibilityChanged() {
      if (!active) return;
      if (document.visibilityState === "hidden") {
        clearTimers();
        const socket = socketRef.current;
        socketRef.current = null;
        try {
          if (socket?.readyState === WebSocket.OPEN) socket.send("away");
        } catch { /* The network may already be unavailable. */ }
        socket?.close();
        setConnection("connecting");
      } else {
        connectWebSocket(true);
      }
    }
    function resume() { if (document.visibilityState !== "hidden") connectWebSocket(true); }
    document.addEventListener("visibilitychange", visibilityChanged);
    window.addEventListener("online", resume);
    window.addEventListener("pageshow", resume);
    connectWebSocket();

    return () => {
      active = false;
      document.removeEventListener("visibilitychange", visibilityChanged);
      window.removeEventListener("online", resume);
      window.removeEventListener("pageshow", resume);

      window.clearTimeout(
        reconnectTimerRef.current,
      );

      window.clearInterval(
        heartbeatRef.current,
      );

      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, [session, setGame, onSessionExpired]);

  return {
    game,
    setGame,
    connection,
    connectionError,
  };
}
