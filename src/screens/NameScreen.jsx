import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";

import Brand from "../components/Brand";
import DoodleHighlights from "../components/DoodleHighlights";
import "./NameScreen.css";

export default function NameScreen({
  onJoin,
  onBack,
  busy,
  error,
  ready = true,
  preparationError = "",
  onRetry,
}) {
  const [name, setName] = useState("");
  const reducedMotion = useReducedMotion();
  const [validationError, setValidationError] =
    useState("");

  function submit(event) {
    event.preventDefault();
    if (!ready) return;

    const cleanedName = name.trim();

    if (!cleanedName) {
      setValidationError(
        "Please enter your name.",
      );

      return;
    }

    setValidationError("");
    onJoin(cleanedName);
  }

  return (
    <main className="name-page">
      <DoodleHighlights />
      <Brand />

      <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="name-card">
        <button
          className="back-button"
          type="button"
          onClick={onBack}
        >
          ← Back
        </button>

        <div className="name-icon name-drawing-animation" aria-hidden="true">
          <svg viewBox="0 0 64 64" fill="none">
            <motion.path className="name-doodle-line" d="M12 42C12 35 27 33 25 40S12 48 18 51 35 43 42 47"
              initial={false}
              animate={reducedMotion ? { pathLength: 1 } : { pathLength: [0, 1, 1, 0], opacity: [1, 1, 1, 0] }}
              transition={{ duration: 3.6, times: [0, .6, .85, 1], repeat: Infinity, ease: "easeInOut" }} />
            <motion.g initial={false}
              animate={reducedMotion ? { x: 0, y: 0, rotate: 0 } : { x: [-12, -2, 9, 0, -12], y: [0, -4, 3, 0, 0], rotate: [-8, 2, -5, 0, -8] }}
              transition={{ duration: 3.6, times: [0, .3, .6, .85, 1], repeat: Infinity, ease: "easeInOut" }}>
              <path className="name-pencil-body" d="m25 30 19-19a4.2 4.2 0 0 1 6 6L31 36l-9 3 3-9Z" />
              <path className="name-pencil-detail" d="m40 15 6 6M25 30l6 6m-9 3 2-6" />
            </motion.g>
          </svg>
        </div>

        <span className="eyebrow">
          PLAYER REGISTRATION
        </span>

        <h1>What should we call you?</h1>

        <p>
          Enter your name to join the next
          available game.
        </p>

        <form onSubmit={submit}>
          {!ready && <p className="waiting-notice" role="status">{preparationError || "Getting the game ready. You can enter your name while the services connect…"}</p>}
          {preparationError && <button type="button" className="secondary-button" onClick={onRetry}>Try again</button>}
          <label className="form-field">
            <span>PLAYER NAME</span>

            <input
              value={name}
              maxLength={24}
              autoComplete="off"
              autoFocus
              placeholder="Enter your name"
              onChange={(event) =>
                setName(event.target.value)
              }
            />
          </label>

          {(validationError || error) && (
            <div className="error-message">
              {validationError || error}
            </div>
          )}

          <button
            className="primary-button"
            disabled={busy || !ready}
          >
            {busy
              ? "Finding opponent..."
              : !ready ? "Getting game ready…" : "Join game"}

            <span>→</span>
          </button>
        </form>
      </motion.section>
    </main>
  );
}
