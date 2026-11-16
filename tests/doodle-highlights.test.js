import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { chooseDoodles, visibleDoodles } from "../src/lib/doodleHighlights.js";

const pattern = JSON.parse(readFileSync(new URL("../src/assets/doodle-pattern.json", import.meta.url), "utf8"));

test("phone and large displays highlight ten distinct visible doodles", () => {
  for (const [width, height] of [[320, 568], [390, 844], [1920, 1080], [3840, 2160]]) {
    const selected = chooseDoodles(visibleDoodles(pattern.placements, width, height));
    assert.equal(selected.length, 10);
    assert.equal(new Set(selected.map(d => d.id)).size, 10);
    assert.ok(selected.every(d => d.x > 0 && d.x < width && d.y > 0 && d.y < height));
  }
});

test("new highlights differ from the previous batch and avoid opaque cards", () => {
  const card = { left: 100, right: 800, top: 100, bottom: 700 };
  const candidates = visibleDoodles(pattern.placements, 1440, 900, [card]);
  const first = chooseDoodles(candidates);
  const second = chooseDoodles(candidates, first);
  assert.equal(second.length, 10);
  assert.ok(second.every(d => !first.some(old => old.id === d.id)));
  assert.ok(second.every(d => d.x < card.left - 15 || d.x > card.right + 15 || d.y < card.top - 15 || d.y > card.bottom + 15));
});

test("small exposed areas never duplicate doodles or exceed available shapes", () => {
  const candidates = visibleDoodles(pattern.placements, 80, 80);
  assert.equal(chooseDoodles(candidates).length, Math.min(10, candidates.length));
  assert.deepEqual(chooseDoodles([]), []);
});
