import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { API_URL, getArtwork } from "../lib/gameApi";
import { sharedArtworkUrl } from "../lib/artworkUrl";

function ArtworkQR({ url }) {
  const code = useMemo(() => QRCode.create(url, { errorCorrectionLevel: "M" }), [url]);
  const size = code.modules.size;
  const pixels = [];
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (code.modules.get(row, col)) pixels.push(`M${col + 4} ${row + 4}h1v1h-1z`);
    }
  }
  return (
    <svg className="artwork-qr" viewBox={`0 0 ${size + 8} ${size + 8}`}
      role="img" aria-label="Scan to open and download your game artwork" shapeRendering="crispEdges">
      <rect width={size + 8} height={size + 8} fill="white" />
      <path d={pixels.join("")} fill="black" />
    </svg>
  );
}

export default function ArtworkShare({ artworkId, compact = false, corner = false, qrOnly = false }) {
  const [sharing, setSharing] = useState(null);
  useEffect(() => {
    if (!artworkId) return;
    const controller = new AbortController();
    let timer;
    async function check() {
      try {
        const info = await getArtwork(artworkId, controller.signal);
        if (controller.signal.aborted) return;
        setSharing({ id: artworkId, ...info });
        if (info.sharing_enabled && !info.share_url) timer = window.setTimeout(check, 1500);
      } catch (error) {
        if (controller.signal.aborted) return;
        if (error.status === 404) setSharing({ id: artworkId, unavailable: true });
        else timer = window.setTimeout(check, 3000);
      }
    }
    check();
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [artworkId]);
  if (!artworkId) return null;
  const info = sharing?.id === artworkId ? sharing : null;
  if (info?.unavailable) return <p className={corner ? "artwork-share-corner artwork-share-pending" : "artwork-share-pending"}>This artwork is no longer available.</p>;
  const url = sharedArtworkUrl(artworkId, info, window.location, API_URL, import.meta.env.VITE_PUBLIC_FRONTEND_URL);
  if (!url) return (
    <aside className={corner ? "artwork-share-corner artwork-share-pending" : "artwork-share artwork-share-pending"} role="status" aria-live="polite">
      <span className="artwork-loading-spinner" aria-hidden="true" />
      <span>{info?.share_status === "retrying" ? "Retrying artwork upload…" : "Preparing your artwork…"}</span>
    </aside>
  );
  const page = url;
  if (qrOnly) {
    return (
      <div className="artwork-qr-prompt">
        <a className="artwork-qr-only" href={page} target="_blank" rel="noopener noreferrer"
          aria-label="Open and download your artwork"><ArtworkQR url={url} /></a>
        <p>Scan the QR code for artwork made by you.</p>
      </div>
    );
  }
  if (corner) {
    return (
      <aside className="artwork-share-corner">
        <a href={page} target="_blank" rel="noopener noreferrer" aria-label="Open and download game artwork">
          <ArtworkQR url={url} />
          <span>Scan for your artwork</span>
        </a>
      </aside>
    );
  }
  return (
    <aside className={`artwork-share${compact ? " artwork-share--compact" : ""}`}>
      <span className="artwork-share-eyebrow">MADE BY BOTH OF YOU</span>
      <h2>Take your art home</h2>
      {!compact && (
        <a href={page} target="_blank" rel="noopener noreferrer" aria-label="Open your game artwork">
          <ArtworkQR url={url} />
        </a>
      )}
      <p>{compact ? "Your drawings, together in one artwork." : "Scan to download every round in one artwork."}</p>
      <a className="artwork-link" href={page} target="_blank" rel="noopener noreferrer">Open artwork</a>
      <small>{info.sharing_enabled ? "Save a copy of your artwork." : "Download soon. This is a temporary link."}</small>
    </aside>
  );
}
