import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, LayoutGroup } from "motion/react";

import Brand from "../components/Brand";
import ScoreBreakdown from "../components/ScoreBreakdown";
import ArtworkShare from "../components/ArtworkShare";
import HighScoreCelebration from "../components/HighScoreCelebration";
import LeaderboardPodium from "../components/LeaderboardPodium";
import BrandLogos from "../components/BrandLogos";
import { API_URL, WS_URL } from "../lib/gameApi";
import { formatPrompt } from "../lib/session";
import { collectRoundStarts, collectMatchups, queueResults, hasNewGameStarted } from "../lib/roundAnnouncements";

const WINNER_ANNOUNCEMENT_MS = 5000;
const ROUND_START_ANNOUNCEMENT_MS = 2000;

function WinningDrawing({ url, name, prompt }) {
  if (!url) return null;
  const target = prompt ? formatPrompt(prompt.replaceAll("_", " ")) : "";
  return (
    <figure className="winning-drawing-figure">
      {target && <figcaption className="winning-drawing-target">Target: {target}</figcaption>}
      <img className="winning-drawing" src={`${API_URL}${url}`}
        alt={`${name}'s winning drawing${target ? ` of ${target}` : ""}`}
        onError={(event) => { event.currentTarget.hidden = true; }} />
    </figure>
  );
}

function RoundDrawings({ drawings, url, name, prompt }) {
  if (!drawings?.length) return <WinningDrawing url={url} name={name} prompt={prompt} />;
  return (
    <div className="round-drawing-comparison">
      <div className="round-drawing-target">Target: {formatPrompt((prompt || "").replaceAll("_", " "))}</div>
      {drawings.map((drawing) => (
        <figure key={drawing.id} className={`player-final-drawing${drawing.is_winner ? " player-final-drawing--winner" : ""}`}>
          <figcaption>
            <span className="drawing-result-label">{drawing.is_winner ? "★ WINNER" : "OPPONENT"}</span>
            <span className="drawing-player-name">{drawing.name}</span>
          </figcaption>
          {drawing.drawing_url
            ? <img src={`${API_URL}${drawing.drawing_url}`} alt={`${drawing.name}'s drawing of ${prompt}`}
                onError={(event) => { event.currentTarget.hidden = true; }} />
            : <span className="drawing-unavailable">Drawing unavailable</span>}
        </figure>
      ))}
    </div>
  );
}

export default function LeaderboardScreen() {
  const [players, setPlayers] = useState([]);
  const [games, setGames] = useState([]);
  const [error, setError] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(() => Boolean(document.fullscreenElement));
  const [fullscreenError, setFullscreenError] = useState("");
  const [announcements, setAnnouncements] = useState([]);
  const winnerAnnouncement = announcements[0];
  const seenRoundsRef = useRef(new Set());
  const initializedRef = useRef(false);
  const seenStartsRef = useRef(new Set());
  const seenMatchupsRef = useRef(new Set());
  const seenGameStartsRef = useRef(new Set());
  const resetAtRef = useRef(null);

  useEffect(() => {
    const updateFullscreen = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", updateFullscreen);
    return () => document.removeEventListener("fullscreenchange", updateFullscreen);
  }, []);

  async function toggleFullscreen() {
    setFullscreenError("");
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      setFullscreenError("Unable to switch fullscreen. Please try again.");
    }
  }

  useEffect(() => {
    if (!winnerAnnouncement || winnerAnnouncement.isGameWinner) return;
    const timer = window.setTimeout(
      () => setAnnouncements((current) => current.slice(1)),
      winnerAnnouncement.isRoundStart || winnerAnnouncement.isMatchup ? ROUND_START_ANNOUNCEMENT_MS : WINNER_ANNOUNCEMENT_MS,
    );
    return () => window.clearTimeout(timer);
  }, [winnerAnnouncement]);

  useEffect(() => {
    let active = true;
    let socket;
    let reconnectTimer;

    function applyLeaderboard(result) {
          if (!active) return;
          if (result.reset_at != null && resetAtRef.current != null && result.reset_at !== resetAtRef.current) {
            setAnnouncements([]);
            seenRoundsRef.current.clear();
            seenStartsRef.current.clear();
            seenMatchupsRef.current.clear();
            seenGameStartsRef.current.clear();
            initializedRef.current = false;
          }
          resetAtRef.current = result.reset_at ?? resetAtRef.current;
          setPlayers(result.players || []);
          const nextGames = result.games || [];
          const newGameStarted = hasNewGameStarted(nextGames, seenGameStartsRef.current, initializedRef.current);
          const roundStarts = collectRoundStarts(nextGames, seenStartsRef.current, initializedRef.current);
          const matchups = collectMatchups(nextGames, seenMatchupsRef.current, initializedRef.current);
          const completedWins = nextGames.flatMap((game) =>
            game.round_winners
              .filter((round) => round.winner)
              .map((round) => ({
                key: round.event_id || `${game.id}-${round.round}`,
                name: round.winner,
                round: round.round,
                points: round.points,
                drawingUrl: round.drawing_url,
                drawings: round.drawings,
                prompt: round.prompt,
              })),
          );

          const completedGames = nextGames.filter((game) => game.game_result).map((game) => ({
            key: game.game_result.event_id,
            name: game.game_result.winners.join(" & "),
            points: game.game_result.score,
            tied: game.game_result.tied,
            scoreBreakdown: game.game_result,
            isGameWinner: true,
          }));

          if (initializedRef.current) {
            // The final canvas arrives after the already-decided winner event.
            // Update that announcement rather than announcing the round twice.
            setAnnouncements((current) => current.map((item) => {
              const updated = completedWins.find((round) => round.key === item.key);
              return updated && (updated.drawingUrl !== item.drawingUrl || JSON.stringify(updated.drawings) !== JSON.stringify(item.drawings))
                ? { ...item, drawingUrl: updated.drawingUrl, drawings: updated.drawings, prompt: updated.prompt } : item;
            }));
            const newWinners = completedWins.filter(
              (round) => !seenRoundsRef.current.has(round.key),
            );

            const newGameWinners = completedGames.filter((game) => !seenRoundsRef.current.has(game.key));
            setAnnouncements((current) => queueResults(current, newWinners, newGameWinners));
          }

          [...completedWins, ...completedGames].forEach((round) =>
            seenRoundsRef.current.add(round.key),
          );
          if (newGameStarted) setAnnouncements([]);
          if (matchups.length) setAnnouncements(matchups.slice(-1));
          if (roundStarts.length) {
            setAnnouncements((current) => current.some((item) => item.isGameWinner)
              ? current : roundStarts.slice(-1));
          }
          initializedRef.current = true;
          setGames(nextGames);
          setError("");
    }

    function connect() {
      socket = new WebSocket(`${WS_URL}/ws/leaderboard`);
      socket.onmessage = (event) => {
        if (!active) return;
        applyLeaderboard(JSON.parse(event.data));
      };
      socket.onclose = () => {
        if (!active) return;
        setError("Reconnecting to live results…");
        reconnectTimer = window.setTimeout(connect, 1000);
      };
    }
    connect();

    return () => {
      active = false;
      window.clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, []);

  return (
    <motion.main className="leaderboard-page" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <AnimatePresence>
      {winnerAnnouncement?.isMatchup && (
        <motion.div className="winner-announcement round-start-announcement motion-announcement" key={winnerAnnouncement.key} role="status"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }}
          style={{ "--announcement-duration": `${ROUND_START_ANNOUNCEMENT_MS}ms` }}>
          <BrandLogos />
          <span className="round-start-badge">ROUND {winnerAnnouncement.round}</span>
          <div className="round-start-matchup">
            <motion.div className="round-start-player motion-matchup-player" initial={{ opacity: 0, x: -90 }} animate={{ opacity: 1, x: 0 }}><span>PLAYER 1</span><b className="matchup-emoji" aria-hidden="true">{winnerAnnouncement.emojis?.[0]}</b><strong>{winnerAnnouncement.players[0]}</strong></motion.div>
            <motion.b className="round-start-versus" initial={{ scale: 0.4 }} animate={{ scale: 1 }} transition={{ delay: 0.12 }}>X</motion.b>
            <motion.div className="round-start-player motion-matchup-player" initial={{ opacity: 0, x: 90 }} animate={{ opacity: 1, x: 0 }}><span>PLAYER 2</span><b className="matchup-emoji" aria-hidden="true">{winnerAnnouncement.emojis?.[1]}</b><strong>{winnerAnnouncement.players[1]}</strong></motion.div>
          </div>
        </motion.div>
      )}
      {winnerAnnouncement?.isRoundStart && (
        <motion.div className="round-prompt-overlay leaderboard-target-overlay motion-announcement"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
          key={winnerAnnouncement.key} role="status">
          <motion.strong initial={{ scale: 0.85 }} animate={{ scale: 1 }}>{formatPrompt(winnerAnnouncement.prompt)}</motion.strong>
        </motion.div>
      )}
      {winnerAnnouncement && !winnerAnnouncement.isRoundStart && !winnerAnnouncement.isMatchup && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }}
          className={`winner-announcement motion-announcement${winnerAnnouncement.isGameWinner ? " game-winner-announcement" : ""}`}
          key={winnerAnnouncement.key}
          aria-live="polite"
          style={{ "--announcement-duration": `${WINNER_ANNOUNCEMENT_MS}ms` }}
        >
          {winnerAnnouncement.isGameWinner && (
            <button type="button" className="scoreboard-close"
              onClick={() => setAnnouncements((current) => current.slice(1))}
              aria-label="Close final scoreboard">Close ×</button>
          )}
          <BrandLogos />
          {winnerAnnouncement.isGameWinner && <span className="champion-trophy" aria-hidden="true">🏆</span>}
          <span className="winner-announcement-badge">{winnerAnnouncement.isGameWinner ? (winnerAnnouncement.tied ? "GAME DRAW" : "GAME WINNER") : "WINNER"}</span>
          <motion.strong initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>{winnerAnnouncement.name}</motion.strong>
          <RoundDrawings drawings={winnerAnnouncement.drawings} url={winnerAnnouncement.drawingUrl} name={winnerAnnouncement.name} prompt={winnerAnnouncement.prompt} />
          {winnerAnnouncement.isGameWinner && winnerAnnouncement.scoreBreakdown && (
            <div className="final-score-content">
              <HighScoreCelebration rankings={winnerAnnouncement.scoreBreakdown.global_rankings} />
              <ScoreBreakdown result={winnerAnnouncement.scoreBreakdown} />
            </div>
          )}
          <span>
            {winnerAnnouncement.isGameWinner
              ? `${winnerAnnouncement.tied ? "Tied" : "Champion"} with ${winnerAnnouncement.points.toLocaleString()} points`
              : `won round ${winnerAnnouncement.round}`}
            {!winnerAnnouncement.isGameWinner && winnerAnnouncement.points > 0
              ? ` and earned ${winnerAnnouncement.points} points`
              : ""}
          </span>
        </motion.div>
      )}
      </AnimatePresence>
      {(!winnerAnnouncement || winnerAnnouncement.isGameWinner) && (
        <ArtworkShare corner artworkId={winnerAnnouncement?.scoreBreakdown?.artwork_id
          || games.filter((game) => game.game_result?.artwork_id).at(-1)?.game_result.artwork_id} />
      )}
      <Brand title="Leaderboard" connection={error ? "disconnected" : "connected"} />
      <LayoutGroup>
      <motion.div layout className="leaderboard-design">
      <div className="leaderboard-primary">
      <LeaderboardPodium players={players} />
      <motion.section layout className="leaderboard-card">
        <div className="leaderboard-title-bar">
          <div className="leaderboard-heading"><span className="leaderboard-kicker">PERSONAL BESTS</span></div>
          <button type="button" className="leaderboard-fullscreen-button"
            onClick={toggleFullscreen} aria-pressed={isFullscreen}
            disabled={!document.fullscreenEnabled}
            title={document.fullscreenEnabled ? "Press Esc to leave fullscreen" : "Fullscreen is unavailable in this browser"}>
            {isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          </button>
        </div>
        <p>Each player's highest score from a single game. One entry per username.</p>

        {fullscreenError && <div className="error-message" role="alert">{fullscreenError}</div>}
        {error && <div className="error-message">{error}</div>}

        <AnimatePresence mode="popLayout">
        {!error && !players.length && (
          <motion.div key="empty" className="leaderboard-empty" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            No completed games yet.
          </motion.div>
        )}

        {players.length > 0 && (
          <motion.div layout key="rankings" className="leaderboard-table" role="table" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="leaderboard-row leaderboard-row--header" role="row">
              <span>RANK</span>
              <span>PLAYER</span>
              <span>HIGH SCORE</span>
            </div>
            <AnimatePresence mode="popLayout" propagate>
            {players.map((player) => (
              <motion.div layout="position" className="leaderboard-row" role="row" key={player.name}
                initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }}>
                <strong>
                  {player.rank <= 3
                    ? <span className="leaderboard-medal" role="img"
                        aria-label={`${["Gold", "Silver", "Bronze"][player.rank - 1]} medal, rank ${player.rank}`}>
                        {["🥇", "🥈", "🥉"][player.rank - 1]}
                      </span>
                    : `#${player.rank}`}
                </strong>
                <div className="leaderboard-player-profile">
                  <span className={`leaderboard-player-avatar leaderboard-player-avatar--${Math.min(player.rank, 4)}`} aria-hidden="true">{player.emoji || player.name.charAt(0).toUpperCase()}</span>
                  <div><strong>{player.name}</strong><small>Personal best</small></div>
                </div>
                <span className="leaderboard-player-score">{player.score.toLocaleString()} <small>pts</small></span>
              </motion.div>
            ))}
            </AnimatePresence>
          </motion.div>
        )}
        </AnimatePresence>

      </motion.section>
      </div>
        <motion.aside layout layoutScroll className="leaderboard-games" aria-label="Game activity">
          <div className="leaderboard-section-heading">
            <h2>Game activity</h2>
            <span>Live updates</span>
          </div>

          <AnimatePresence mode="popLayout">
          {!games.length && (
            <motion.div key="no-games" className="leaderboard-empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              No games are currently visible.
            </motion.div>
          )}

          {[...games].sort((a, b) => Number(b.status === "in_progress") - Number(a.status === "in_progress")).map((game) => (
            <motion.article layout="position" className="game-activity" key={game.id}
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}>
              <div className="game-activity-header">
                <div>
                  <strong>
                    {game.players.join(" vs ") || "Waiting for players"}
                  </strong>
                  <span>
                    {game.phase === "PAUSED" ? "Waiting for reconnection"
                      : game.phase === "RESUMING" ? "Resuming game"
                      : game.status === "in_progress"
                      ? "Game in progress"
                      : "Game completed"}
                  </span>
                </div>
                <span className={`game-status game-status--${game.status}`}>
                  {game.phase === "PAUSED" ? "PAUSED" : game.phase === "RESUMING" ? "RESUMING" : game.status === "in_progress" ? "LIVE" : "DONE"}
                </span>
              </div>

              {game.round_winners.length ? (
                <div className="round-results">
                  <AnimatePresence mode="popLayout">
                  {game.round_winners.map((round) => (
                    <motion.article layout="position" className="activity-round" key={round.event_id || round.round}
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                      <div className="activity-round-header">
                        <span className="activity-round-number">{round.round}</span>
                        <span className="activity-round-info"><strong>{round.winner || "No winner"}</strong>
                          <small>{round.prompt ? formatPrompt(round.prompt) : `Round ${round.round}`}</small>
                        </span>
                        <b className="activity-round-points">{round.points > 0 ? `+${round.points.toLocaleString()}` : "0"}</b>
                      </div>
                      <RoundDrawings drawings={round.drawings} url={round.drawing_url} name={round.winner} prompt={round.prompt} />
                    </motion.article>
                  ))}
                  </AnimatePresence>
                </div>
              ) : (
                <div className="round-results-empty">
                  No round has finished yet.
                </div>
              )}
            </motion.article>
          ))}
          </AnimatePresence>
        </motion.aside>
      </motion.div>
      </LayoutGroup>
    </motion.main>
  );
}
