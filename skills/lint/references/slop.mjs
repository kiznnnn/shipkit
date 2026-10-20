#!/usr/bin/env node
// Ship Kit slop linter: flags the phrases and patterns that make launch copy read like AI wrote it.
// No dependencies; Node 18+. Usage: node slop.mjs <file...> [--json] [--allow-dashes]
// Works on .md, .txt and .html (tags are stripped line by line, so line numbers stay true).
// Exit code: 0 clean, 1 hits found, 2 usage error.

import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const json = args.includes('--json');
const allowDashes = args.includes('--allow-dashes');
const files = args.filter((a) => !a.startsWith('--'));
if (!files.length) {
  console.error('usage: node slop.mjs <file...> [--json] [--allow-dashes]');
  process.exit(2);
}

// [pattern, label, fix hint]
const PHRASES = [
  [/\bexcited to (announce|share|launch|introduce)\b/i, 'announcement opener', 'say what it does instead'],
  [/\b(thrilled|stoked|pumped) to\b/i, 'announcement opener', 'cut it'],
  [/\bin today'?s (fast[- ]paced|digital|modern) (world|age|landscape)\b/i, 'filler opener', 'cut the sentence'],
  [/\bgame[- ]?chang(er|ing)\b/i, 'hype word', 'say the concrete change'],
  [/\brevolutioni[sz](e|es|ing)\b/i, 'hype word', 'say the concrete change'],
  [/\bparadigm shift\b/i, 'hype word', 'cut it'],
  [/\b(unlock|unleash)(s|ing)?\b/i, 'AI verb', 'use get, open, start'],
  [/\b(supercharge|turbocharge|skyrocket)(s|d|ing)?\b/i, 'AI verb', 'say by how much, or cut'],
  [/\bseamless(ly)?\b/i, 'AI adjective', 'say what step it removes'],
  [/\beffortless(ly)?\b/i, 'AI adjective', 'say what it saves'],
  [/\brobust\b/i, 'AI adjective', 'say what it survives'],
  [/\bcutting[- ]edge\b|\bstate[- ]of[- ]the[- ]art\b|\bnext[- ]level\b|\bbest[- ]in[- ]class\b/i, 'hype adjective', 'cut it'],
  [/\b(leverag|harness|empower|elevat|streamlin|optimiz)(e|es|ed|ing)\b/i, 'corporate verb', 'use a plain verb'],
  [/\bdelv(e|es|ing)\b/i, 'AI tell', 'use look at, dig into'],
  [/\b(a testament to|navigate the complexities|in the realm of|tapestry|ever[- ]evolving|landscape of)\b/i, 'AI tell', 'cut it'],
  [/\b(look no further|say goodbye to|imagine a world|the future of \w+ is here)\b/i, 'ad cliché', 'cut it'],
  [/\bwhether you'?re an? \w+(?: \w+)? or an? \b/i, '"whether you\'re X or Y"', 'name the one person it\'s for'],
  [/\b(let that sink in|here'?s the (thing|kicker|catch)|but wait,? there'?s more|buckle up|spoiler( alert)?:)\b/i, 'engagement bait', 'cut it'],
  [/\b(and the best part\?|the best part\?|guess what\?)/i, 'engagement bait', 'just say it'],
  [/\b(like and (rt|retweet|share)|smash that|drop a comment|don'?t forget to (like|follow))\b/i, 'engagement bait', 'cut it'],
  [/\bit'?s (not|n't) just an? [^.!?\n]{1,40}[.,;—–-]+\s*it'?s\b/i, '"it\'s not just X, it\'s Y"', 'say what it is once'],
  [/\b(is|it'?s|isn'?t) not (about )?[^.!?\n]{1,40}, (but|it'?s)\b/i, '"not X, but Y" reveal', 'say the true thing directly'],
  [/\bno more [a-z]+[^.!?\n]{0,30}\. no more\b/i, 'anaphora list', 'one line is enough'],
  [/\ball-in-one\b|\bone[- ]stop[- ]shop\b/i, 'vague claim', 'list what it does'],
  [/\b(boost|increase|improve) (your )?productivity\b/i, 'vague claim', 'say the minutes or steps saved'],
  [/\b(10x|100x) (your|faster|better)\b/i, 'unbacked multiplier', 'use a measured number or cut'],
  [/\bjourney\b/i, '"journey"', 'cut it or say what happened'],
  [/\b(dive|deep dive) into\b/i, '"dive into"', 'cut it'],
  [/\bat the end of the day\b|\bmoving forward\b|\bcircle back\b/i, 'filler', 'cut it'],
  [/\bi'?m (so )?(humbled|grateful) to\b/i, 'humblebrag opener', 'cut it'],
  [/#\w+.*#\w+.*#\w+/, 'three or more hashtags', 'zero or one'],
  [/🚀|🔥|✨|💯|🤯|👇|🧵|⚡️?|🙌|💥|🎉/u, 'launch emoji', 'cut it'],
];

const EMOJI = /\p{Extended_Pictographic}/gu;

function stripHtml(line, state) {
  // Drop <script>/<style> blocks across lines, then tags.
  let out = '';
  let i = 0;
  while (i < line.length) {
    if (state.skip) {
      const end = line.toLowerCase().indexOf(`</${state.skip}`, i);
      if (end === -1) return out;
      i = end + state.skip.length + 2;
      state.skip = null;
      continue;
    }
    const m = line.slice(i).match(/<(script|style)\b/i);
    if (!m) { out += line.slice(i); break; }
    out += line.slice(i, i + m.index);
    state.skip = m[1].toLowerCase();
    i += m.index + m[0].length;
  }
  return out.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&rsquo;|&apos;/g, "'").replace(/&mdash;/g, '—').replace(/&ndash;/g, '–');
}

const results = [];
for (const file of files) {
  const raw = readFileSync(file, 'utf8');
  const isHtml = /\.html?$/i.test(file);
  const state = { skip: null };
  const lines = raw.split('\n').map((l) => (isHtml ? stripHtml(l, state) : l));
  const hits = [];
  let exclaims = 0;
  let emojis = 0;
  let shortParas = 0;
  let paras = 0;
  // Plain ``` fences hold post text and are linted; fences tagged as code (```bash, ```js…) are skipped.
  let fence = null;
  const CODE = /^(bash|sh|zsh|shell|console|js|javascript|ts|typescript|json|jsonc|yaml|yml|toml|html|css|py|python|swift|go|rust|rb|ruby|diff|sql|xml|ini|env|text-code)$/i;
  lines.forEach((line, idx) => {
    const ln = idx + 1;
    const f = !isHtml && line.match(/^\s*```\s*([\w-]*)/);
    if (f) { fence = fence === null ? (f[1] || '') : null; return; }
    if (!isHtml && fence !== null && CODE.test(fence)) return;
    if (!isHtml && /^\s*<!--/.test(line)) return;
    for (const [re, label, fix] of PHRASES) {
      const m = line.match(re);
      if (m && !hits.some((h) => h.line === ln && h.col === m.index + 1)) hits.push({ line: ln, col: m.index + 1, label, text: m[0], fix });
    }
    if (!allowDashes) {
      for (const m of line.matchAll(/\s—\s|—|\s–\s|\s--\s/g)) hits.push({ line: ln, col: m.index + 1, label: 'dash aside', text: m[0].trim(), fix: 'use a full stop, comma or colon' });
      // a hyphen with spaces on both sides, used as a dash ("fast - and free"); not list bullets or ranges
      for (const m of line.matchAll(/(?<=\S) - (?=\S)/g)) hits.push({ line: ln, col: m.index + 2, label: 'hyphen as dash', text: '-', fix: 'use a full stop, comma or colon' });
    }
    // an emoji wall: three or more emoji in a row
    for (const m of line.matchAll(/(?:\p{Extended_Pictographic}\uFE0F?\s*){3,}/gu)) hits.push({ line: ln, col: m.index + 1, label: 'emoji wall', text: m[0].trim(), fix: 'one emoji at most, or none' });
    // long sentences get skimmed: flag any over 30 words
    for (const sent of (isHtml ? [] : line.split(/(?<=[.!?])\s+/))) {
      const words = sent.replace(/https?:\/\/\S+/g, 'URL').split(/\s+/).filter(w => /[A-Za-z0-9]/.test(w));
      if (words.length > 30) hits.push({ line: ln, col: Math.max(1, line.indexOf(sent) + 1), label: 'long sentence', text: words.slice(0, 6).join(' ') + '…', fix: `split it: ${words.length} words, keep it under 30` });
    }
    exclaims += (line.match(/!/g) || []).length;
    emojis += (line.match(EMOJI) || []).length;
    if (line.trim()) {
      paras++;
      if (line.trim().split(/\s+/).length <= 6) shortParas++;
    }
  });
  const notes = [];
  if (exclaims > 2) notes.push({ label: 'exclamation marks', text: `${exclaims} found`, fix: 'keep it to 1 or none' });
  if (emojis > 2) notes.push({ label: 'emoji', text: `${emojis} found`, fix: 'keep it to 1 or none' });
  if (!isHtml && paras >= 6 && shortParas / paras > 0.6) notes.push({ label: 'broetry', text: `${shortParas} of ${paras} lines are 6 words or fewer`, fix: 'join lines into real sentences' });
  results.push({ file, hits, notes, clean: hits.length === 0 && notes.length === 0 });
}

if (json) {
  console.log(JSON.stringify(results, null, 2));
} else {
  for (const r of results) {
    for (const h of r.hits) console.log(`${r.file}:${h.line}:${h.col}  ${h.label.padEnd(26)} "${h.text}"  → ${h.fix}`);
    for (const n of r.notes) console.log(`${r.file}  ${n.label.padEnd(26)} ${n.text}  → ${n.fix}`);
    console.log(r.clean ? `${r.file}  clean` : `${r.file}  ${r.hits.length + r.notes.length} issue(s)`);
  }
}
process.exit(results.every((r) => r.clean) ? 0 : 1);
