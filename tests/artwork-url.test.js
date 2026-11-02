import assert from 'node:assert/strict';
import { test } from 'node:test';
import { artworkUrl, sharedArtworkUrl } from '../src/lib/artworkUrl.js';
test('localhost QR uses configured LAN backend IP and frontend port', () => {
  assert.equal(artworkUrl('game', { origin: 'http://localhost:5173' }, 'http://192.168.111.18:8000'), 'http://192.168.111.18:5173/artwork/game');
});
test('explicit frontend URL wins and production stays on its frontend host', () => {
  assert.equal(artworkUrl('game', { origin: 'http://localhost:5173' }, 'http://192.168.111.18:8000', 'https://jkit-tedx.onrender.com'), 'https://jkit-tedx.onrender.com/artwork/game');
  assert.equal(artworkUrl('game', { origin: 'https://jkit-tedx.onrender.com' }, 'https://tedx-jkit-backend.onrender.com'), 'https://jkit-tedx.onrender.com/artwork/game');
});

test('hosted QR goes directly to the uploaded image on the configured service', () => {
  const info = { id: 'game', sharing_enabled: true, share_url: 'https://art.example.com/images/game' };
  assert.equal(sharedArtworkUrl('game', info, { origin: 'http://localhost:5173' }, 'http://localhost:8000'), info.share_url);
});

test('pending uploads and stale game metadata never produce a localhost QR', () => {
  const location = { origin: 'http://localhost:5173' };
  assert.equal(sharedArtworkUrl('game', null, location, 'http://localhost:8000'), null);
  assert.equal(sharedArtworkUrl('game', { id: 'game', sharing_enabled: true }, location, 'http://localhost:8000'), null);
  assert.equal(sharedArtworkUrl('game', { id: 'old-game', share_url: 'https://art.example.com/images/old-game' }, location, 'http://localhost:8000'), null);
});

test('local sharing remains available when the hosted service is disabled', () => {
  assert.equal(sharedArtworkUrl('game', { id: 'game', sharing_enabled: false }, { origin: 'http://localhost:5173' }, 'http://192.168.111.18:8000'), 'http://192.168.111.18:5173/artwork/game');
});
