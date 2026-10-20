#!/usr/bin/env node
// Reads Ship Kit Pro sales from the Gumroad API and writes the live counts into the sales page:
// the SOLD and FOUNDERS lines in docs/index.html, and the JSON-LD offer price.
// Run by .github/workflows/founders.yml. No dependencies; Node 18+.
//   GUMROAD_ACCESS_TOKEN=... GUMROAD_PRODUCT_ID=... node scripts/sync-founders.mjs docs/index.html
// Only buyers who typed an X handle at checkout are named on the wall. Everyone else is "Founder".
// Refunded, charged-back and disputed sales are left out.
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const file = process.argv[2] || 'docs/index.html';
const token = process.env.GUMROAD_ACCESS_TOKEN;
const product = process.env.GUMROAD_PRODUCT_ID;
const base = process.env.GUMROAD_API_BASE || 'https://api.gumroad.com';

async function allSales() {
  const out = []; let key = null;
  for (let page = 0; page < 200; page++) {
    const u = new URL('/v2/sales', base);
    u.searchParams.set('product_id', product);
    if (key) u.searchParams.set('page_key', key);
    let r = await fetch(u, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20000) });
    if (r.status === 401) { u.searchParams.set('access_token', token); r = await fetch(u, { signal: AbortSignal.timeout(20000) }); }
    if (!r.ok) throw new Error(`Gumroad API ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const j = await r.json();
    if (!j.success) throw new Error('Gumroad API returned success: false');
    out.push(...(j.sales || []));
    key = j.next_page_key;
    if (!key) break;
  }
  return out;
}

// the version a sale was for, from whichever shape the API used
function version(s) {
  const v = s.variants;
  if (v && typeof v === 'object') return Object.values(v).join(' ');
  return String(s.variants_and_quantity || v || '');
}
function field(s, re) {
  const f = s.custom_fields || {};
  if (Array.isArray(f)) { const hit = f.find((x) => re.test(x.name || x.label || '')); return hit ? String(hit.value ?? '') : ''; }
  const k = Object.keys(f).find((name) => re.test(name));
  return k ? String(f[k] ?? '') : '';
}
const cleanHandle = (h) => { const m = String(h).trim().replace(/^https?:\/\/(www\.)?(x|twitter)\.com\//i, '').replace(/^@/, '').match(/^[A-Za-z0-9_]{1,15}$/); return m ? '@' + m[0] : null; };

export function compute(sales) {
  const live = sales
    .filter((s) => !s.refunded && !s.chargedback && !s.disputed && !s.is_gift_receiver_purchase)
    .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
  const tally = { founding: 0, early: 0, other: 0 };
  const founders = []; const taken = new Set();
  for (const s of live) {
    const v = version(s);
    if (/founding/i.test(v)) {
      tally.founding++;
      const want = parseInt(field(s, /founding number|number you want/i).replace(/\D/g, ''), 10);
      let n = want >= 1 && want <= 25 && !taken.has(want) ? want : 0;
      for (let k = 1; !n && k <= 25; k++) if (!taken.has(k)) n = k;
      if (!n) continue; // more than 25 founding sales: the cap should stop this
      taken.add(n);
      founders.push({ n, name: cleanHandle(field(s, /handle/i)) || 'Founder' });
    } else if (/early/i.test(v)) tally.early++;
    else tally.other++;
  }
  // SOLD drives the ladder: founding first, then early, then everything after
  const sold = tally.founding < 25 ? tally.founding : tally.early < 50 ? 25 + tally.early : 75 + tally.other;
  founders.sort((a, b) => a.n - b.n);
  return { sold, founders, tally };
}

export function apply(html, { sold, founders }) {
  const price = sold < 25 ? 9 : sold < 75 ? 19 : 29;
  const list = JSON.stringify(founders.map((f) => ({ n: f.n, name: f.name })));
  let out = html.replace(/const SOLD = \d+;/, `const SOLD = ${sold};`);
  out = out.replace(/const FOUNDERS = \[[^\n]*?\];/, `const FOUNDERS = ${list};`);
  out = out.replace(/("offers":\{"@type":"Offer","price":")\d+(")/, `$1${price}$2`);
  if (!/const SOLD = \d+;/.test(out) || !/const FOUNDERS = \[/.test(out)) throw new Error('could not find the SOLD and FOUNDERS lines');
  return out;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  if (!token || !product) { console.error('set GUMROAD_ACCESS_TOKEN and GUMROAD_PRODUCT_ID'); process.exit(2); }
  const sales = await allSales();
  const state = compute(sales);
  const html = readFileSync(file, 'utf8');
  const next = apply(html, state);
  console.log(`sales ${sales.length} · founding ${state.tally.founding} · early ${state.tally.early} · other ${state.tally.other} · SOLD ${state.sold} · named ${state.founders.filter((f) => f.name !== 'Founder').length}`);
  if (next !== html) { writeFileSync(file, next); console.log('updated', file); } else console.log('no change');
}
