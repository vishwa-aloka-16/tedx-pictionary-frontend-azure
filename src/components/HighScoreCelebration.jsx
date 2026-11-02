export default function HighScoreCelebration({ rankings = {} }) {
  const achievers = [...new Map(Object.values(rankings)
    .filter((player) => player.new_high_score && player.rank <= 20)
    .map((player) => [player.name, player])).values()];
  if (!achievers.length) return null;
  return (
    <div className="high-score-celebrations" role="status">
      {achievers.map((player) => (
        <motion.div className="high-score-celebration motion-celebration" key={player.name}
          initial={{ opacity: 0, scale: 0.85, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}>
          <div className="rank-confetti" aria-hidden="true">
            {Array.from({ length: 16 }, (_, index) => <i key={index}
              style={{ "--piece": index, "--confetti-color": ["#f5b727", "#9461d6", "#f26a84", "#36b8ac"][index % 4] }} />)}
          </div>
          <span className="high-score-eyebrow">NEW PERSONAL BEST</span>
          <b className="high-score-position">Top {player.rank}</b>
          <span>{player.name} · {player.high_score.toLocaleString()} points</span>
        </motion.div>
      ))}
    </div>
  );
}
import { motion } from "motion/react";
