import { motion } from "motion/react";
import { useState } from "react";

import Brand from "../components/Brand";

export default function NameScreen({
  onJoin,
  onBack,
  busy,
  error,
}) {
  const [name, setName] = useState("");
  const [validationError, setValidationError] =
    useState("");

  function submit(event) {
    event.preventDefault();

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
      <Brand />

      <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="name-card">
        <button
          className="back-button"
          type="button"
          onClick={onBack}
        >
          ← Back
        </button>

        <div className="name-icon">
          ✦
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
            disabled={busy}
          >
            {busy
              ? "Finding opponent..."
              : "Join game"}

            <span>→</span>
          </button>
        </form>
      </motion.section>
    </main>
  );
}