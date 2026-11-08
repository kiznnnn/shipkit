#!/usr/bin/env node
// Ship Kit score card: turns a finished .shipkit/check.md into a 1200×630 share card for that run.
// No dependencies; Node 18+. Everything on the card is read from check.md, nothing is added.
//   node score-card.mjs <check.md> --out <dir> [--json] [--no-png] [--no-credit]
// Writes <dir>/score-card.svg and score-card.html, and score-card.png when Chrome or Chromium is installed.
// Verdict colours are Ship Kit's: Blocker red with white text, Fix amber with ink text, OK lime with ink text.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const INK = '#0a0b1a', BLUE = '#2f3cff', LIME = '#d8ff3d', RED = '#d92d4b', AMBER = '#f0a531', MUTE = '#9aa0bd', DIM = '#3c4058';
const SAIL = ['M548 196C650 300 742 470 776 640H548Z', 'M500 300C430 400 352 520 318 640H500Z', 'M232 690H792C778 770 716 826 640 826H384C308 826 246 770 232 690Z'];

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const clip = (s, n) => (s.length > n ? s.slice(0, n - 1).replace(/[\s,;:.]+\S*$/, '') + '…' : s);
const plain = (s) => s.replace(/\*\*|`/g, '').replace(/\s*\(([A-G]\d)\)\s*/g, ' ').replace(/\s+/g, ' ').trim().replace(/\.$/, '').trim();

// Read the parts of the report the card needs. The format is the one /shipkit:check writes (SKILL.md, step 4).
export function parseReport(md) {
  const product = md.match(/^#\s*Launch check:\s*(.+)$/m)?.[1]?.trim() ?? null;
  const head = md.match(/^Checked\s+(\S+)\s+against\s+(.+?)\.\s*Score:\s*(\d+)\s*\/\s*(\d+)(?:\s*\(([^)]*)\))?/m);
  if (!head) return { product, ok: null };
  const [, date, target, ok, scored, extra = ''] = head;
  const blockers = Number(extra.match(/(\d+)\s*blocker/)?.[1] ?? 0);
  const section = (name) => {
    const i = md.search(new RegExp('^##\\s*' + name, 'mi'));
    if (i < 0) return [];
    const rest = md.slice(i).split('\n').slice(1);
    const end = rest.findIndex((l) => /^##\s/.test(l));
    return (end < 0 ? rest : rest.slice(0, end)).filter((l) => /^(\d+\.|-)\s+/.test(l)); // top-level items only, not nested fix lines
  };
  const title = (l) => { const b = l.match(/\*\*(.+?)\*\*/); return plain(b ? b[1] : l.replace(/^\s*(\d+\.|-)\s+/, '').split(':')[0]); };
  const fixes = section('Fix this week');
  const good = section('Already good');
  let where = target.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/\s*\(.*$/, '').trim();
  if (/^local source/i.test(target)) where = 'local source';
  return {
    product, date, where, local: /^local source/i.test(target),
    ok: Number(ok), scored: Number(scored), blockers, fixes: fixes.length,
    lines: [
      ...section('Blockers').map((l) => ['Blocker', title(l)]),
      ...fixes.map((l) => ['Fix', title(l)]),
      ...good.map((l) => ['OK', title(l)]),
    ],
  };
}

export function cardSvg(r, { credit = true } = {}) {
  const w = 1200, h = 630, pad = 64;
  const lines = r.lines.slice(0, 2);
  const chip = (v, x, y) => {
    const fill = v === 'Blocker' ? RED : v === 'Fix' ? AMBER : LIME, fg = v === 'Blocker' ? '#fff' : INK;
    const cw = v === 'Blocker' ? 104 : v === 'Fix' ? 56 : 54;
    return { w: cw, svg: `<rect x="${x}" y="${y - 27}" width="${cw}" height="36" rx="18" fill="${fill}"/><text x="${x + cw / 2}" y="${y - 3}" font-size="20" font-weight="600" fill="${fg}" text-anchor="middle">${v}</text>` };
  };
  const rows = lines.map(([v, t], i) => {
    const y = 486 + i * 56, c = chip(v, pad, y);
    return `${c.svg}<text x="${pad + c.w + 16}" y="${y}" font-size="28" fill="#e7e8ef">${esc(clip(t, 58))}</text>`;
  }).join('');
  const score = String(r.ok), digits = score.length + String(r.scored).length + 1;
  const big = digits > 5 ? 190 : 230;
  const summary = [r.blockers ? `${r.blockers} blocker${r.blockers > 1 ? 's' : ''}` : 'no blockers', r.fixes ? `${r.fixes} to fix` : null].filter(Boolean).join(', ');
  const name = clip(r.product || r.where, 26);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="Geist, -apple-system, 'SF Pro Display', 'Helvetica Neue', Arial, sans-serif">
  <rect width="${w}" height="${h}" fill="${INK}"/>
  <g transform="translate(${pad},56) scale(${56 / 1024})"><rect width="1024" height="1024" rx="230" fill="${BLUE}"/><g fill="${LIME}">${SAIL.map((d) => `<path d="${d}"/>`).join('')}</g></g>
  <text x="${pad + 74}" y="95" font-size="32" font-weight="600" fill="#fff" letter-spacing="-0.5">My launch check</text>
  <text x="${w - pad}" y="95" font-size="24" fill="${MUTE}" text-anchor="end" font-family="'Geist Mono', ui-monospace, Menlo, monospace">${esc(r.date)}${r.local ? ' · before deploy' : ''}</text>
  <text x="${pad - 8}" y="${big + 150}" font-size="${big}" font-weight="600" letter-spacing="-12" fill="${LIME}" style="font-variant-numeric:tabular-nums">${score}<tspan fill="${DIM}">/${r.scored}</tspan></text>
  <text x="${w - pad}" y="300" font-size="40" font-weight="600" fill="#fff" text-anchor="end" letter-spacing="-1">${esc(name)}</text>
  <text x="${w - pad}" y="344" font-size="26" fill="${MUTE}" text-anchor="end">${esc(summary)}</text>
  ${rows}
  ${credit ? `<text x="${w - pad}" y="${h - 40}" font-size="22" fill="${MUTE}" text-anchor="end" font-family="'Geist Mono', ui-monospace, Menlo, monospace">checked with Ship Kit · shipkit.tech</text>` : ''}
</svg>`;
}

function chrome() {
  const paths = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
  return paths.find((p) => existsSync(p)) ?? null;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const file = process.argv[2];
  const opt = (k) => { const i = process.argv.indexOf('--' + k); return i > -1 ? process.argv[i + 1] : undefined; };
  const flag = (k) => process.argv.includes('--' + k);
  const out = opt('out');
  if (!file || !out) { console.error('usage: node score-card.mjs <check.md> --out <dir> [--json] [--no-png] [--no-credit]'); process.exit(2); }
  const r = parseReport(readFileSync(file, 'utf8'));
  if (r.ok == null) { console.error(`No "Score: <ok>/<scored>" line in ${file}. Run /shipkit:check first.`); process.exit(1); }
  if (flag('json')) { console.log(JSON.stringify(r, null, 2)); process.exit(0); }
  mkdirSync(out, { recursive: true });
  const svg = cardSvg(r, { credit: !flag('no-credit') });
  writeFileSync(join(out, 'score-card.svg'), svg);
  writeFileSync(join(out, 'score-card.html'), `<!doctype html><meta charset="utf-8"><link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;600&family=Geist+Mono&display=block" rel="stylesheet"><style>html,body{margin:0;background:${INK}}svg{display:block}</style>${svg}`);
  const result = { svg: join(out, 'score-card.svg'), png: null, score: `${r.ok}/${r.scored}`, blockers: r.blockers, lines: r.lines.slice(0, 2) };
  const c = !flag('no-png') && chrome();
  if (c) {
    try {
      execFileSync(c, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1', '--virtual-time-budget=3000', '--window-size=1200,630', `--screenshot=${join(out, 'score-card.png')}`, pathToFileURL(resolve(out, 'score-card.html')).href], { stdio: 'ignore', timeout: 30000 });
      if (existsSync(join(out, 'score-card.png'))) result.png = join(out, 'score-card.png');
    } catch { /* no PNG: the SVG and HTML are still there */ }
  }
  console.log(JSON.stringify(result, null, 2));
}
