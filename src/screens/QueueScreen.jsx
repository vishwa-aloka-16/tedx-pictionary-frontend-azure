import { motion } from "motion/react";
import Brand from "../components/Brand";

export default function QueueScreen({ position, error, onExit }) {
  return (
    <main className="waiting-page">
      <Brand />
      <motion.section className="waiting-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <span className="eyebrow">YOU'RE IN THE QUEUE</span>
        <h1>Game in progress—please wait</h1>
        <p>Both player seats are occupied. You'll join automatically when a seat becomes available.</p>
        <div className="queue-position" role="status" aria-live="polite">
          <span>Your queue position</span><strong>{position ? `#${position}` : "Checking…"}</strong>
        </div>
        <p>Keep this page open to hold your place.</p>
        {error && <p className="error-message" role="alert">{error}</p>}
        <button className="secondary-button" onClick={onExit}>Leave queue</button>
      </motion.section>
    </main>
  );
}
