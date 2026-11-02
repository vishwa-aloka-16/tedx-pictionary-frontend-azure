import assert from "node:assert/strict";
import { test } from "node:test";
import { collectRoundStarts, collectMatchups, queueResults, hasNewGameStarted } from "../src/lib/roundAnnouncements.js";

const game = { id: "game", phase: "DRAWING", players: ["Alice", "Bob"], round_start: { event_id: "start-1", round: 1, prompt: "cat" } };

test("countdown matchup is followed by a separate target announcement", () => {
  const matchups = new Set();
  const targets = new Set();
  const countdown = { ...game, phase: "COUNTDOWN", round_start: { ...game.round_start, prompt: null } };
  assert.deepEqual(collectMatchups([countdown], matchups, true)[0].players, ["Alice", "Bob"]);
  assert.deepEqual(collectMatchups([countdown], matchups, true), []);
  assert.deepEqual(collectRoundStarts([countdown], targets, true), []);
  assert.equal(collectRoundStarts([game], targets, true)[0].prompt, "cat");
  assert.deepEqual(collectMatchups([game], matchups, true), []);
});

test("round intro shows both player names and only appears once across countdown and drawing", () => {
  const seen = new Set();
  const [intro] = collectRoundStarts([game], seen, true);
  assert.deepEqual(intro.players, ["Alice", "Bob"]);
  assert.equal(intro.round, 1);
  assert.equal(intro.prompt, "cat");
  assert.equal(intro.isRoundStart, true);
  assert.deepEqual(collectRoundStarts([{ ...game, phase: "DRAWING" }], seen, true), []);
});

test("opening mid-round does not replay an introduction, but the next round does", () => {
  const seen = new Set();
  assert.deepEqual(collectRoundStarts([{ ...game, phase: "DRAWING" }], seen, false), []);
  const next = { ...game, round_start: { event_id: "start-2", round: 2, prompt: "dog" } };
  assert.equal(collectRoundStarts([next], seen, true)[0].round, 2);
});

test("a replay of round one with a fresh event gets a new introduction", () => {
  const seen = new Set();
  collectRoundStarts([game], seen, true);
  assert.equal(collectRoundStarts([{ ...game, round_start: { event_id: "replay", round: 1, prompt: "cat" } }], seen, true).length, 1);
});

test("countdown does not consume the intro before the target is revealed", () => {
  const seen = new Set();
  const countdown = { ...game, phase: "COUNTDOWN", round_start: { ...game.round_start, prompt: null } };
  assert.deepEqual(collectRoundStarts([countdown], seen, false), []);
  assert.equal(seen.size, 0);
  assert.equal(collectRoundStarts([game], seen, true)[0].prompt, "cat");
});

test("champion waits behind final round drawings, including simultaneous delivery", () => {
  const round = { key: "round6" };
  const champion = { key: "champion", isGameWinner: true };
  assert.deepEqual(queueResults([round], [], [champion]), [round, champion]);
  assert.deepEqual(queueResults([], [round], [champion]), [round, champion]);
  assert.deepEqual(queueResults([round], [round], [champion]), [round, champion]);
});

test("final scoreboard closes on a fresh first-round countdown, including rematches", () => {
  const seen = new Set();
  assert.equal(hasNewGameStarted([game], seen, false), false);
  assert.equal(hasNewGameStarted([game], seen, true), false);
  const rematch = { ...game, phase: "COUNTDOWN", round_start: { event_id: "rematch", round: 1 } };
  assert.equal(hasNewGameStarted([rematch], seen, true), true);
  assert.equal(hasNewGameStarted([rematch], seen, true), false);
  assert.equal(hasNewGameStarted([{ ...rematch, round_start: { event_id: "round2", round: 2 } }], seen, true), false);
});
