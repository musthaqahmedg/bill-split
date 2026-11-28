// 🏷️ Rename-ready: the app name and website link live only in BRAND (services/theme.js, ../lib/brand.ts).
// This fails if someone types the name or the link straight into a screen again. Run: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const walk = (dir) => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? walk(p) : /\.(js|jsx|ts|tsx)$/.test(f) ? [p] : [];
});
const files = [...walk('screens'), ...walk('components'), ...walk('services'), 'App.tsx', ...walk('../app'), ...walk('../components')]
  .filter((f) => !/services\/theme\.js$/.test(f));
// the name in visible text or a link (comments, storage keys like "vibeout.x" and code names are fine)
const BAD = /(['"`>]|\s)(Vibe ?Out|VIBEOUT)(?![\w.])|bill-split-flax\.vercel\.app/;

test('no hardcoded app name or website link outside BRAND', () => {
  const hits = [];
  for (const f of files) {
    readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
      const code = line.replace(/\/\/.*$/, '').trim();
      if (code.startsWith('*') || code.startsWith('/*')) return;
      if (/const VibeOut|\(VibeOut\)|default VibeOut/.test(code)) return;
      if (BAD.test(code)) hits.push(`${f}:${i + 1}`);
    });
  }
  assert.deepEqual(hits, []);
});
