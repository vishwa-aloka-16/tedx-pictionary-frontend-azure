import { AnimatePresence, motion, useReducedMotion } from "motion/react";

export default function LeaderboardPodium({ players }) {
  const reduceMotion = useReducedMotion();
  const top = players.slice(0, 3);
  return (
    <section className="leaderboard-podium" aria-label="Top three players">
      <AnimatePresence mode="popLayout">
      {[2, 1, 3].map((rank) => {
        const player = top.find((entry) => entry.rank === rank);
        return (
          <motion.div layout="position" className={`podium-place podium-place--${rank}`} key={player?.name || `empty-${rank}`}
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: player ? 1 : 0, y: 0 }}
            exit={{ opacity: 0, y: 18 }} transition={{ duration: 0.35, delay: player ? (rank - 1) * 0.06 : 0 }}>
            {player && <>
              <div className="podium-profile">
                {rank === 1 && <span className="podium-crown" aria-hidden="true">{"\u265b"}</span>}
                <motion.span className="podium-avatar" aria-hidden="true"
                  animate={reduceMotion ? { y: 0, rotate: 0 } : { y: [0, -6, 0], rotate: [0, rank === 2 ? -5 : 5, 0] }}
                  transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut", delay: rank * 0.3 }}>
                  {player.emoji || player.name.charAt(0).toUpperCase()}
                </motion.span>
                <strong title={player.name}>{player.name}</strong>
                <span className="podium-score">{player.score.toLocaleString()} <small>pts</small></span>
              </div>
              <motion.div className="podium-step" initial={{ scaleY: 0 }} animate={{ scaleY: 1 }}
                transition={{ type: "spring", stiffness: 180, damping: 22, delay: rank * 0.07 }}
                style={{ transformOrigin: "bottom" }}><span aria-label={`Rank ${rank}`}>{rank}</span></motion.div>
            </>}
          </motion.div>
        );
      })}
      </AnimatePresence>
    </section>
  );
}
