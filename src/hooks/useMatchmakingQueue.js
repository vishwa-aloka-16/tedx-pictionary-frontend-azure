import { useEffect, useState } from "react";
import { getQueueStatus } from "../lib/gameApi";

export default function useMatchmakingQueue(queueId, onMatched, onExpired) {
  const [position, setPosition] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!queueId) return undefined;
    let active = true;
    let timer;
    let controller;
    let checking = false;
    async function check() {
      if (!active || checking) return;
      checking = true;
      controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 15000);
      try {
        const result = await getQueueStatus(queueId, controller.signal);
        if (!active) return;
        setError("");
        if (!result.queued) {
          onMatched(result);
          return;
        }
        setPosition(result.position);
      } catch (failure) {
        if (!active) return;
        if (failure.status === 404) { onExpired(); return; }
        setError("Unable to refresh your queue position. Retrying…");
      } finally {
        checking = false;
        window.clearTimeout(timeout);
      }
      if (active) timer = window.setTimeout(check, 2000);
    }
    function resume() {
      if (document.visibilityState === "hidden") return;
      window.clearTimeout(timer);
      check();
    }
    check();
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("online", resume);
    return () => {
      active = false;
      controller?.abort();
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("online", resume);
    };
  }, [queueId, onMatched, onExpired]);
  return { position, error };
}
