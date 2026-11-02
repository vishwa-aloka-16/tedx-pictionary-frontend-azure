import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { API_URL, getArtwork } from "../lib/gameApi";
import BrandLogos from "../components/BrandLogos";
import { loadArtworkImage } from "../lib/artworkImage";

function ArtworkLoading({ finishing = false }) {
  return (
    <div className="artwork-loading" role="status" aria-live="polite">
      <div className="artwork-loading-spinner" aria-hidden="true" />
      <strong>{finishing ? "Collecting your final drawings" : "Creating your artwork"}</strong>
      <p>Your drawings are coming together. Please wait.</p>
    </div>
  );
}

export default function ArtworkScreen({ artworkId }) {
  const [artwork, setArtwork] = useState(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [loadedImage, setLoadedImage] = useState(null);
  const [failedImageKey, setFailedImageKey] = useState(null);
  const imageKey = `${artworkId}-${attempt}`;
  const imageLoaded = loadedImage?.key === imageKey;
  const imageFailed = failedImageKey === imageKey;
  const image = `${API_URL}/artworks/${encodeURIComponent(artworkId)}/image`;
  const ready = Boolean(artwork?.ready);
  function retry() {
    setError("");
    setAttempt((value) => value + 1);
  }
  useEffect(() => {
    let active = true;
    let timer;
    const controller = new AbortController();
    async function load() {
      try {
        const result = await getArtwork(artworkId, controller.signal);
        if (!active) return;
        setArtwork(result);
        setError("");
        if (!result.ready) timer = window.setTimeout(load, 1500);
      } catch (failure) {
        if (active) setError(failure.message);
      }
    }
    load();
    return () => { active = false; controller.abort(); window.clearTimeout(timer); };
  }, [artworkId, attempt]);
  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    let objectUrl;
    loadArtworkImage(image, controller.signal).then((url) => {
      objectUrl = url;
      if (controller.signal.aborted) URL.revokeObjectURL(url);
      else setLoadedImage({ key: imageKey, url });
    }).catch(() => {
      if (!controller.signal.aborted) setFailedImageKey(imageKey);
    });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [ready, image, imageKey]);
  return (
    <main className="artwork-page">
      <BrandLogos compact />
      <span className="artwork-share-eyebrow">YOUR DRAWING STORY</span>
      <h1>{artwork ? artwork.names.join(" × ") : "Made together. Yours to keep."}</h1>
      {error ? (
        <div className="artwork-status" role="alert"><p>{error}</p>
          <button className="secondary-button" onClick={retry}>Try again</button>
        </div>
      ) : !artwork?.ready ? <ArtworkLoading finishing /> : (
        <>
          {imageLoaded && <a className="artwork-download" href={`${image}?download=true`}>Download artwork · PNG ↓</a>}
          <p className="artwork-retention">Available for up to one hour while the event service stays online. Save your copy now.</p>
          {artwork.received < artwork.expected && <p>Includes {artwork.received} of {artwork.expected} canvases. Some drawings weren’t received.</p>}
          {imageFailed ? <div className="artwork-status" role="alert">
            <p>The artwork could not be loaded. Please try again.</p>
            <button className="secondary-button" onClick={retry}>Try again</button>
          </div> : (
            <>
              {!imageLoaded && <ArtworkLoading />}
              {imageLoaded && <motion.img key={imageKey} initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }} className="artwork-preview" src={loadedImage.url}
                alt={`Game artwork by ${artwork.names.join(" and ")}`} />}
            </>
          )}
          {imageLoaded && <a className="artwork-open-image" href={image} target="_blank" rel="noopener noreferrer">Open full-size image</a>}
        </>
      )}
    </main>
  );
}
