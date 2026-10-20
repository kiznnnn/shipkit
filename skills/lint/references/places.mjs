#!/usr/bin/env node
// Ship Kit places query: which launch sites, directories and subreddits fit this product.
// No dependencies; Node 18+. Usage:
//   node places.mjs --fits mac,open-source [--kind subreddit,launch-site] [--tags marketing] [--json]
// --fits   product types: any web saas mac ios android mobile cli devtool ai mcp claude-plugin open-source game
// --kind   launch-site, directory, community, mcp-directory, skill-directory, mac-directory, subreddit
// --tags   what the product is (marketing, content-generation, outreach...), used to raise rule warnings
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const db = JSON.parse(readFileSync(join(here, 'places.json'), 'utf8'));
const arg = (name) => { const i = process.argv.indexOf('--' + name); return i > -1 ? (process.argv[i + 1] || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean) : []; };
const fits = arg('fits'), kinds = arg('kind'), tags = arg('tags'), json = process.argv.includes('--json');

const today = new Date();
const age = (d) => { const t = Date.parse(d.length === 7 ? d + '-01' : d); return Number.isNaN(t) ? null : Math.round((today - t) / 86400000); };

const rows = db.places
  .filter(p => !kinds.length || kinds.includes(p.kind))
  .filter(p => !fits.length || p.fits.includes('any') || p.fits.some(f => fits.includes(f)))
  .map(p => {
    const warnings = [];
    if (p.warn_if && p.warn_if.some(t => tags.includes(t))) warnings.push(`rules ban promotion of this kind of product (${p.warn_if.filter(t => tags.includes(t)).join(', ')})`);
    if (p.ai_content) warnings.push(`AI content: ${p.ai_content}; the maker should write or rewrite this post in their own words`);
    const days = age(p.checked);
    if (p.checked === 'unverified') warnings.push('not verified: check the live page before listing it as a fact');
    else if (days !== null && days > 45) warnings.push(`last checked ${days} days ago: re-check`);
    return { ...p, days_since_check: days, warnings };
  });

if (json) { console.log(JSON.stringify({ version: db.version, fallbacks: db.fallbacks, places: rows }, null, 2)); process.exit(0); }
console.log(`# Places that fit (${rows.length}), database ${db.version}`);
for (const r of rows) {
  console.log(`\n## ${r.name}  [${r.kind}]`);
  console.log(`url: ${r.submit_url || r.url}`);
  if (r.cost) console.log(`cost: ${r.cost}`);
  if (r.self_promo) console.log(`self-promotion: ${r.self_promo}`);
  console.log(`rules: ${r.rules}`);
  if (r.timing) console.log(`timing: ${r.timing}`);
  for (const w of r.warnings) console.log(`WARNING: ${w}`);
  console.log(`source: ${r.source} (checked ${r.checked})`);
}
console.log(`\nSubreddit rules fallback: ${db.fallbacks.subreddit_rules}`);
