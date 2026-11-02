export function artworkUrl(artworkId, location, apiUrl, publicFrontendUrl = "") {
  const base = new URL(publicFrontendUrl || location.origin);
  if (!publicFrontendUrl && ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname)) {
    const backend = new URL(apiUrl);
    if (!["localhost", "127.0.0.1", "[::1]"].includes(backend.hostname)) base.hostname = backend.hostname;
  }
  return new URL(`/artwork/${encodeURIComponent(artworkId)}`, base).href;
}

export function sharedArtworkUrl(artworkId, info, location, apiUrl, publicFrontendUrl = "") {
  if (!info || info.id !== artworkId) return null;
  // Never fall back to the local game host while a hosted upload is pending.
  return info.sharing_enabled ? info.share_url || null
    : artworkUrl(artworkId, location, apiUrl, publicFrontendUrl);
}
