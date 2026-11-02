import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import { collectRoundStarts, collectMatchups, queueResults, hasNewGameStarted } from '../src/lib/roundAnnouncements.js';

// Exercise the real snapshot handler, including its announcement queue, without
// coupling the test to visual styles or animation timing.
function harness() {
  let source = readFileSync(new URL('../src/screens/LeaderboardScreen.jsx', import.meta.url), 'utf8');
  source = source.slice(source.indexOf('export default function LeaderboardScreen'));
  source = source.slice(0, source.search(/  return \(\r?\n    <motion.main/)) + '  return null;\n}';
  source = source.replace('export default function', 'function');
  const state = [];
  const effects = [];
  let socket;
  const context = vm.createContext({
    useState: (initial) => {
      const index = state.length;
      state.push(typeof initial === 'function' ? initial() : initial);
      return [state[index], (next) => { state[index] = typeof next === 'function' ? next(state[index]) : next; }];
    },
    useRef: (current) => ({ current }),
    useEffect: (effect) => effects.push(effect),
    collectRoundStarts, collectMatchups, queueResults, hasNewGameStarted,
    WS_URL: 'ws://example.test',
    WebSocket: class { constructor() { socket = this; } close() {} },
    document: { addEventListener() {}, removeEventListener() {} },
    window: { clearTimeout() {} },
    Set, JSON,
  });
  vm.runInContext(source + '\nLeaderboardScreen();', context);
  const cleanups = effects.map((effect) => effect());
  return {
    send: (snapshot) => socket.onmessage({ data: JSON.stringify(snapshot) }),
    announcements: () => state[5],
    players: () => state[0],
    stop: () => cleanups.forEach((cleanup) => cleanup?.()),
  };
}
const finished = { id: 'game', players: ['Alice', 'Bob'], phase: 'FINAL_RESULT', round_winners: [], game_result: { event_id: 'champion', winners: ['Alice'], score: 3000 } };

test('dashboard reset clears the persistent winner and allows future announcements', () => {
  const ui = harness();
  ui.send({ reset_at: 1, players: [], games: [] });
  ui.send({ reset_at: 1, players: [{ name: 'Alice', score: 3000 }], games: [finished] });
  assert.equal(ui.announcements().length, 1);
  assert.equal(ui.announcements()[0].isGameWinner, true);
  ui.send({ reset_at: 2, players: [], games: [] });
  assert.equal(ui.announcements().length, 0);
  assert.equal(ui.players().length, 0);
  ui.send({ reset_at: 2, players: [], games: [finished] });
  assert.equal(ui.announcements().length, 1);
  ui.send({ reset_at: 2, players: [], games: [finished] });
  assert.equal(ui.announcements().length, 1);
  ui.stop();
});
