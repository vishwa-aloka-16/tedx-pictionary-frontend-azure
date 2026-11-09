import { useEffect, useState } from "react";
import { prepareMatchmaking } from "../lib/gameApi";

export default function useEntryReadiness(active) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!active) return undefined;
    let mounted = true;
    let timer;
    let controller;
    const started = Date.now();
    async function check() {
      await Promise.resolve();
      if (!mounted) return;
      setReady(false);
      setError("");
      controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 65000);
      try {
        const result = await prepareMatchmaking(controller.signal);
        if (mounted && result.status === "ok") { setReady(true); return; }
      } catch { /* A sleeping service may recover on the next readiness check. */ }
      finally { window.clearTimeout(timeout); }
      if (!mounted) return;
      if (Date.now() - started >= 120000) setError("Game storage is not ready. Please try again shortly.");
      else timer = window.setTimeout(check, 2000);
    }
    check();
    return () => {
      mounted = false;
      controller?.abort();
      window.clearTimeout(timer);
    };
  }, [active, attempt]);
  return { ready: active && ready, error, retry: () => setAttempt((value) => value + 1) };
}
