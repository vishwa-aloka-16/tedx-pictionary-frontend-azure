import { useCallback, useState } from "react";
import { MotionConfig } from "motion/react";
import PageTransition from "./components/PageTransition";
import BrandLogos from "./components/BrandLogos";
import BackendGate from "./components/BackendGate";

import useGameConnection from "./hooks/useGameConnection";
import useMatchmakingQueue from "./hooks/useMatchmakingQueue";
import QueueScreen from "./screens/QueueScreen";

import {
  joinMatchmaking,
  leaveGame,
  markPlayerReady,
  restartGame,
  leaveQueue,
} from "./lib/gameApi";

import {
  getStoredSession,
  removeSession,
  saveSession,
} from "./lib/session";

import WelcomeScreen from "./screens/WelcomeScreen";
import NameScreen from "./screens/NameScreen";
import WaitingScreen from "./screens/WaitingScreen";
import GameScreen from "./screens/GameScreen";
import AdminScreen from "./screens/AdminScreen";
import LeaderboardScreen from "./screens/LeaderboardScreen";
import ArtworkScreen from "./screens/ArtworkScreen";

export default function App() {
  return <MotionConfig reducedMotion="user" transition={{ type: "spring", stiffness: 280, damping: 28 }}>
    <BackendGate><AppRoutes /></BackendGate>
  </MotionConfig>;
}

function AppRoutes() {
  const artworkPath = window.location.pathname.match(/^\/artwork\/([A-Za-z0-9_-]+)\/?$/);
  if (artworkPath) return <PageTransition screenKey="artwork"><ArtworkScreen artworkId={artworkPath[1]} /></PageTransition>;
  if (window.location.pathname === "/admin") {
    return <PageTransition screenKey="admin"><AdminScreen /></PageTransition>;
  }

  if (["/leaderbord", "/leaderborad", "/leaderboard"].includes(window.location.pathname)) {
    return <PageTransition screenKey="leaderboard"><LeaderboardScreen /></PageTransition>;
  }

  return <GameApp />;
}

function GameApp() {
  const initialSession = getStoredSession();

  const [session, setSession] =
    useState(initialSession);

  const [page, setPage] = useState(
    initialSession ? "GAME" : "WELCOME",
  );

  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] =
    useState("");
  const expireSession = useCallback(() => {
    removeSession();
    setSession(null);
    setPage("WELCOME");
    setActionError("");
  }, []);
  const {
    game,
    setGame,
    connection,
    connectionError,
  } = useGameConnection(session, expireSession);
  const acceptMatch = useCallback((result) => {
    const nextSession = { gameId: result.game.id, playerId: result.player_id };
    saveSession(nextSession);
    setGame(result.game);
    setSession(nextSession);
    setPage("GAME");
  }, [setGame]);
  const queue = useMatchmakingQueue(session?.queueId, acceptMatch, expireSession);

  function showNameScreen() {
    setActionError("");
    setPage("NAME");
  }

  function showWelcomeScreen() {
    setActionError("");
    setPage("WELCOME");
  }

  async function handleJoin(name) {
    setBusy(true);
    setActionError("");

    try {
      const result =
        await joinMatchmaking(name);

      if (result.queued) {
        const nextSession = { queueId: result.queue_id };
        saveSession(nextSession);
        setSession(nextSession);
        setPage("QUEUE");
      } else {
        acceptMatch(result);
      }
    } catch (error) {
      setActionError(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleReady() {
    if (!session) return;

    setBusy(true);
    setActionError("");

    try {
      const updatedGame =
        await markPlayerReady(
          session.gameId,
          session.playerId,
        );

      setGame(updatedGame);
    } catch (error) {
      setActionError(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleRestart() {
    if (!session) return;

    setBusy(true);
    setActionError("");

    try {
      const updatedGame =
        await restartGame(
          session.gameId,
          session.playerId,
        );

      setGame(updatedGame);
    } catch (error) {
      setActionError(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleExit() {
    setBusy(true);
    const leavingSession = session;
    expireSession();
    setGame(null);
    if (leavingSession) {
      try {
        if (leavingSession.queueId) await leaveQueue(leavingSession.queueId);
        else await leaveGame(
          leavingSession.gameId,
          leavingSession.playerId,
        );
      } catch {
        // Clear the browser session even
        // if the backend is unavailable.
      } finally {
        setBusy(false);
      }
    } else {
      setBusy(false);
    }

  }

  function renderScreen() {
  if (session?.queueId) return <QueueScreen position={queue.position} error={queue.error} onExit={handleExit} />;
  if (!session && page === "WELCOME") {
    return (
      <WelcomeScreen
        onStart={showNameScreen}
      />
    );
  }

  if (!session && page === "NAME") {
    return (
      <NameScreen
        onJoin={handleJoin}
        onBack={showWelcomeScreen}
        busy={busy}
        error={actionError}
      />
    );
  }

  if (
    session &&
    !game &&
    connectionError
  ) {
    return (
      <main className="error-page">
        <section className="connection-error-card">
          <BrandLogos compact />

          <h1>Unable to reconnect</h1>

          <p>{connectionError}</p>

          <button
            className="primary-button"
            onClick={handleExit}
          >
            Return to welcome screen
          </button>
        </section>
      </main>
    );
  }

  if (session && !game) {
    return (
      <main className="loading-page">
        <BrandLogos />

        <p>Joining the game...</p>
      </main>
    );
  }

  if (
    game?.phase === "WAITING" ||
    game?.phase === "LOBBY"
  ) {
    return (
      <WaitingScreen
        game={game}
        playerId={session.playerId}
        connection={connection}
        busy={busy}
        error={actionError}
        onReady={handleReady}
        onExit={handleExit}
      />
    );
  }

  return (
    <GameScreen
      game={game}
      playerId={session.playerId}
      connection={connection}
      onRestart={handleRestart}
      onExit={handleExit}
    />
  );
  }
  const screenKey = session?.queueId ? "queue" : !session ? page : !game ? "connecting"
    : ["WAITING", "LOBBY"].includes(game.phase) ? `waiting-${game.id}` : `game-${game.id}`;
  return <PageTransition screenKey={screenKey}>{renderScreen()}</PageTransition>;
}
