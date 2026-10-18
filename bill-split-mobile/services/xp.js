import { supabase } from './supabaseClient';

// ⭐ Levels: earned by planning, bringing stuff, safe nights, friends. Never by drinking.
export const LEVELS = [
  { name: 'Rookie', emoji: '🐣', xp: 0 },
  { name: 'Party Starter', emoji: '🎈', xp: 150 },
  { name: 'Party Pro', emoji: '😎', xp: 400 },
  { name: 'Vibe Master', emoji: '🪩', xp: 800 },
  { name: 'Vibe Legend', emoji: '👑', xp: 1500 },
];

export function levelOf(xp) {
  let i = 0;
  while (i < LEVELS.length - 1 && xp >= LEVELS[i + 1].xp) i++;
  const cur = LEVELS[i];
  const next = LEVELS[i + 1] || null;
  const progress = next ? (xp - cur.xp) / (next.xp - cur.xp) : 1;
  return { ...cur, index: i, next, progress, toNext: next ? next.xp - xp : 0 };
}

export async function myXp() {
  const { data, error } = await supabase.rpc('my_xp');
  if (error) throw error;
  return data || { xp: 0, rows: [] };
}
