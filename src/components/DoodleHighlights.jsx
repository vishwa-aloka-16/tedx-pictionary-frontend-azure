import { useEffect, useRef, useState } from "react";
import pattern from "../assets/doodle-pattern.json";
import { chooseDoodles, visibleDoodles } from "../lib/doodleHighlights";

const CHANGE_INTERVAL = 5000;

export default function DoodleHighlights() {
  const layerRef = useRef(null);
  const [highlights, setHighlights] = useState([]);

  useEffect(() => {
    const layer = layerRef.current;
    const page = layer.parentElement;
    const navigation = page.querySelector(".navigation");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let timer;

    function refresh() {
      if (document.visibilityState === "hidden") return;
      const bounds = layer.getBoundingClientRect();
      const clearTop = navigation ? Math.max(0, navigation.getBoundingClientRect().bottom - bounds.top) + 12 : 0;
      page.style.setProperty("--doodle-clear-top", `${clearTop}px`);
      const blocked = [...page.querySelectorAll(".how-to-play-card, .name-card, .waiting-card, .leaderboard-card, .leaderboard-games")]
        .filter(element => element.getClientRects().length)
        .map(element => {
          const rect = element.getBoundingClientRect();
          return { left: rect.left - bounds.left, right: rect.right - bounds.left,
            top: rect.top - bounds.top, bottom: rect.bottom - bounds.top };
        });
      // Pick highlights below the fade so none are wasted behind the header.
      blocked.push({ left: 0, right: bounds.width, top: 0, bottom: clearTop + 90 });
      const candidates = visibleDoodles(pattern.placements, bounds.width, bounds.height, blocked);
      setHighlights(previous => chooseDoodles(candidates, previous));
    }
    function schedule() {
      window.clearInterval(timer);
      if (!reducedMotion.matches && document.visibilityState !== "hidden") {
        timer = window.setInterval(refresh, CHANGE_INTERVAL);
      }
    }
    function resume() {
      if (document.visibilityState !== "hidden" && !reducedMotion.matches) refresh();
      schedule();
    }
    const observer = new ResizeObserver(refresh);
    observer.observe(page);
    if (navigation) observer.observe(navigation);
    reducedMotion.addEventListener("change", schedule);
    document.addEventListener("visibilitychange", resume);
    refresh();
    schedule();
    return () => {
      window.clearInterval(timer);
      observer.disconnect();
      page.style.removeProperty("--doodle-clear-top");
      reducedMotion.removeEventListener("change", schedule);
      document.removeEventListener("visibilitychange", resume);
    };
  }, []);

  return (
    <svg ref={layerRef} className="doodle-highlights" aria-hidden="true" focusable="false" fill="none"
      stroke="#ef8b85" strokeWidth=".85" strokeLinecap="round" strokeLinejoin="round">
      {highlights.map(doodle => (
        <g key={doodle.id} className="doodle-highlight"
          transform={`translate(${doodle.x} ${doodle.y}) rotate(${doodle.rotation}) scale(${doodle.scale}) translate(-28 -28)`}>
          {pattern.shapes[doodle.shape].map((path, index) => <path key={index} d={path} vectorEffect="non-scaling-stroke" />)}
        </g>
      ))}
    </svg>
  );
}
