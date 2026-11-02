export function hasNewGameStarted(games, seen, initialized) {
  let started = false;
  for (const game of games) {
    const event = game.round_start;
    if (!event?.event_id || event.round !== 1 || !["COUNTDOWN", "DRAWING"].includes(game.phase)) continue;
    const key = `${game.id}-${event.event_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (initialized) started = true;
  }
  return started;
}

export function queueResults(current, rounds, champions) {
  if (!rounds.length && !champions.length) return current;
  const pending = current.filter((item) => !item.isRoundStart && !item.isMatchup);
  const seen = new Set(pending.map((item) => item.key));
  return [...pending, ...[...rounds, ...champions].filter((item) => {
    if (seen.has(item.key)) return false;
    seen.add(item.key);
    return true;
  })];
}

export function collectRoundStarts(games, seen, initialized) {
  const announcements = [];
  for (const game of games) {
    const event = game.round_start;
    if (!event?.event_id || !event.prompt || game.players.length < 2) continue;
    const key = `start-${game.id}-${event.event_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    // Opening the leaderboard mid-round must not replay an old introduction.
    if (!initialized) continue;
    announcements.push({ key, isRoundStart: true, round: event.round, prompt: event.prompt, players: game.players.slice(0, 2) });
  }
  return announcements;
}

export function collectMatchups(games, seen, initialized) {
  const announcements = [];
  for (const game of games) {
    const event = game.round_start;
    if (!event?.event_id || game.players.length < 2) continue;
    const key = `matchup-${game.id}-${event.event_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (game.phase !== "COUNTDOWN" || (!initialized && event.round !== 1)) continue;
    announcements.push({ key, isMatchup: true, round: event.round, players: game.players.slice(0, 2), emojis: game.player_emojis || [] });
  }
  return announcements;
}
