export function visibleDoodles(placements, width, height, blocked = []) {
  const candidates = [];
  for (let tileY = 0; tileY < height; tileY += 1000) {
    for (let tileX = 0; tileX < width; tileX += 1600) {
      placements.forEach(([shape, x, y, rotation, scale], index) => {
        x += tileX;
        y += tileY;
        if (x < 15 || y < 15 || x > width - 15 || y > height - 15) return;
        if (blocked.some(r => x >= r.left - 15 && x <= r.right + 15 && y >= r.top - 15 && y <= r.bottom + 15)) return;
        candidates.push({ id: `${tileX}:${tileY}:${index}`, shape, x, y, rotation, scale });
      });
    }
  }
  return candidates;
}

export function chooseDoodles(candidates, previous = [], random = Math.random) {
  const previousIds = new Set(previous.map(p => p.id));
  const fresh = candidates.filter(p => !previousIds.has(p.id));
  const pool = [...(fresh.length >= Math.min(10, candidates.length) ? fresh : candidates)];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 10);
}
