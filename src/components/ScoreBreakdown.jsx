const COLORS = ["#be123c", "#b45309", "#15803d", "#0e7490", "#4338ca", "#a21caf"];
const colorFor = (round) => COLORS[(round - 1) % COLORS.length];

export default function ScoreBreakdown({ result }) {
  const maximum = Math.max(1, ...result.players.map((player) => player.score));
  return (
    <section className="score-chart" aria-label="Final scores by round, stacked column chart">
      <div className="score-chart-heading">EVERY ROUND COUNTS</div>
      <div className="score-chart-bars">
        {result.players.map((player) => {
          const rounds = result.rounds.filter((round) => round.winner_id === player.id && round.points > 0);
          const winner = player.score === result.score;
          return (
            <div className={`score-chart-player${winner ? " score-chart-player--winner" : ""}`} key={player.id}>
              <span className="score-chart-total">{player.score.toLocaleString()} <small>PTS</small></span>
              <div className="score-chart-track" role="img"
                aria-label={`${player.name}: ${player.score} points. ${rounds.map((round) => `Round ${round.round}: ${round.points} points`).join(". ")}`}>
                {rounds.map((round) => (
                  <motion.div className="score-chart-segment motion-score-segment" key={round.round}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: `${round.points / maximum * 100}%`, opacity: 1 }}
                    transition={{ duration: 0.5, delay: round.round * 0.06, ease: "easeOut" }}
                    style={{ backgroundColor: colorFor(round.round) }}
                    title={`Round ${round.round}: ${round.base_points} + ${round.time_bonus} time bonus = ${round.points} points`}>
                    <span>R{round.round}</span><span>{round.points.toLocaleString()}</span>
                  </motion.div>
                ))}
                {!rounds.length && <span className="score-chart-zero">No round wins · 0 points</span>}
              </div>
              <div className="score-chart-name">{player.name}
                {winner && <span className="score-chart-crown">{result.tied ? "JOINT WINNER" : "WINNER"}</span>}
              </div>
            </div>
          );
        })}
      </div>
      <div className="score-chart-legend">
        {result.rounds.map((round) => (
          <span key={round.round}><i style={{ backgroundColor: colorFor(round.round) }} />
            Round {round.round}{!round.winner ? " · No winner" : ""}</span>
        ))}
      </div>
      <p className="score-chart-formula">Each round win: 1,000 + 10 × seconds remaining (rounded up).</p>
      <p className="score-chart-note">Colored segments add up to each player’s total. Highest total wins.</p>
    </section>
  );
}
import { motion } from "motion/react";
