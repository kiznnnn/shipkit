#!/usr/bin/env node
// Ship Kit site probe. Reports the launch-relevant facts of a page as JSON.
// No dependencies; needs Node 18+.
//   node check-site.mjs https://yoursite.com     a live site (only sends GET requests)
//   node check-site.mjs ./site                    a local folder with index.html: the page doesn't have to be live
//   node check-site.mjs ./site/pricing.html       a local HTML file
//   add --no-external to skip checking links to other sites (checkout pages, socials)
// In local mode it reads the files from disk, resolves the share image to the local file, and only touches
// the network for a share image with no local copy and for the checkout and outside links on the page.

import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join, dirname, resolve, extname } from 'node:path';

const FREE_HOSTS = [
  'vercel.app', 'netlify.app', 'pages.dev', 'onrender.com', 'glitch.me', 'herokuapp.com',
  'github.io', 'gitlab.io', 'web.app', 'firebaseapp.com', 'surge.sh', 'fly.dev', 'railway.app',
  'replit.app', 'repl.co', 'framer.website', 'framer.app', 'webflow.io', 'carrd.co', 'wixsite.com',
  'super.site', 'notion.site', 'lovable.app', 'bolt.new', 'netlify.com', 'azurewebsites.net',
];
// Hosts X accepted on 2026-10-19 or that are widely trusted; github.io is trusted by X but still not "own domain".
const TRUSTED_FREE = ['github.io'];

const ANALYTICS = {
  'Google Analytics': /googletagmanager\.com|google-analytics\.com|gtag\(/i,
  'Plausible': /plausible\.io/i,
  'Umami': /umami\.(is|js)|data-website-id/i,
  'Fathom': /usefathom\.com|cdn\.usefathom/i,
  'Simple Analytics': /simpleanalytics/i,
  'PostHog': /posthog/i,
  'Vercel Analytics': /\/_vercel\/insights|@vercel\/analytics|va\.vercel-scripts/i,
  'Cloudflare Web Analytics': /static\.cloudflareinsights\.com/i,
  'GoatCounter': /goatcounter/i,
  'Pirsch': /pirsch/i,
  'Microsoft Clarity': /clarity\.ms/i,
};
const PAYMENTS = {
  'Stripe': /buy\.stripe\.com|checkout\.stripe\.com|js\.stripe\.com/i,
  'Gumroad': /gumroad\.com/i,
  'Lemon Squeezy': /lemonsqueezy\.com|lmsqueezy/i,
  'Paddle': /paddle\.(com|js)|cdn\.paddle/i,
  'Dodo Payments': /dodopayments\.com/i,
  'Polar': /polar\.sh/i,
  'App Store': /apps\.apple\.com/i,
  'Mac App Store': /macappstore|apps\.apple\.com\/[a-z]{2}\/app\/.*mt=12/i,
  'Google Play': /play\.google\.com/i,
};

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36 shipkit-check/0.6';

async function get(u, { manual = false, bytes = false } = {}) {
  const res = await fetch(u, { redirect: manual ? 'manual' : 'follow', headers: { 'user-agent': UA }, signal: AbortSignal.timeout(15000) });
  const body = bytes ? Buffer.from(await res.arrayBuffer()) : await res.text();
  return { res, body };
}

async function follow(start) {
  const chain = [];
  let u = start;
  for (let i = 0; i < 10; i++) {
    const res = await fetch(u, { redirect: 'manual', headers: { 'user-agent': UA }, signal: AbortSignal.timeout(15000) });
    chain.push({ url: u, status: res.status });
    const loc = res.headers.get('location');
    if (res.status >= 300 && res.status < 400 && loc) { u = new URL(loc, u).href; continue; }
    return { chain, final: u, res };
  }
  return { chain, final: u, res: null, error: 'too many redirects' };
}

// Attributes may be unquoted in minified HTML (<meta name=viewport content=...>), so quotes are optional.
function meta(html, key) {
  const re = new RegExp(`<meta[^>]+(?:name|property)=["']?${key}["']?(?=[\\s/>])[^>]*>`, 'i');
  const tag = html.match(re)?.[0];
  if (!tag) return null;
  const m = tag.match(/content=(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
  return m ? (m[1] ?? m[2] ?? m[3]) : '';
}
// rel is a token list ("shortcut icon"), so match whole tokens: "icon" must not match "apple-touch-icon".
function linkHref(html, rel) {
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const r = m[0].match(/\brel=(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    if (!r || !(r[1] ?? r[2] ?? r[3]).toLowerCase().split(/\s+/).includes(rel)) continue;
    const h = m[0].match(/\bhref=(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    return h ? decode(h[1] ?? h[2] ?? h[3]) : '';
  }
  return null;
}
function text(s) { return s.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&rsquo;/g, "'").replace(/\s+/g, ' ').trim(); }

// robots.txt: group rules by user-agent; a bot falls back to the * group when it has none of its own.
const AI_BOTS = ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-SearchBot', 'Claude-User', 'PerplexityBot', 'Perplexity-User', 'Google-Extended', 'CCBot', 'Applebot-Extended'];
function robotsGroups(txt) {
  const groups = []; let cur = null, lastWasAgent = false;
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    const m = line.match(/^([a-z-]+)\s*:\s*(.*)$/i);
    if (!m) continue;
    const key = m[1].toLowerCase(), val = m[2].trim();
    if (key === 'user-agent') {
      if (!lastWasAgent || !cur) { cur = { agents: [], disallow: [], allow: [] }; groups.push(cur); }
      cur.agents.push(val.toLowerCase()); lastWasAgent = true;
    } else {
      lastWasAgent = false;
      if (!cur) continue;
      if (key === 'disallow') cur.disallow.push(val);
      if (key === 'allow') cur.allow.push(val);
    }
  }
  return groups;
}
function robotsBlocksRoot(groups, agent) {
  const a = agent.toLowerCase();
  const own = groups.filter((g) => g.agents.includes(a));
  const use = own.length ? own : groups.filter((g) => g.agents.includes('*'));
  const dis = use.flatMap((g) => g.disallow), al = use.flatMap((g) => g.allow);
  return dis.includes('/') && !al.includes('/');
}

export function imageSize(buf) {
  // PNG
  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) return { type: 'png', width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  // JPEG: walk segments to SOFn
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i < buf.length - 9) {
      if (buf[i] !== 0xff) { i++; continue; }
      const marker = buf[i + 1];
      const len = buf.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { type: 'jpeg', width: buf.readUInt16BE(i + 7), height: buf.readUInt16BE(i + 5) };
      i += 2 + len;
    }
    return { type: 'jpeg' };
  }
  // GIF
  if (buf.length > 10 && buf.slice(0, 3).toString() === 'GIF') return { type: 'gif', width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
  // WebP: lossy (VP8 ), lossless (VP8L) and extended (VP8X)
  if (buf.length > 30 && buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP') {
    const chunk = buf.slice(12, 16).toString();
    if (chunk === 'VP8 ') return { type: 'webp', width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
    if (chunk === 'VP8L') { const b = buf.readUInt32LE(21); return { type: 'webp', width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 }; }
    if (chunk === 'VP8X') return { type: 'webp', width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
    return { type: 'webp' };
  }
  if (/^\s*<svg|<\?xml/.test(buf.slice(0, 200).toString())) return { type: 'svg' };
  if (/^\s*<(!doctype|html)/i.test(buf.slice(0, 200).toString())) return { type: 'html' };
  return { type: 'unknown' };
}

// The share image is the check people say they'd miss most, so it gets its own verdict with plain reasons.
// Limits come from X's card docs (summary_large_image: at least 300x157, under 5 MB, JPG/PNG/WEBP/GIF, no SVG)
// and Facebook's sharing docs (1200x630 recommended; under 600x315 shows as a small image).
export function ogImageProblems(img, { og = {}, twitter = {}, declared = {} } = {}) {
  const p = [];
  const add = (severity, id, problem, fix) => p.push({ severity, id, problem, fix });
  if (!img) {
    add('blocker', 'missing', 'No og:image or twitter:image, so the link shows as a bare text card on X, iMessage, Slack, Discord and LinkedIn.', 'Add <meta property="og:image" content="https://<your-domain>/og.png"> with a 1200×630 PNG or JPEG.');
  } else if (img.error) {
    add('blocker', 'unreachable', `The share image could not be loaded (${img.error}).`, 'Host it at a public https URL and check it opens in a private window.');
  } else {
    if (img.status && img.status !== 200) add('blocker', 'status', `The share image URL returns ${img.status}, so previews show no image.`, 'Fix the path, or upload the file where the tag points.');
    if (img.missingLocal) add('blocker', 'no-file', `The tag points to ${img.declared}, and there's no such file in the project.`, 'Add the file, or point the tag at the image you have.');
    if (img.type === 'svg') add('blocker', 'svg', 'The share image is an SVG. X\'s card docs list JPG, PNG, WEBP and GIF only, and most other apps skip SVG previews too.', 'Export it as a 1200×630 PNG or JPEG.');
    if (img.type === 'html') add('blocker', 'not-image', 'The share image URL returns a web page, not an image (often a 404 page served with status 200).', 'Point og:image at the real image file.');
    if (img.type === 'unknown' && !img.missingLocal && !img.status_error) add('fix', 'unknown-type', 'The share image is in a format the probe can\'t read.', 'Use PNG or JPEG.');
    if (img.width && img.height) {
      const ratio = img.width / img.height;
      if (img.width < 300 || img.height < 157) add('blocker', 'too-small', `The share image is ${img.width}×${img.height}, below X's minimum of 300×157 for the large card.`, 'Use 1200×630.');
      else if (img.width < 600 || img.height < 315) add('fix', 'small', `The share image is ${img.width}×${img.height}. Facebook shows images under 600×315 as a small thumbnail, and it looks soft on X.`, 'Use 1200×630.');
      if (ratio < 1.7 || ratio > 2.1) add('fix', 'ratio', `The share image is ${img.width}×${img.height} (${ratio.toFixed(2)}:1). Previews are about 1.91:1, so ${ratio < 1.7 ? 'the top and bottom' : 'the sides'} get cropped.`, 'Use 1200×630 and keep text away from the edges.');
      if (img.width > 4096 || img.height > 4096) add('fix', 'too-big', `The share image is ${img.width}×${img.height}, over X's 4096×4096 limit.`, 'Use 1200×630.');
    }
    if (img.bytes > 5 * 1024 * 1024) add('blocker', 'heavy', `The share image is ${(img.bytes / 1048576).toFixed(1)} MB, over X's 5 MB limit for card images.`, 'Export it at 1200×630 as a JPEG or an optimised PNG, under 1 MB.');
    else if (img.bytes > 1024 * 1024) add('fix', 'heavy', `The share image is ${(img.bytes / 1048576).toFixed(1)} MB. It works, but previews load slowly.`, 'Aim for under 1 MB: JPEG, or a PNG run through an optimiser.');
    if (img.absolute === false) add('fix', 'relative', `og:image is a relative path (${img.declared}). Facebook and LinkedIn need an absolute URL, and some apps skip relative paths.`, 'Use the full https:// URL.');
    if (img.declared && /^http:\/\//i.test(img.declared)) add('fix', 'http', 'The share image is served over http, which some apps refuse to load.', 'Use https.');
    if (declared.width && img.width && (Number(declared.width) !== img.width || Number(declared.height) !== img.height)) add('fix', 'declared-size', `og:image:width/height say ${declared.width}×${declared.height}, but the file is ${img.width}×${img.height}.`, 'Fix the two tags or remove them.');
  }
  if (twitter.card !== 'summary_large_image') add('fix', 'x-card', twitter.card ? `twitter:card is "${twitter.card}", so X shows a small square thumbnail.` : 'No twitter:card tag, so X may show a small square thumbnail instead of the big image.', 'Add <meta name="twitter:card" content="summary_large_image">.');
  if (!og.title) add('fix', 'og-title', 'No og:title, so apps fall back to the page title or nothing.', 'Add <meta property="og:title" content="…">.');
  if (!og.description) add('fix', 'og-description', 'No og:description, so the preview has no line under the title.', 'Add <meta property="og:description" content="…"> (under 160 characters).');
  const verdict = p.some((x) => x.severity === 'blocker') ? 'blocker' : p.length ? 'fix' : 'ok';
  return { verdict, problems: p };
}

function robotsFacts(body) {
  const groups = robotsGroups(body);
  const blocked = AI_BOTS.filter((b) => robotsBlocksRoot(groups, b));
  return { blocksAll: robotsBlocksRoot(groups, 'Googlebot'), sitemapListed: /^\s*sitemap:/im.test(body), aiBotsBlocked: blocked, aiBotsAllowed: AI_BOTS.filter((b) => !blocked.includes(b)) };
}

// ---------------------------------------------------------------------------------------------------------
// 0.6: the checks makers miss most after the share image. Each gets a verdict with plain problems and fixes,
// like shareImage, so the report says the same thing every run.
//   secrets   A5  keys in the page or its scripts, a public .env or .git
//   links     A6  the buy button and the page's links resolve; checkout isn't in test mode
//   leftovers B5  template text, default titles, localhost links, an old copyright year
//   basics    B6  viewport, favicon, apple-touch-icon, alt text, mixed content
//   speed     B7  response time and page weight
//   email     D3  a way to keep in touch with people who aren't ready to buy
//   notFound  F4  a wrong URL returns a real 404
// ---------------------------------------------------------------------------------------------------------

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', middot: '·', mdash: '—', ndash: '–', hellip: '…', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', copy: '©', reg: '®', trade: '™', times: '×', bull: '•' };
export function decode(s) {
  if (s == null) return s;
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') { const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) ? String.fromCodePoint(n) : m; }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

// High-precision patterns only: a false alarm here would scare a maker for nothing.
// Firebase and Google Maps browser keys (AIza…) and Supabase anon keys are public by design, so they're not listed.
const SECRETS = [
  ['Stripe secret key', /\b[sr]k_live_[0-9a-zA-Z]{20,}/g, 'blocker'],
  ['Stripe test secret key', /\bsk_test_[0-9a-zA-Z]{20,}/g, 'fix'],
  ['AWS access key', /\bAKIA[0-9A-Z]{16}\b/g, 'blocker'],
  ['Anthropic API key', /\bsk-ant-[a-z]+\d*-[A-Za-z0-9_-]{20,}/g, 'blocker'],
  ['OpenAI API key', /\bsk-(?:proj-|svcacct-|admin-)?[A-Za-z0-9_-]{40,}/g, 'blocker'],
  ['GitHub token', /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{50,})/g, 'blocker'],
  ['Slack token', /\bxox[baprs]-[0-9A-Za-z-]{20,}/g, 'blocker'],
  ['SendGrid API key', /\bSG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}\b/g, 'blocker'],
  ['Google OAuth client secret', /\bGOCSPX-[A-Za-z0-9_-]{28}\b/g, 'blocker'],
  ['Private key', /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/g, 'blocker'],
];
const mask = (s) => `${s.slice(0, Math.min(10, Math.floor(s.length / 3)))}… (${s.length} characters)`;
export function findSecrets(src, where) {
  const hits = [];
  for (const [what, re, severity] of SECRETS) {
    for (const m of src.matchAll(re)) {
      if (what === 'OpenAI API key' && /^sk-ant-/.test(m[0])) continue;
      hits.push({ what, where, sample: mask(m[0]), severity });
      if (hits.length > 20) return hits;
    }
  }
  // A Supabase service_role key bypasses row-level security. The anon key is meant to be public; this one isn't.
  for (const m of src.matchAll(/eyJ[A-Za-z0-9_-]{10,}\.(eyJ[A-Za-z0-9_-]{10,})\.[A-Za-z0-9_-]{10,}/g)) {
    try { if (JSON.parse(Buffer.from(m[1], 'base64url').toString()).role === 'service_role') hits.push({ what: 'Supabase service_role key', where, sample: mask(m[0]), severity: 'blocker' }); } catch { /* not a JWT */ }
  }
  return hits;
}

const CHECKOUT = /^https?:\/\/([a-z0-9-]+\.)?(buy\.stripe\.com|checkout\.stripe\.com|gumroad\.com|gum\.co|lemonsqueezy\.com|polar\.sh|checkout\.dodopayments\.com|test\.checkout\.dodopayments\.com|paddle\.com|pay\.paddle\.io|apps\.apple\.com|play\.google\.com|payhip\.com|ko-fi\.com|buymeacoffee\.com|checkout\.freemius\.com)\b/i;
const EMAIL_TOOLS = { Buttondown: /buttondown\.(email|com)/i, 'Kit (ConvertKit)': /convertkit\.com|ck\.page|kit\.com\/forms|kit\.co\b/i, Mailchimp: /list-manage\.com|mailchimp\.com|mc\.us\d+/i, beehiiv: /beehiiv\.com/i, Substack: /substack\.com/i, Loops: /loops\.so/i, MailerLite: /mailerlite\.com|mlcdn\.com/i, EmailOctopus: /emailoctopus\.com/i, Tally: /tally\.so/i, Formspree: /formspree\.io/i, 'Web3Forms': /web3forms\.com/i, Getform: /getform\.io/i, Sendfox: /sendfox\.com/i, Brevo: /brevo\.com|sibforms\.com/i, Resend: /resend\.com\/audiences/i };
const DEFAULT_TITLE = /^(vite( \+ [\w+ ]+)?|react app|create next app|next\.?js( app)?|my (app|site|website|blog|portfolio)|document|untitled( page)?|home( page)?|index|welcome( to (next\.js|nuxt|astro|remix|sveltekit|react))?|astro( basics)?|sveltekit( app)?|nuxt( app)?|remix( app)?|new remix app|lovable generated project|lovable app|v0 app|bolt( app)?|new tab|title|page title|site title)$/i;
const DEFAULT_DESC = /generated by create next app|lovable generated project|created with v0|web site created using create-react-app|^description$|^(my|a) (new )?(site|website|app)$|^site description$/i;
// "Vite" is a template default, unless the site is vite.dev: a framework's own site may use its name.
const isDefaultTitle = (t, host) => DEFAULT_TITLE.test(t.trim()) && !(host && host.replace(/[^a-z]/gi, '').toLowerCase().includes(t.toLowerCase().replace(/[^a-z]/g, '')));
const PLACEHOLDER_TEXT = [
  ['Lorem ipsum placeholder text', /lorem ipsum|dolor sit amet|consectetur adipiscing/i],
  ['an unrendered template tag', /\{\{\s*[\w.$-]+\s*\}\}|\{%\s*\w+[^%]*%\}/],
  ['a rendering bug ([object Object], NaN or undefined in a price)', /\[object Object\]|[$€£]\s?(NaN|undefined)\b|\b(NaN|undefined)\s?(%|\/\s?mo\b|per month)/],
  ['template copy ("your product name here" and the like)', /your (product|company|brand|app|startup|business|site) name( goes)? here|your (headline|tagline|title|text|copy|description) (goes )?here|insert (text|image|link|copy) here|placeholder (text|copy)|sample text|add your (text|copy|headline) here|tagline goes here/i],
  ['an "under construction" notice', /under construction|site is being built/i],
  ['a TODO or FIXME left in the copy', /\b(TODO|FIXME|XXX)\b(?!\w)/],
];

async function pool(items, n, fn) {
  const out = new Array(items.length); let i = 0;
  await Promise.all([...Array(Math.min(n, items.length))].map(async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); } }));
  return out;
}

// Plain words for network errors, instead of "fetch failed".
export function netError(e) {
  const c = e?.cause?.code || e?.code || '';
  if (e?.name === 'TimeoutError' || /timeout/i.test(String(e?.message))) return 'timed out';
  if (c === 'ENOTFOUND' || c === 'EAI_AGAIN') return "the domain doesn't resolve (no DNS record)";
  if (c === 'ECONNREFUSED') return 'the server refused the connection';
  if (c === 'ECONNRESET' || c === 'UND_ERR_SOCKET') return 'the connection was reset';
  if (/CERT|SSL|TLS|ERR_TLS|self.signed|UNABLE_TO_VERIFY/i.test(c + ' ' + (e?.cause?.message || ''))) return `the HTTPS certificate isn't valid (${c || e?.cause?.message})`;
  return String(e?.cause?.message || e?.message || e);
}

async function linkStatus(u, ms = 10000) {
  const t0 = Date.now();
  try {
    const r = await fetch(u, { redirect: 'follow', headers: { 'user-agent': UA, accept: 'text/html,*/*' }, signal: AbortSignal.timeout(ms) });
    try { await r.body?.cancel(); } catch { /* ignore */ }
    return { url: u, status: r.status, finalUrl: r.url, ms: Date.now() - t0 };
  } catch (e) { return { url: u, error: netError(e) }; }
}
const isBroken = (r) => r.error ? !/timed out/.test(r.error) : (r.status === 404 || r.status === 410 || r.status >= 500);
const isUnverified = (r) => r.error ? /timed out/.test(r.error) : [401, 403, 405, 429, 999].includes(r.status);

function verdictOf(problems) {
  return problems.some((p) => p.severity === 'blocker') ? 'blocker' : problems.some((p) => p.severity === 'fix') ? 'fix' : 'ok';
}

// The page's own links, checkout links and outside links, from <a href>.
function collectLinks(html, base) {
  const own = new Set(), checkout = new Set(), outside = new Set(); let hashOnly = 0;
  for (const m of html.matchAll(/<a\b[^>]*?\shref=(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)) {
    const raw = decode((m[1] ?? m[2] ?? m[3] ?? '').trim());
    if (raw === '#' || raw === '') { hashOnly++; continue; }
    if (/^(#|mailto:|tel:|sms:|javascript:|data:)/i.test(raw)) continue;
    let u; try { u = new URL(raw, base); } catch { continue; }
    if (!/^https?:$/.test(u.protocol)) continue;
    u.hash = '';
    if (/^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])$/.test(u.hostname) && !(base && u.origin === new URL(base).origin)) continue; // reported as a leftover
    if (/^(www\.)?example\.(com|org|net)$/.test(u.hostname)) continue; // reported as a leftover
    if (u.pathname.startsWith('/cdn-cgi/')) continue; // Cloudflare's own endpoints (email protection) work in a browser only
    if (CHECKOUT.test(u.href)) checkout.add(u.href);
    else if (base && u.origin === new URL(base).origin) own.add(u.href);
    else if (/^https?:/i.test(raw)) outside.add(u.href);
  }
  return { own: [...own], checkout: [...checkout], outside: [...outside], hashOnly };
}

function leftoverFacts(html, raw, out) {
  const p = [];
  const add = (severity, problem, fix) => p.push({ severity, problem, fix });
  const body = decode(text(html.replace(/<head[\s\S]*?<\/head>/i, ' ')));
  if (out.title && isDefaultTitle(out.title, out.host)) add('blocker', `The page title is "${out.title}", a template default. It's what shows in the browser tab, in Google and in some link previews.`, 'Set a <title> that says what it is and who it is for, under 60 characters.');
  if (!out.title) add('fix', 'The page has no <title>, so the tab, Google and some previews show the bare URL.', 'Add a <title> that says what it is and who it is for.');
  for (const [field, v] of [['meta description', out.description], ['og:description', out.og?.description]]) if (v && DEFAULT_DESC.test(v.trim())) add('blocker', `The ${field} is "${v}", a template default, and it shows under the title in previews.`, `Write a real ${field} under 160 characters.`);
  if (out.og?.title && isDefaultTitle(out.og.title, out.host)) add('blocker', `og:title is "${out.og.title}", a template default, so every share preview shows it.`, 'Set og:title to the product name and what it does.');
  if (/lovable\.dev|bolt\.new|v0\.dev|gpteng/i.test(out.og?.image || '') || /^@(lovable_dev|lovable|boltdotnew|v0)$/i.test((out.twitter?.site || '').trim())) add('blocker', `The share tags still point at the AI builder's own defaults (${[out.og?.image, out.twitter?.site].filter(Boolean).join(', ')}), so shares show their image or handle, not yours.`, 'Replace og:image with your own 1200×630 image and twitter:site with your handle, or remove twitter:site.');
  for (const [label, re] of PLACEHOLDER_TEXT) {
    const m = body.match(re);
    if (!m) continue;
    const i = body.indexOf(m[0]);
    const inHero = (out.h1 || []).some((h) => re.test(h));
    add(inHero ? 'blocker' : 'fix', `The page shows ${label}: "…${body.slice(Math.max(0, i - 40), i + m[0].length + 40).trim()}…"${inHero ? ' in the main headline' : ''}.`, 'Replace it with the real copy, or remove it.');
  }
  const local = [...new Set([...html.matchAll(/(?:href|src|content|action)=["']((?:https?:)?\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(?::\d+)?[^"']*)/gi)].map((m) => m[1]))];
  if (local.length) add('blocker', `${local.length} link${local.length > 1 ? 's' : ''} or asset${local.length > 1 ? 's point' : ' points'} at localhost, which only works on your own machine: ${local.slice(0, 3).join(', ')}.`, 'Use relative paths or your real domain.');
  const example = [...new Set([...html.matchAll(/href=["'](https?:\/\/(?:www\.)?example\.(?:com|org|net)[^"']*)/gi)].map((m) => m[1]))];
  if (example.length) add('fix', `${example.length} link${example.length > 1 ? 's go' : ' goes'} to example.com, a placeholder: ${example.slice(0, 3).join(', ')}.`, 'Point them at the real pages.');
  if (out.canonicalHost && out.host && out.canonicalHost !== out.host && out.mode === 'live' && out.canonicalHost.replace(/^www\./, '') !== out.host.replace(/^www\./, '')) add('blocker', `The canonical tag points to ${out.canonicalHost}, not ${out.host}. Google treats that other address as the real page and can drop this one.`, `Set <link rel="canonical" href="https://${out.host}/">.`);
  if (out.og?.url && out.host && out.mode === 'live') { try { const h = new URL(out.og.url).hostname; if (h !== out.host && h.replace(/^www\./, '') !== out.host.replace(/^www\./, '')) add('fix', `og:url points to ${h}, not ${out.host}, so some apps credit the share to that address.`, `Set og:url to https://${out.host}/.`); } catch { /* relative og:url */ } }
  const years = [...decode(raw.replace(/<[^>]+>/g, ' ')).matchAll(/(?:©|copyright)\s*(?:(?:19|20)\d\d\s*[-–—]\s*)?((?:19|20)\d\d)(?!\s*[-–—]\s*(?:present|now|today|\d))/gi)].map((m) => Number(m[1]));
  const now = new Date().getFullYear();
  if (years.length && Math.max(...years) < now) add('minor', `The footer says © ${Math.max(...years)}. An old year reads as an abandoned site.`, `Update it to ${now}, or drop the year.`);
  return { verdict: verdictOf(p), problems: p };
}

function basicsFacts(html, out) {
  const p = [];
  const add = (severity, problem, fix) => p.push({ severity, problem, fix });
  if (!out.viewport) add('blocker', 'No viewport tag, so phones show a shrunken desktop page. Most launch traffic from X and Reddit is on phones.', 'Add <meta name="viewport" content="width=device-width, initial-scale=1"> to the <head>.');
  else if (/user-scalable\s*=\s*no|maximum-scale\s*=\s*1(\.0)?\b/i.test(out.viewport)) add('minor', `The viewport tag stops people zooming (${out.viewport}).`, 'Remove user-scalable=no and maximum-scale=1.');
  if (out.icons?.favicon === false) add('fix', 'No favicon loads, so the tab and Google results show a blank page icon.', 'Add <link rel="icon" href="/favicon.png"> (or put a favicon.ico at the site root).');
  if (!out.icons?.appleTouchIcon) add('minor', 'No apple-touch-icon, so iPhones show a screenshot instead of your icon when someone saves the page.', 'Add <link rel="apple-touch-icon" href="/apple-touch-icon.png"> with a 180×180 PNG.');
  if (!out.lang) add('minor', 'The <html> tag has no lang attribute, so screen readers and translators guess the language.', 'Use <html lang="en"> (or your language).');
  const imgs = [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);
  const noAlt = imgs.filter((t) => !/\balt\s*=/i.test(t));
  out.images = { total: imgs.length, missingAlt: noAlt.length };
  if (noAlt.length) add('minor', `${noAlt.length} of ${imgs.length} images have no alt text.`, 'Add alt="…" describing each image (alt="" for decoration).');
  if (out.mode === 'live' && /^https:/.test(out.finalUrl || '')) {
    const mixed = [...html.matchAll(/<(script|img|iframe|link|source|video|audio)\b[^>]*\b(?:src|href)=["'](http:\/\/[^"']+)/gi)].filter((m) => m[1].toLowerCase() !== 'link' || /stylesheet/i.test(m[0]));
    const scripts = mixed.filter((m) => /script|iframe|link/i.test(m[1]));
    if (scripts.length) add('blocker', `${scripts.length} script${scripts.length > 1 ? 's or styles load' : ' or style loads'} over http on an https page, and browsers block them: ${scripts.slice(0, 2).map((m) => m[2]).join(', ')}.`, 'Change them to https://.');
    else if (mixed.length) add('fix', `${mixed.length} image${mixed.length > 1 ? 's load' : ' loads'} over http on an https page, which shows a "not secure" warning in some browsers.`, 'Change them to https://.');
  }
  return { verdict: verdictOf(p), problems: p };
}

function emailFacts(html, out) {
  const providers = Object.entries(EMAIL_TOOLS).filter(([, re]) => re.test(html)).map(([k]) => k);
  const form = /<input[^>]+type=["']?email|<input[^>]+name=["']?(email|e-mail)\b/i.test(html);
  out.emailCapture = { form, providers };
  const p = form || providers.length ? [] : [{ severity: 'fix', problem: 'No email signup on the page. Visitors who aren\'t ready to buy today leave with no way to hear from you again.', fix: 'Add one email field ("Get the launch-day discount" or "Hear when it ships"), with a free tool such as Buttondown, Kit or a Tally form.' }];
  return { verdict: verdictOf(p), problems: p, form, providers };
}

function linkVerdict(res) {
  const p = [];
  const add = (severity, problem, fix) => p.push({ severity, problem, fix });
  const show = (r) => `${r.url} (${r.error || r.status})`;
  const co = res.checkout || [];
  const broken = co.filter(isBroken);
  if (broken.length) add('blocker', `The buy or download link is broken: ${broken.map(show).join(', ')}. Launch traffic would hit an error page at the moment they decide to pay.`, 'Fix the link, or re-publish the product in your payment tool, and click it in a private window.');
  if (res.stripeTestLinks?.length) add('blocker', `The checkout is a Stripe test-mode link (${res.stripeTestLinks.slice(0, 2).join(', ')}). Real cards are declined.`, 'Create the payment link in live mode (turn off "Test mode" in Stripe) and swap the URL.');
  if (res.stripeTestKey && !res.stripeLiveKey) add('blocker', 'The page loads Stripe with a test key (pk_test_…) and no live key, so real payments fail.', 'Use your pk_live_ key in production.');
  if (res.dodoTest?.length) add('blocker', `The checkout points at Dodo Payments test mode (${res.dodoTest[0]}). Real cards are declined.`, 'Use the live checkout link.');
  const own = (res.own || []).filter(isBroken);
  if (own.length) add('fix', `${own.length} link${own.length > 1 ? 's' : ''} on the page go${own.length > 1 ? '' : 'es'} to a missing page: ${own.slice(0, 5).map(show).join(', ')}.`, 'Fix or remove them.');
  const out = (res.outside || []).filter(isBroken);
  if (out.length) add('minor', `${out.length} outside link${out.length > 1 ? 's are' : ' is'} broken: ${out.slice(0, 4).map(show).join(', ')}.`, 'Update or remove them.');
  if ((res.hashOnly || 0) >= 3) add('minor', `${res.hashOnly} links go to "#" (nowhere). If any of them is a button people should click, it does nothing.`, 'Point each one at a real page or section.');
  const unverified = [...co, ...(res.own || [])].filter(isUnverified);
  return { verdict: verdictOf(p), problems: p, unverified: unverified.map(show) };
}

function speedVerdict(s) {
  if (!s) return { verdict: 'unknown', problems: [] };
  const p = [];
  const add = (severity, problem, fix) => p.push({ severity, problem, fix });
  const mb = (b) => `${(b / 1048576).toFixed(1)} MB`;
  const bigImgs = s.assets.filter((a) => a.kind === 'image' && a.bytes > 1048576);
  if (bigImgs.length) add('fix', `${bigImgs.length} image${bigImgs.length > 1 ? 's are' : ' is'} over 1 MB: ${bigImgs.slice(0, 3).map((a) => `${a.url.split('/').pop().split('?')[0]} ${mb(a.bytes)}`).join(', ')}. On a phone that's seconds of blank space.`, 'Export them as WebP or JPEG at the size they show on screen (usually under 300 KB).');
  if (s.totalBytes > 5 * 1048576) add('fix', `The page loads about ${mb(s.totalBytes)} of images, scripts and styles before any video.`, 'Compress the heaviest files listed in `speed.heaviest`, and lazy-load images below the fold (loading="lazy").');
  if (s.ttfbMs > 1500) add('fix', `The server took ${(s.ttfbMs / 1000).toFixed(1)} s to start answering (one measurement from this machine).`, 'Serve the page from a static host or CDN, or cache it.');
  if (s.htmlBytes > 3 * 1048576) add('fix', `The HTML alone is ${mb(s.htmlBytes)} before compression.`, 'Move inline images and data out of the HTML.');
  else if (s.htmlBytes > 1048576) add('minor', `The HTML is ${mb(s.htmlBytes)} before compression (common with framework data inlined in the page; usually much smaller over the wire).`, 'Fine for launch; trim inlined data if the page feels slow on a phone.');
  return { verdict: verdictOf(p), problems: p };
}

function assetsOf(html) {
  const list = [];
  for (const m of html.matchAll(/<img\b[^>]*?\bsrc=["']([^"']+)["']/gi)) list.push({ kind: 'image', ref: m[1] });
  for (const m of html.matchAll(/<script\b[^>]*?\bsrc=["']([^"']+)["']/gi)) list.push({ kind: 'script', ref: m[1] });
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) { if (/rel=["']?(stylesheet|preload)/i.test(m[0])) { const h = m[0].match(/href=["']([^"']+)["']/i)?.[1]; if (h) list.push({ kind: /\.css(\?|$)|stylesheet/i.test(m[0]) ? 'style' : 'image', ref: h }); } }
  const seen = new Set();
  return list.filter((a) => !/^data:/i.test(a.ref) && !seen.has(a.ref) && seen.add(a.ref)).slice(0, 40);
}

// Generator tags come in either attribute order (Webflow puts content first).
const gen = (name) => new RegExp(`<meta[^>]+(?:generator[^>]+${name}|${name}[^>]+generator)`, 'i');
// Signals checked against live sites on 2026-11-10 (see check/references/builders.md).
const BUILDERS = [
  ['Framer', new RegExp(`${gen('Framer').source}|framerusercontent\\.com`, 'i')],
  ['Webflow', new RegExp(`data-wf-(site|page)|${gen('Webflow').source}`, 'i')],
  ['Wix', new RegExp(`${gen('Wix').source}|static\\.parastorage\\.com|static\\.wixstatic\\.com`, 'i')],
  ['Squarespace', /static1\.squarespace\.com|images\.squarespace-cdn\.com|This is Squarespace|SQUARESPACE_CONTEXT/i],
  ['Ghost', gen('Ghost')],
  ['WordPress', new RegExp(`wp-content\\/|wp-includes\\/|${gen('WordPress').source}`, 'i')],
  ['Shopify', /cdn\.shopify\.com|Shopify\.theme|myshopify\.com/i],
  ['Carrd', /Made with Carrd|href=["']https:\/\/carrd\.co["']|carrd\.co\/|carrdusercontent\.com/i],
  ['Lovable', /lovable\.dev\/opengraph|id=["']lovable-badge|cdn\.gpteng\.co|<meta[^>]+author[^>]+Lovable|content=["']Lovable Generated Project/i],
  ['Hugo', gen('Hugo')],
  ['Jekyll', gen('Jekyll')],
  ['Astro', new RegExp(`${gen('Astro').source}|\\/_astro\\/|<astro-island`, 'i')],
  ['Next.js', /\/_next\/static|__NEXT_DATA__|self\.__next_f/i],
  ['Nuxt', /\/_nuxt\/|__NUXT__/i],
  ['Gatsby', new RegExp(`${gen('Gatsby').source}|___gatsby`, 'i')],
  ['SvelteKit', /\/_app\/immutable\/|data-sveltekit/i],
  ['Vite', /<script[^>]+type=["']module["'][^>]+src=["'][^"']*(\/assets\/index-[\w-]+\.js|\/src\/main\.[jt]sx?)/i],
];

// Everything that can be read from the HTML alone, live or local.
function readHtml(out, raw) {
  out.bytes = Buffer.byteLength(raw);
  // HTML comments aren't on the page: a commented-out analytics snippet or "<!-- price -->" note must not count.
  const html = raw.replace(/<!--[\s\S]*?-->/g, ' ');
  out.title = decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? null);
  out.description = decode(meta(html, 'description'));
  out.viewport = meta(html, 'viewport');
  out.lang = html.match(/<html[^>]*\blang=["']([^"']+)/i)?.[1] ?? null;
  out.h1 = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => decode(text(m[1]))).slice(0, 3);
  out.canonical = linkHref(html, 'canonical');
  out.metaRobots = meta(html, 'robots');
  out.noindex = /noindex/i.test(out.metaRobots || '') || /noindex/i.test(out.xRobotsTag || '');
  out.jsonLd = [];
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const data = JSON.parse(m[1]);
      const items = Array.isArray(data) ? data : data['@graph'] ? data['@graph'] : [data];
      for (const it of items) out.jsonLd.push([].concat(it['@type'] ?? 'unknown').join('/'));
    } catch { out.jsonLd.push('invalid JSON'); }
  }
  out.favicon = linkHref(html, 'icon');
  out.og = {
    title: decode(meta(html, 'og:title')), description: decode(meta(html, 'og:description')), image: decode(meta(html, 'og:image')),
    url: meta(html, 'og:url'), type: meta(html, 'og:type'),
  };
  out.twitter = { card: meta(html, 'twitter:card'), image: meta(html, 'twitter:image'), site: meta(html, 'twitter:site') };
  out.ogImageDeclared = { width: meta(html, 'og:image:width'), height: meta(html, 'og:image:height'), alt: meta(html, 'og:image:alt') };
  out.icons = { declared: out.favicon, appleTouchIcon: linkHref(html, 'apple-touch-icon') };
  out.builder = BUILDERS.find(([, re]) => re.test(raw))?.[0] ?? null;
  try { out.canonicalHost = out.canonical && /^https?:/i.test(out.canonical) ? new URL(out.canonical).hostname : null; } catch { out.canonicalHost = null; }
  out.analytics = Object.entries(ANALYTICS).filter(([, re]) => re.test(html)).map(([k]) => k);
  // A self-hosted counter has no known name; a script or beacon call that looks like one still counts as analytics.
  if (!out.analytics.length && (/<script[^>]+src=["'][^"']*(stats|analytics|track|counter|insights|metrics|beacon)[^"']*["']/i.test(html) || /navigator\.sendBeacon\(/.test(html))) out.analytics = ['a self-hosted counter (not a known provider; check it records visits)'];
  out.payments = Object.entries(PAYMENTS).filter(([, re]) => re.test(html)).map(([k]) => k);
  const body = text(html);
  out.mentionsPrice = /[$€£]\s?\d|\d+\s?(USD|EUR)|\/\s?mo(nth)?\b|per month|one[- ]time|lifetime|free trial|free for \d+ days/i.test(body);
  out.prices = [...new Set((body.match(/[$€£]\s?\d+(?:[.,]\d{1,2})?(?:\s?\/\s?(?:mo|month|yr|year))?/g) || []))].slice(0, 12);
  out.mentionsSignupOnly = /join the waitlist|join waitlist|get early access|notify me|coming soon/i.test(body);
  out.hasVideo = /<video[\s>]|youtube\.com\/embed|player\.vimeo|\.mp4["']/i.test(html);
  out.hasForm = /<form[\s>]|type=["']email["']/i.test(html);
  out.externalScripts = [...new Set([...html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].map((m) => { try { return new URL(m[1]).hostname; } catch { return null; } }).filter(Boolean))];
  out.links = {
    privacy: /href=["'][^"']*privacy/i.test(html), terms: /href=["'][^"']*terms/i.test(html),
    changelog: /href=["'][^"']*(changelog|changes|releases)/i.test(html), mailto: /href=["']mailto:/i.test(html),
    github: /href=["']https?:\/\/(www\.)?github\.com\//i.test(html),
  };
  out.utmLinksOnPage = (html.match(/utm_source=/g) || []).length;
}

function hostFacts(out, host) {
  out.host = host;
  const free = FREE_HOSTS.find((h) => host === h || host.endsWith('.' + h));
  out.hostKind = free ? (TRUSTED_FREE.includes(free) ? 'free-subdomain (trusted by X)' : 'free-subdomain') : 'own-domain';
  out.freeHost = free ?? null;
  out.xLinkRisk = free && !TRUSTED_FREE.includes(free) ? 'low: free subdomain; test the link in an X draft reply before launch' : 'low';
}

async function fetchImage(abs, declared) {
  try {
    const r = await get(abs, { bytes: true });
    return { url: abs, declared, source: 'fetched', status: r.res.status, contentType: r.res.headers.get('content-type'), bytes: r.body.length, ...imageSize(r.body), absolute: /^https?:/i.test(declared) };
  } catch (e) { return { url: abs, declared, error: String(e.message || e), absolute: /^https?:/i.test(declared) }; }
}

// Facts that need more than the HTML: secrets in scripts, the checkout, the links, speed. Shared by both modes.
function scanScripts(out, sources) {
  out.secrets = [];
  for (const { where, body } of sources) out.secrets.push(...findSecrets(body, where));
  const all = sources.map((x) => x.body).join('\n');
  out.stripeKeys = { test: /\bpk_test_[0-9a-zA-Z]{20,}/.test(all), live: /\bpk_live_[0-9a-zA-Z]{20,}/.test(all) };
}

function secretsVerdict(out) {
  const p = [];
  const seen = new Set();
  for (const h of out.secrets || []) {
    const k = h.what + h.where;
    if (seen.has(k)) continue; seen.add(k);
    p.push({ severity: h.severity, problem: `A ${h.what} is in ${h.where}: ${h.sample}. Anyone who opens the page can copy it.`, fix: h.what === 'Stripe test secret key' ? 'Remove it from client code and roll it in Stripe (Developers › API keys). Secret keys belong on a server only.' : `Revoke it now in that service's dashboard, issue a new one, and keep it on a server (an environment variable read by an API route), never in the page or its JavaScript.` });
  }
  for (const f of out.exposedFiles || []) p.push({ severity: f.severity || 'blocker', problem: f.problem, fix: f.fix });
  return { verdict: verdictOf(p), problems: p };
}

function finish(out, html, raw) {
  if (out.botChallenge) {
    const u = { verdict: 'unknown', problems: [{ severity: 'fix', problem: out.botChallenge.note, fix: 'Run the check on the local source, and test the link preview by hand.' }] };
    Object.assign(out, { leftovers: u, basics: u, email: u, secretsCheck: secretsVerdict(out), linkCheck: { verdict: 'unknown', problems: [] }, speedCheck: { verdict: 'unknown', problems: [] } });
    out.verdicts = { 'A5 secrets': out.secretsCheck.verdict === 'ok' ? 'unknown' : out.secretsCheck.verdict, 'A6 links and checkout': 'unknown', 'B4 share preview': 'unknown', 'B5 leftovers': 'unknown', 'B6 phone and tab basics': 'unknown', 'B7 speed': 'unknown', 'D3 email signup': 'unknown', 'F4 real 404': out.notFound?.verdict ?? 'unknown' };
    return;
  }
  out.leftovers = leftoverFacts(html, raw, out);
  out.basics = basicsFacts(html, out);
  out.email = emailFacts(html, out);
  out.secretsCheck = secretsVerdict(out);
  out.linkCheck = linkVerdict(out.linkResults || {});
  out.speedCheck = speedVerdict(out.speed);
  // One line per check the probe can grade on its own. The skill still judges the rest from the page.
  out.verdicts = {
    'A5 secrets': out.secretsCheck.verdict, 'A6 links and checkout': out.linkCheck.verdict, 'B4 share preview': out.shareImage?.verdict,
    'B5 leftovers': out.leftovers.verdict, 'B6 phone and tab basics': out.basics.verdict, 'B7 speed': out.speedCheck.verdict,
    'D3 email signup': out.email.verdict, 'F4 real 404': out.notFound?.verdict ?? 'unknown',
  };
}

function externalLinks(out, html, base) {
  const l = collectLinks(html, base);
  out.linkResults = { hashOnly: l.hashOnly, stripeTestLinks: l.checkout.filter((u) => /buy\.stripe\.com\/test_|checkout\.stripe\.com\/c\/pay\/cs_test_/i.test(u)), dodoTest: l.checkout.filter((u) => /test\.checkout\.dodopayments\.com/i.test(u)) };
  out.linkResults.stripeTestKey = out.stripeKeys?.test; out.linkResults.stripeLiveKey = out.stripeKeys?.live;
  return l;
}

async function live(url, out) {
  out.mode = 'live';
  const http = url.replace(/^https:/, 'http:');
  if (http !== url) {
    try { const h = await follow(http); out.httpRedirectsToHttps = h.final.startsWith('https:'); } catch { out.httpRedirectsToHttps = null; }
  }
  let f;
  const t0 = Date.now(); let t1 = t0;
  try { f = await follow(url); } catch (e) {
    // https failed: say why, and still check the site over http if that works, rather than giving up.
    out.httpsError = netError(e);
    if (url === http) throw new Error(`Couldn't load ${url}: ${out.httpsError}`);
    try { t1 = Date.now(); f = await follow(http); out.httpsWorks = false; } catch (e2) { throw new Error(`Couldn't load ${url}: ${out.httpsError}`); }
  }
  out.speed = { ttfbMs: Date.now() - t1 };
  out.redirects = f.chain;
  out.finalUrl = f.final;
  out.status = f.res?.status ?? null;
  if (f.error) out.redirectError = f.error;
  const host = new URL(f.final).hostname;
  hostFacts(out, host);
  out.hsts = f.res?.headers.get('strict-transport-security') ?? null;
  out.xRobotsTag = f.res?.headers.get('x-robots-tag') ?? null;
  const raw = f.res ? await f.res.text() : '';
  out.speed.htmlMs = Date.now() - t1;
  out.speed.htmlBytes = Buffer.byteLength(raw);
  readHtml(out, raw);
  const html = raw.replace(/<!--[\s\S]*?-->/g, ' ');
  const origin = new URL(f.final).origin;
  // A bot check (Cloudflare "Just a moment...", Vercel's checkpoint) is not the page. Grading it would be wrong.
  if (f.res?.headers.get('cf-mitigated') === 'challenge' || /<title>(Just a moment\.\.\.|Attention Required! \| Cloudflare|Vercel Security Checkpoint|Access denied)<\/title>|challenges\.cloudflare\.com\/cdn-cgi\/challenge|cf-chl-|_cf_chl_opt/i.test(raw.slice(0, 20000))) {
    out.botChallenge = { status: out.status, note: 'The site answered with a bot check instead of the page, so the probe could not read it. Link previews on X, Slack, iMessage and LinkedIn are fetched by bots too: paste the link into a private draft to see whether they get through, or allow those crawlers in the host\'s bot settings. Check the page from the local source instead (local mode).' };
  }

  const ogImg = out.og.image || out.twitter.image;
  const jobs = [];
  if (ogImg) jobs.push((async () => { out.ogImage = await fetchImage(new URL(ogImg, f.final).href, ogImg); })());

  // The site's own scripts: analytics bundled inside them, and keys that shouldn't be there.
  const own = [...new Set([...html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].map((m) => { try { return new URL(m[1], f.final); } catch { return null; } }).filter((u) => u && u.hostname === host).map((u) => u.href))].slice(0, 12);
  jobs.push((async () => {
    const bodies = await pool(own, 6, async (u) => { try { const r = await get(u); return { where: u.replace(origin, ''), body: r.body.slice(0, 3_000_000) }; } catch { return null; } });
    const ok = bodies.filter(Boolean);
    scanScripts(out, [{ where: 'the page HTML', body: html }, ...ok]);
    if (!out.analytics.length || out.analytics[0].startsWith('a self-hosted')) {
      const found = new Set();
      for (const { body } of ok) for (const [k, re] of Object.entries(ANALYTICS)) if (re.test(body.slice(0, 1_500_000))) found.add(k);
      if (found.size) { out.analytics = [...found]; out.analyticsInBundle = true; }
    }
  })());

  for (const p of ['robots.txt', 'sitemap.xml', 'llms.txt']) {
    jobs.push((async () => {
      try {
        const r = await get(`${origin}/${p}`);
        const ok = r.res.ok && !/<html/i.test(r.body.slice(0, 300));
        out[p] = { status: r.res.status, present: ok, bytes: ok ? r.body.length : 0, ...(p === 'robots.txt' && ok ? robotsFacts(r.body) : {}), ...(p === 'sitemap.xml' && ok ? { urls: (r.body.match(/<loc>/g) || []).length } : {}) };
      } catch (e) { out[p] = { error: netError(e) }; }
    })());
  }

  // A public .env or .git folder hands out every key and the full source.
  jobs.push((async () => {
    out.exposedFiles = [];
    const probes = [['.env', (b) => /^\s*(export\s+)?[A-Z][A-Z0-9_]*\s*=/m.test(b)], ['.env.local', (b) => /^\s*[A-Z][A-Z0-9_]*\s*=/m.test(b)], ['.env.production', (b) => /^\s*[A-Z][A-Z0-9_]*\s*=/m.test(b)], ['.git/config', (b) => /\[core\]/.test(b)]];
    await pool(probes, 4, async ([path, looks]) => {
      try {
        const r = await get(`${origin}/${path}`);
        if (r.res.ok && !/<html|<!doctype/i.test(r.body.slice(0, 500)) && looks(r.body)) {
          out.exposedFiles.push({ path: `/${path}`, severity: 'blocker', problem: `${origin}/${path} is public. ${path.startsWith('.git') ? 'Anyone can download your whole source code and its history, including any keys ever committed.' : 'Anyone can read every key and password in it.'}`, fix: `Delete it from the deployed folder (or block dotfiles in your host's settings), then rotate every key that was in it.${path.startsWith('.git') ? ' Deploy only the built site folder, not the repo.' : ''}` });
        }
      } catch { /* not reachable: fine */ }
    });
  })());

  // A wrong URL should get a real 404, not the home page with status 200.
  jobs.push((async () => {
    const r = await linkStatus(`${origin}/shipkit-404-check-${Math.random().toString(36).slice(2, 8)}`);
    const p = [];
    if (r.status === 200) p.push({ severity: 'fix', problem: 'A made-up URL returns status 200, so broken links look fine and search engines can index junk pages (a "soft 404").', fix: 'Serve a 404 page with status 404. Static hosts do this when there is a 404.html at the root; single-page apps need a catch-all that sets the status.' });
    else if (r.status && r.status !== 404 && r.status !== 410) p.push({ severity: 'minor', problem: `A made-up URL returns ${r.status} instead of 404.`, fix: 'Return 404 for pages that don\'t exist.' });
    out.notFound = { status: r.status ?? null, error: r.error, verdict: r.error ? 'unknown' : verdictOf(p), problems: p };
  })());

  // People type www. (or leave it off). Both should land on the site.
  const labels = host.split('.');
  const twoPart = /\.(co|com|org|net|ac|gov|edu)\.[a-z]{2}$/i.test(host);
  const isApex = labels.length === (twoPart ? 3 : 2);
  if (out.hostKind === 'own-domain' && !/^\d+\.\d+\.\d+\.\d+$/.test(host) && (isApex || (host.startsWith('www.') && labels.length === (twoPart ? 4 : 3)))) {
    const other = host.startsWith('www.') ? host.slice(4) : `www.${host}`;
    jobs.push((async () => {
      const r = await linkStatus(`https://${other}/`);
      let lands = null; try { lands = r.finalUrl ? new URL(r.finalUrl).hostname : null; } catch { /* ignore */ }
      out.altHost = { host: other, status: r.status ?? null, error: r.error, landsOn: lands, works: !r.error && r.status < 400 };
    })());
  }

  // Favicon: the declared icon, or /favicon.ico, which browsers ask for anyway.
  jobs.push((async () => {
    const tries = [out.icons.declared ? new URL(out.icons.declared, f.final).href : null, `${origin}/favicon.ico`].filter(Boolean);
    let ok = false;
    for (const u of tries) { if (/^data:/i.test(u)) { ok = true; break; } const r = await linkStatus(u, 8000); if (r.status === 200) { ok = true; break; } }
    out.icons.favicon = ok;
  })());

  // Links: own pages, the checkout, and a few outside links.
  const l = externalLinks(out, html, f.final);
  jobs.push((async () => {
    const own = await pool(l.own.slice(0, 40), 6, (u) => linkStatus(u));
    const checkout = NO_EXTERNAL ? [] : await pool(l.checkout.slice(0, 8), 4, (u) => linkStatus(u, 15000));
    const outside = NO_EXTERNAL ? [] : await pool(l.outside.slice(0, 12), 6, (u) => linkStatus(u));
    Object.assign(out.linkResults, { own, checkout, outside, checked: { own: own.length, checkout: checkout.length, outside: outside.length, skippedOutside: NO_EXTERNAL } });
  })());

  // Page weight: the images, scripts and styles the HTML asks for (not videos, not lazy JS chunks).
  jobs.push((async () => {
    const assets = assetsOf(html);
    const sized = await pool(assets, 6, async (a) => {
      let u; try { u = new URL(a.ref, f.final).href; } catch { return null; }
      try { const r = await get(u, { bytes: true }); return r.res.ok ? { kind: a.kind, url: u, bytes: r.body.length } : null; } catch { return null; }
    });
    const ok = sized.filter(Boolean);
    Object.assign(out.speed, { assets: ok, totalBytes: ok.reduce((n, a) => n + a.bytes, 0) + out.speed.htmlBytes, heaviest: [...ok].sort((a, b) => b.bytes - a.bytes).slice(0, 3).map((a) => `${a.url} ${(a.bytes / 1024).toFixed(0)} KB`), note: 'Measured once from this machine; scripts and styles counted before compression.' });
  })());

  await Promise.all(jobs);
  finish(out, html, raw);
}

// Local mode: the page doesn't have to be live. Folders that commonly hold a static site's public files.
const PUBLIC_DIRS = ['', 'public', 'static', 'dist', 'out', 'build', 'docs', 'site'];
function findLocal(root, rel) {
  const clean = decodeURIComponent(rel.replace(/^\/+/, '').split(/[?#]/)[0]);
  for (const d of PUBLIC_DIRS) {
    const p = join(root, d, clean);
    if (clean && existsSync(p) && statSync(p).isFile()) return p;
  }
  return null;
}
// A page link resolves the way static hosts resolve it: the file, name.html, or name/index.html.
function resolveLocalPage(root, base, pathname) {
  const clean = decodeURIComponent(pathname.replace(/^\/+/, ''));
  if (!clean) return true;
  const dirs = [base, ...PUBLIC_DIRS.map((d) => join(root, d))];
  for (const d of dirs) for (const c of [clean, `${clean.replace(/\/$/, '')}.html`, join(clean, 'index.html')]) { const p = join(d, c); if (existsSync(p) && statSync(p).isFile()) return true; }
  return false;
}

async function local(path, out) {
  out.mode = 'local';
  const abs = resolve(path);
  let file = abs, root = abs;
  if (statSync(abs).isDirectory()) {
    file = PUBLIC_DIRS.map((d) => join(abs, d, 'index.html')).find((p) => existsSync(p));
    if (!file) throw new Error(`no index.html in ${abs} or its public/, static/, dist/, out/, build/, docs/ or site/ folder. For a framework app, run its dev server and probe http://localhost:<port>, or build it first.`);
    root = abs;
  } else root = dirname(abs);
  out.file = file;
  out.note = 'Local mode: read from disk, nothing deployed or uploaded. Redirects, HTTPS, response headers, www, the 404 status and server speed are only checked against a live URL.';
  const raw = readFileSync(file, 'utf8');
  readHtml(out, raw);
  const html = raw.replace(/<!--[\s\S]*?-->/g, ' ');
  const base = dirname(file);
  // the domain the page says it will live on, for the host checks
  const declared = out.canonical || out.og.url;
  try { if (declared && /^https?:/i.test(declared)) hostFacts(out, new URL(declared).hostname); } catch { /* no declared domain */ }
  const localFile = (ref) => {
    let rel = ref;
    try { if (/^https?:/i.test(ref)) { const u = new URL(ref); if (out.host && u.hostname !== out.host) return null; rel = u.pathname; } } catch { return null; }
    if (/^\/\//.test(rel)) return null;
    const near = join(base, rel.split(/[?#]/)[0]);
    return (!rel.startsWith('/') && existsSync(near) && statSync(near).isFile()) ? near : findLocal(root, rel);
  };

  const ogImg = out.og.image || out.twitter.image;
  if (ogImg) {
    let rel = ogImg;
    try { if (/^https?:/i.test(ogImg)) rel = new URL(ogImg).pathname; } catch { /* keep as is */ }
    const hit = (!rel.startsWith('/') && existsSync(join(base, rel)) && statSync(join(base, rel)).isFile()) ? join(base, rel) : findLocal(root, rel);
    if (hit) {
      const buf = readFileSync(hit);
      out.ogImage = { url: ogImg, declared: ogImg, source: 'local file', localFile: hit, bytes: buf.length, ...imageSize(buf), absolute: /^https?:/i.test(ogImg) };
    } else if (/^https?:/i.test(ogImg)) {
      out.ogImage = await fetchImage(ogImg, ogImg);
      if (out.ogImage.error || (out.ogImage.status && out.ogImage.status !== 200)) out.ogImage.note = 'No local copy, and the absolute URL did not load: fine if the site is not live yet, but make sure the file ships with it.';
    } else {
      out.ogImage = { url: ogImg, declared: ogImg, missingLocal: true, absolute: false };
    }
  }

  // The page's own scripts, from disk.
  const sources = [{ where: 'the page HTML', body: html }];
  for (const m of [...html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].slice(0, 20)) {
    if (/^https?:|^\/\//i.test(m[1])) continue;
    const p = localFile(m[1]);
    if (p) sources.push({ where: p.replace(root + '/', ''), body: readFileSync(p, 'utf8').slice(0, 3_000_000) });
  }
  scanScripts(out, sources);
  if (!out.analytics.length || out.analytics[0].startsWith('a self-hosted')) {
    const found = new Set();
    for (const { body } of sources.slice(1)) for (const [k, re] of Object.entries(ANALYTICS)) if (re.test(body.slice(0, 1_500_000))) found.add(k);
    if (found.size) { out.analytics = [...found]; out.analyticsInBundle = true; }
  }

  // Secret files sitting in the folder that gets uploaded.
  out.exposedFiles = [];
  for (const n of readdirSync(base)) {
    if (/^\.env(\..+)?$/.test(n) && !/\.(example|sample|template)$/.test(n)) out.exposedFiles.push({ path: join(base, n), severity: 'fix', problem: `${n} sits in ${base === root ? 'the project folder' : base.replace(root + '/', '') + '/'}, next to the page with the page. If this folder is uploaded as it is, the file goes public with every key in it.`, fix: 'Keep env files out of the folder you deploy (or make sure your host skips dotfiles), and check the live URL /.env returns 404 after deploying.' });
  }

  for (const p of ['robots.txt', 'sitemap.xml', 'llms.txt']) {
    const hit = findLocal(root, p);
    if (!hit) { out[p] = { present: false }; continue; }
    const body = readFileSync(hit, 'utf8');
    out[p] = { present: true, file: hit, bytes: body.length, ...(p === 'robots.txt' ? robotsFacts(body) : {}), ...(p === 'sitemap.xml' ? { urls: (body.match(/<loc>/g) || []).length } : {}) };
  }

  const nf = findLocal(root, '404.html');
  out.notFound = nf ? { file: nf, verdict: 'ok', problems: [] } : { verdict: 'unknown', problems: [], note: 'No 404.html in the folder. Many hosts and frameworks add one; check a made-up URL on the live site.' };

  out.icons.favicon = (out.icons.declared && (/^data:/i.test(out.icons.declared) || /^https?:/i.test(out.icons.declared) || !!localFile(out.icons.declared))) || !!findLocal(root, 'favicon.ico');

  // Links: own pages must exist on disk; checkout and outside links are checked on the network.
  const siteBase = out.host ? `https://${out.host}/` : 'https://local.invalid/';
  const l = externalLinks(out, html, siteBase);
  const ownMissing = l.own.filter((u) => !resolveLocalPage(root, base, new URL(u).pathname)).map((u) => ({ url: new URL(u).pathname, status: 404, note: 'no such file in the folder' }));
  const checkout = NO_EXTERNAL ? [] : await pool(l.checkout.slice(0, 8), 4, (u) => linkStatus(u, 15000));
  const outside = NO_EXTERNAL ? [] : await pool(l.outside.slice(0, 12), 6, (u) => linkStatus(u));
  Object.assign(out.linkResults, { own: ownMissing, checkout, outside, checked: { own: l.own.length, checkout: checkout.length, outside: outside.length, skippedOutside: NO_EXTERNAL } });

  // Page weight from the files on disk.
  const assets = assetsOf(html).map((a) => { const p = /^https?:|^\/\//i.test(a.ref) && !(out.host && a.ref.includes(out.host)) ? null : localFile(a.ref); return p ? { kind: a.kind, url: a.ref, bytes: statSync(p).size } : null; }).filter(Boolean);
  out.speed = { htmlBytes: Buffer.byteLength(raw), assets, totalBytes: assets.reduce((n, a) => n + a.bytes, 0) + Buffer.byteLength(raw), heaviest: [...assets].sort((a, b) => b.bytes - a.bytes).slice(0, 3).map((a) => `${a.url} ${(a.bytes / 1024).toFixed(0)} KB`), note: 'Local files only; outside scripts and fonts are not counted, and server speed needs a live URL.' };

  finish(out, html, raw);
}

const NO_EXTERNAL = process.argv.includes('--no-external');

async function main() {
  const input = process.argv.slice(2).find((a) => !a.startsWith('--'));
  if (!input) {
    console.error('usage: node check-site.mjs <url | folder | file.html> [--no-external]');
    process.exit(2);
  }
  const out = { input, checkedAt: new Date().toISOString(), probe: '0.6' };
  try {
    const isUrl = /^https?:\/\//i.test(input);
    if (!isUrl && existsSync(input)) await local(input, out);
    else if (!isUrl && /^[./~]|\/$/.test(input)) throw new Error(`${input} doesn't exist. Give a folder, an HTML file, or a URL.`);
    else await live(isUrl ? input : `https://${input}`, out);
    if (out.og) out.shareImage = ogImageProblems(out.ogImage, { og: out.og, twitter: out.twitter, declared: out.ogImageDeclared });
    // A share image left over from an AI builder's template loads fine, but it isn't the maker's.
    const tpl = out.leftovers?.problems.find((p) => /AI builder's own defaults/.test(p.problem));
    if (tpl && out.shareImage) { out.shareImage.problems.unshift({ severity: 'blocker', id: 'template-image', problem: tpl.problem, fix: tpl.fix }); out.shareImage.verdict = 'blocker'; }
    if (out.botChallenge && out.shareImage) out.shareImage = { verdict: 'unknown', problems: [{ severity: 'fix', id: 'bot-check', problem: out.botChallenge.note, fix: 'Paste the link into a private X draft or a DM to yourself and look at the card.' }] };
    if (out.verdicts && !out.botChallenge) out.verdicts['B4 share preview'] = out.shareImage?.verdict;
  } catch (e) {
    out.error = String(e.message || e);
  }
  console.log(JSON.stringify(out, null, 2));
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('check-site.mjs')) await main();
