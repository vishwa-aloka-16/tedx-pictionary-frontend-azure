import { motion } from "motion/react";
import BrandLogos from "../components/BrandLogos";

export default function DisconnectedScreen({ onHome }) {
  return (
    <main className="error-page">
      <motion.section className="connection-error-card session-disconnected-card"
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        aria-labelledby="disconnected-heading">
        <BrandLogos compact />
        <div className="session-disconnected-icon" aria-hidden="true">↪</div>
        <span className="eyebrow">SESSION ENDED</span>
        <h1 id="disconnected-heading">You’ve been disconnected</h1>
        <p>Your game session is no longer available. Your seat may have expired while you were disconnected.</p>
        <p>Return to the home page to join a new game.</p>
        <button className="primary-button" onClick={onHome}>Return to home</button>
      </motion.section>
    </main>
  );
}
