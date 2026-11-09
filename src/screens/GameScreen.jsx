import { motion, AnimatePresence } from "motion/react";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import useDrawingCanvas from "../hooks/useDrawingCanvas";
import BrandLogos from "../components/BrandLogos";
import ArtworkShare from "../components/ArtworkShare";
import { serverNow } from "../lib/serverClock";

import {
  formatPrompt,
} from "../lib/session";

function ScoreCard({
  player,
  current,
}) {
  return (
    <article
      className={`score-card ${
        current
          ? "score-card--current"
          : ""
      }`}
    >
      <div className="score-avatar">
        {player?.emoji || player?.name
          ?.charAt(0)
          .toUpperCase() || "?"}
      </div>

      <div className="score-player">
        <span>
          {current ? "YOU" : "OPPONENT"}
        </span>

        <strong>
          {player?.name || "Waiting"}
        </strong>
      </div>

      <div className="score-points">
        <strong>
          {player?.score || 0}
        </strong>

        <span>PTS</span>
      </div>
    </article>
  );
}

function CountdownOverlay({
  game,
  now,
}) {
  if (!["COUNTDOWN", "RESUMING"].includes(game.phase)) {
    return null;
  }

  const seconds = Math.max(
    1,
    Math.ceil(
      (game.countdown_ends_at ||
        now + 3) - now,
    ),
  );

  return (
    <div className="game-overlay">
      <motion.section initial={{ opacity: 0, y: 16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="countdown-card">
        <span>
          {game.phase === "RESUMING" ? "RESUMING GAME" : `ROUND ${game.countdown_round ?? game.round_number + 1}`}
        </span>

        <AnimatePresence mode="popLayout"><motion.strong key={seconds} initial={{ opacity: 0, scale: 0.65 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.15 }}>{seconds}</motion.strong></AnimatePresence>

        <h2>{game.phase === "RESUMING" ? "Both players are back" : "Get ready to draw"}</h2>
      </motion.section>
    </div>
  );
}

function RoundPromptOverlay({ prompt }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(false), 1000);
    return () => window.clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div className="round-prompt-overlay" role="status">
      <strong>{formatPrompt(prompt)}</strong>
    </div>
  );
}

function RoundResultOverlay({
  game,
  playerId,
}) {
  if (
    game.phase !== "ROUND_RESULT"
  ) {
    return null;
  }

  const playerWon =
    game.round_winner_id === playerId;

  return (
    <div className="game-overlay">
      <motion.section initial={{ opacity: 0, y: 16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="result-card">
        <div className="result-icon">
          {game.round_winner_id
            ? "✦"
            : "⌛"}
        </div>

        <span>
          ROUND {game.round_number} COMPLETE
        </span>

        <h2>
          {playerWon
            ? "You won the round!"
            : game.round_winner_name
              ? `${game.round_winner_name} wins`
              : "Time's up"}
        </h2>

        <p>
          {game.round_winner_name
            ? `${formatPrompt(
                game.prompt,
              )} was recognized first.`
            : `The prompt was ${formatPrompt(
                game.prompt,
              )}.`}
        </p>

        {game.round_points > 0 && (
          <div className="points-earned">
            +{game.round_points} points
          </div>
        )}

        <small>
          {game.round_number ===
          game.max_rounds
            ? "Preparing final results..."
            : "Next round starting soon..."}
        </small>
      </motion.section>
    </div>
  );
}

function FinalResultOverlay({
  game,
  playerId,
  onRestart,
  onExit,
}) {
  const ranking = useMemo(() => {
    return [...game.players].sort(
      (first, second) =>
        second.score - first.score,
    );
  }, [game.players]);

  if (
    game.phase !== "FINAL_RESULT"
  ) {
    return null;
  }

  const winner = ranking[0];

  const tied =
    ranking.length === 2 &&
    ranking[0].score ===
      ranking[1].score;

  return (
    <div className="game-overlay final-overlay player-finish-overlay">
      <motion.section initial={{ opacity: 0, y: 16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="final-card player-finish-card">
        <header className="player-finish-heading">
          <span className="player-finish-medallion" aria-hidden="true">{tied ? "=" : winner?.id === playerId ? "\u265b" : "\u{1F614}"}</span>
          <span className="eyebrow">{tied ? "DRAW" : winner?.id === playerId ? "YOU WON" : "YOU LOST"}</span>
          <h1>{tied ? ranking.map((player) => player.name).join(" & ") : `${winner?.name} wins!`}</h1>
        </header>
        <div className="player-finish-stats">
          <div>
            <span>{tied ? "POINTS EACH" : "WINNING POINTS"}</span>
            <b>{(winner?.score ?? 0).toLocaleString()}</b>
          </div>
          <div>
            <span>YOUR POINTS</span>
            <b>{(game.players.find((player) => player.id === playerId)?.score ?? 0).toLocaleString()}</b>
          </div>
          <div>
            <span>YOUR GLOBAL POSITION</span>
            <b>{game.global_rankings?.[playerId]?.rank ? `#${game.global_rankings[playerId].rank}` : "\u2014"}</b>
          </div>
        </div>
        <ArtworkShare artworkId={game.artwork_id} qrOnly />
        <div className="final-actions">
          <button
            className="secondary-button"
            onClick={onExit}
          >
            Finish
          </button>

          <button
            className="primary-button compact-button"
            onClick={onRestart}
          >
            Play again
          </button>
        </div>
      </motion.section>
    </div>
  );
}

export default function GameScreen({
  game: receivedGame,
  playerId,
  connection,
  onRestart,
  onExit,
}) {
  const [now, setNow] = useState(
    serverNow,
  );

  useEffect(() => {
    const interval =
      window.setInterval(() => {
        setNow(serverNow());
      }, 100);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  // The prompt arrives ahead of time; reveal it on the shared server clock.
  const awaitingStart = receivedGame.phase === "DRAWING" && now < receivedGame.round_started_at;
  let game = awaitingStart ? {
    ...receivedGame,
    phase: "COUNTDOWN",
    prompt: "",
    countdown_ends_at: receivedGame.round_started_at,
    countdown_round: receivedGame.round_number,
  } : receivedGame;

  const [lastDrawingGame, setLastDrawingGame] = useState(receivedGame);
  if (receivedGame.phase === "DRAWING" && lastDrawingGame !== receivedGame) {
    setLastDrawingGame(receivedGame);
  }

  const {
    cosmeticDrawing,
    canvasRef,
    prediction,
    predictionError,
    clearDrawing,
    startDrawing,
    continueDrawing,
    stopDrawing,
  } = useDrawingCanvas({
    gameId: game.id,
    playerId,
    roundNumber: game.round_number,
    phase: game.phase,
    roundEventId: game.round_event_id,
    roundWinnerId: game.round_winner_id,
    cosmeticDrawSeconds: game.cosmetic_draw_seconds,
    cosmeticDrawEndsAt: game.cosmetic_draw_ends_at,
    predictionGapSeconds: game.judge?.prediction_gap_seconds ?? 0.2,
  });

  // Keep the ordinary drawing view during the cosmetic capture window.
  if (cosmeticDrawing && lastDrawingGame?.id === game.id && lastDrawingGame.round_number === game.round_number) {
    game = lastDrawingGame;
  }
  const currentPlayer = game.players.find((player) => player.id === playerId);
  const opponent = game.players.find((player) => player.id !== playerId);

  const roundSeconds =
    game.round_seconds || 40;

  const secondsLeft =
    ["PAUSED", "RESUMING"].includes(game.phase) && game.paused_remaining_seconds != null
      ? Math.ceil(game.paused_remaining_seconds) : game.round_deadline
      ? Math.max(
          0,
          Math.ceil(
            game.round_deadline - now,
          ),
        )
      : roundSeconds;

  const progress =
    (secondsLeft / roundSeconds) * 100;

  const currentGuess =
    prediction?.prediction ||
    currentPlayer?.last_guess;

  const confidence =
    (prediction?.confidence ??
      currentPlayer?.confidence ??
      0) * 100;

  const stableMatches =
    prediction?.consecutive_hits || 0;

  const requiredMatches =
    game.judge?.required_hits || 2;

  return (
    <main className="game-page">
      <header className="game-header">
        <BrandLogos compact />

        <div className="round-indicator">
          ROUND{" "}
          <strong>
            {game.round_number || 1}
          </strong>{" "}
          / {game.max_rounds || 6} · {game.difficulty}
        </div>

        <div
          className={`live-indicator live-indicator--${connection}`}
        >
          <span />

          {connection === "connected"
            ? "LIVE"
            : "RECONNECTING"}
        </div>
      </header>

      <section className="scoreboard">
        <ScoreCard
          player={currentPlayer}
          current
        />

        <ScoreCard
          player={opponent}
          current={false}
        />
      </section>

      <section className="challenge-bar">
        <div>
          <span>YOUR PROMPT</span>

          <strong>
            {game.prompt
              ? formatPrompt(game.prompt)
              : "Get ready"}
          </strong>
        </div>

        <div
          className={`round-timer ${
            secondsLeft <= 10
              ? "round-timer--urgent"
              : ""
          }`}
        >
          <span>TIME LEFT</span>

          <strong>
            {Math.floor(secondsLeft / 60)}:
            {String(secondsLeft % 60).padStart(
              2,
              "0",
            )}
          </strong>
        </div>

        <div className="timer-track">
          <span
            style={{
              width: `${progress}%`,
            }}
          />
        </div>
      </section>

      <section className="playing-area">
        <div className="canvas-card">
          <div className="panel-heading">
            <div>
              <span>DRAWING CANVAS</span>

              <strong>
                Make the AI understand
              </strong>
            </div>

            <button
              onClick={clearDrawing}
              disabled={
                game.phase !== "DRAWING"
              }
            >
              Clear
            </button>
          </div>

          <div className="canvas-container">
            <canvas
              ref={canvasRef}
              width="700"
              height="560"
              aria-label="Draw the current prompt here using your finger, stylus, or mouse"
              onPointerDown={startDrawing}
              onPointerMove={continueDrawing}
              onPointerUp={stopDrawing}
              onPointerCancel={stopDrawing}
              onLostPointerCapture={stopDrawing}
            />

            {!currentGuess &&
              game.phase === "DRAWING" && (
                <div className="canvas-placeholder">
                  <div>✦</div>

                  <strong>
                    Start drawing
                  </strong>

                  <span>
                    Finger, mouse and Apple
                    Pencil supported
                  </span>
                </div>
              )}
          </div>
        </div>

        <aside className="prediction-card">
          <div className="prediction-header">
            <div className="ai-icon">
              ✦
            </div>

            <div>
              <span>LIVE AI</span>
              <strong>Recognition</strong>
            </div>
          </div>

          <div className="guess-section">
            <span>
              I THINK IT IS...
            </span>

            <strong>
              {currentGuess
                ? formatPrompt(currentGuess)
                : "Watching..."}
            </strong>
          </div>

          <div className="confidence-section">
            <div>
              <span>Confidence</span>

              <strong>
                {currentGuess
                  ? `${confidence.toFixed(
                      0,
                    )}%`
                  : "—"}
              </strong>
            </div>

            <div className="confidence-track">
              <span
                style={{
                  width: `${confidence}%`,
                }}
              />
            </div>
          </div>

          <div className="judge-section">
            <div className="judge-heading">
              <span>Stable matches</span>

              <strong>
                {stableMatches} /{" "}
                {requiredMatches}
              </strong>
            </div>

            <div className="match-indicators">
              {Array.from({
                length: requiredMatches,
              }).map((_, index) => (
                <span
                  className={
                    index < stableMatches
                      ? "active"
                      : ""
                  }
                  key={index}
                />
              ))}
            </div>

            <p>
              {requiredMatches} consecutive correct {requiredMatches === 1 ? "guess" : "guesses"}
              {" at "}{Math.round((game.judge?.confidence_threshold ?? 0.3) * 100)}%
              {" confidence or higher. Late-round fallback may award a correct guess sooner."}
            </p>
          </div>

          {predictionError && (
            <div className="error-message">
              {predictionError}
            </div>
          )}
        </aside>
      </section>

      <CountdownOverlay
        game={game}
        now={now}
      />

      {game.phase === "PAUSED" && (
        <div className="game-overlay" role="status" aria-live="polite">
          <motion.section className="result-card" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}>
            <span className="eyebrow">GAME PAUSED</span>
            <h2>Opponent disconnected. Waiting for reconnection…</h2>
            <p>Your points and remaining time are saved.</p>
            <strong>{Math.max(0, Math.ceil((game.reconnect_deadline || now) - now))} seconds to reconnect</strong>
            <button className="secondary-button" onClick={onExit}>Leave game</button>
          </motion.section>
        </div>
      )}

      <RoundResultOverlay
        game={game}
        playerId={playerId}
      />

      {game.phase === "DRAWING" && game.prompt && (
        <RoundPromptOverlay
          key={`${game.id}-${game.round_number}-${game.round_started_at}`}
          prompt={game.prompt}
        />
      )}

      <FinalResultOverlay
        game={game}
        playerId={playerId}
        onRestart={onRestart}
        onExit={onExit}
      />
    </main>
  );
}
