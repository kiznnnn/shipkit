#!/usr/bin/env node
// Ship Kit site probe. Reports the launch-relevant facts of a page as JSON.
// No dependencies; needs Node 18+.
//   node check-site.mjs https://yoursite.com     a live site (only sends GET requests)
//   node check-site.mjs ./site                    a local folder with index.html: the page doesn't have to be live
//   node check-site.mjs ./site/pricing.html       a local HTML file
// In local mode it reads the files from disk, resolves the share image to the local file, and only touches
// the network if the share image is an absolute URL with no local copy.

import { readFileSync, existsSync, statSync } from 'node:fs';
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

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36 shipkit-check/0.5';

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
function linkHref(html, rel) {
  const re = new RegExp(`<link[^>]+rel=["'][^"']*\\b${rel}\\b[^"']*["'][^>]*>`, 'i');
  const tag = html.match(re)?.[0];
  return tag ? tag.match(/href=["']([^"']*)["']/i)?.[1] ?? '' : null;
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

// Everything that can be read from the HTML alone, live or local.
function readHtml(out, raw) {
  out.bytes = Buffer.byteLength(raw);
  // HTML comments aren't on the page: a commented-out analytics snippet or "<!-- price -->" note must not count.
  const html = raw.replace(/<!--[\s\S]*?-->/g, ' ');
  out.title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? null;
  out.description = meta(html, 'description');
  out.viewport = meta(html, 'viewport');
  out.lang = html.match(/<html[^>]*\blang=["']([^"']+)/i)?.[1] ?? null;
  out.h1 = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => text(m[1])).slice(0, 3);
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
    title: meta(html, 'og:title'), description: meta(html, 'og:description'), image: meta(html, 'og:image'),
    url: meta(html, 'og:url'), type: meta(html, 'og:type'),
  };
  out.twitter = { card: meta(html, 'twitter:card'), image: meta(html, 'twitter:image'), site: meta(html, 'twitter:site') };
  out.ogImageDeclared = { width: meta(html, 'og:image:width'), height: meta(html, 'og:image:height'), alt: meta(html, 'og:image:alt') };
  out.analytics = Object.entries(ANALYTICS).filter(([, re]) => re.test(html)).map(([k]) => k);
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

async function live(url, out) {
  out.mode = 'live';
  const http = url.replace(/^https:/, 'http:');
  if (http !== url) {
    try { const h = await follow(http); out.httpRedirectsToHttps = h.final.startsWith('https:'); } catch { out.httpRedirectsToHttps = null; }
  }
  const f = await follow(url);
  out.redirects = f.chain;
  out.finalUrl = f.final;
  out.status = f.res?.status ?? null;
  const host = new URL(f.final).hostname;
  hostFacts(out, host);
  out.hsts = f.res?.headers.get('strict-transport-security') ?? null;
  out.xRobotsTag = f.res?.headers.get('x-robots-tag') ?? null;
  const html = f.res ? await f.res.text() : '';
  readHtml(out, html);

  const ogImg = out.og.image || out.twitter.image;
  if (ogImg) out.ogImage = await fetchImage(new URL(ogImg, f.final).href, ogImg);

  if (!out.analytics.length) {
    // Bundled apps (Next.js, Vite) keep analytics inside their own JavaScript, not the HTML.
    const own = [...new Set([...html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].map((m) => { try { return new URL(m[1], f.final); } catch { return null; } }).filter((u) => u && u.hostname === host).map((u) => u.href))].slice(0, 12);
    const found = new Set();
    await Promise.all(own.map(async (u) => { try { const r = await get(u); const js = r.body.slice(0, 1_500_000); for (const [k, re] of Object.entries(ANALYTICS)) if (re.test(js)) found.add(k); } catch { /* skip unreadable script */ } }));
    out.analytics = [...found];
    if (found.size) out.analyticsInBundle = true;
  }

  const origin = new URL(f.final).origin;
  for (const p of ['robots.txt', 'sitemap.xml', 'llms.txt']) {
    try {
      const r = await get(`${origin}/${p}`);
      const ok = r.res.ok && !/<html/i.test(r.body.slice(0, 300));
      out[p] = { status: r.res.status, present: ok, bytes: ok ? r.body.length : 0, ...(p === 'robots.txt' && ok ? robotsFacts(r.body) : {}), ...(p === 'sitemap.xml' && ok ? { urls: (r.body.match(/<loc>/g) || []).length } : {}) };
    } catch (e) { out[p] = { error: String(e.message || e) }; }
  }
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

async function local(path, out) {
  out.mode = 'local';
  const abs = resolve(path);
  let file = abs, root = abs;
  if (statSync(abs).isDirectory()) {
    file = PUBLIC_DIRS.map((d) => join(abs, d, 'index.html')).find((p) => existsSync(p));
    if (!file) throw new Error(`no index.html in ${abs} or its public/, static/, dist/, out/, build/, docs/ or site/ folder`);
    root = abs;
  } else root = dirname(abs);
  out.file = file;
  out.note = 'Local mode: read from disk, nothing deployed or uploaded. Redirects, HTTPS, response headers and hosting are only checked against a live URL.';
  const html = readFileSync(file, 'utf8');
  readHtml(out, html);
  // the domain the page says it will live on, for the host checks
  const declared = out.canonical || out.og.url;
  try { if (declared && /^https?:/i.test(declared)) hostFacts(out, new URL(declared).hostname); } catch { /* no declared domain */ }

  const ogImg = out.og.image || out.twitter.image;
  if (ogImg) {
    let rel = ogImg;
    try { if (/^https?:/i.test(ogImg)) rel = new URL(ogImg).pathname; } catch { /* keep as is */ }
    const base = dirname(file);
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

  if (!out.analytics.length) {
    const found = new Set();
    for (const m of [...html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].slice(0, 12)) {
      if (/^https?:|^\/\//i.test(m[1])) continue;
      const p = findLocal(root, m[1]) || (existsSync(join(dirname(file), m[1])) ? join(dirname(file), m[1]) : null);
      if (!p) continue;
      const js = readFileSync(p, 'utf8').slice(0, 1_500_000);
      for (const [k, re] of Object.entries(ANALYTICS)) if (re.test(js)) found.add(k);
    }
    out.analytics = [...found];
    if (found.size) out.analyticsInBundle = true;
  }

  for (const p of ['robots.txt', 'sitemap.xml', 'llms.txt']) {
    const hit = findLocal(root, p);
    if (!hit) { out[p] = { present: false }; continue; }
    const body = readFileSync(hit, 'utf8');
    out[p] = { present: true, file: hit, bytes: body.length, ...(p === 'robots.txt' ? robotsFacts(body) : {}), ...(p === 'sitemap.xml' ? { urls: (body.match(/<loc>/g) || []).length } : {}) };
  }
}

async function main() {
  const input = process.argv[2];
  if (!input) {
    console.error('usage: node check-site.mjs <url | folder | file.html>');
    process.exit(2);
  }
  const out = { input, checkedAt: new Date().toISOString() };
  try {
    const isUrl = /^https?:\/\//i.test(input);
    if (!isUrl && existsSync(input)) await local(input, out);
    else await live(isUrl ? input : `https://${input}`, out);
    if (out.og) out.shareImage = ogImageProblems(out.ogImage, { og: out.og, twitter: out.twitter, declared: out.ogImageDeclared });
  } catch (e) {
    out.error = String(e.message || e);
  }
  console.log(JSON.stringify(out, null, 2));
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('check-site.mjs')) await main();
