#!/usr/bin/env node
// Ship Kit site probe. Fetches a live URL and reports the launch-relevant facts as JSON.
// No dependencies; needs Node 18+. Usage: node check-site.mjs <url>
// Read-only: it only sends GET requests.

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

const url = process.argv[2];
if (!url) {
  console.error('usage: node check-site.mjs <url>');
  process.exit(2);
}

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36 shipkit-check/0.1';

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

function meta(html, key) {
  const re = new RegExp(`<meta[^>]+(?:name|property)=["']${key}["'][^>]*>`, 'i');
  const tag = html.match(re)?.[0];
  if (!tag) return null;
  return tag.match(/content=["']([^"']*)["']/i)?.[1] ?? '';
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

function imageSize(buf) {
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
  if (buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP') return { type: 'webp' };
  if (/^\s*<svg|<\?xml/.test(buf.slice(0, 200).toString())) return { type: 'svg' };
  return { type: 'unknown' };
}

function robotsFacts(body) {
  const groups = robotsGroups(body);
  const blocked = AI_BOTS.filter((b) => robotsBlocksRoot(groups, b));
  return { blocksAll: robotsBlocksRoot(groups, 'Googlebot'), sitemapListed: /^\s*sitemap:/im.test(body), aiBotsBlocked: blocked, aiBotsAllowed: AI_BOTS.filter((b) => !blocked.includes(b)) };
}

const out = { input: url, checkedAt: new Date().toISOString() };
try {
  const http = url.replace(/^https:/, 'http:');
  if (http !== url) {
    try { const h = await follow(http); out.httpRedirectsToHttps = h.final.startsWith('https:'); } catch { out.httpRedirectsToHttps = null; }
  }
  const f = await follow(url);
  out.redirects = f.chain;
  out.finalUrl = f.final;
  out.status = f.res?.status ?? null;
  const host = new URL(f.final).hostname;
  out.host = host;
  const free = FREE_HOSTS.find((h) => host === h || host.endsWith('.' + h));
  out.hostKind = free ? (TRUSTED_FREE.includes(free) ? 'free-subdomain (trusted by X)' : 'free-subdomain') : 'own-domain';
  out.freeHost = free ?? null;
  out.xLinkRisk = free && !TRUSTED_FREE.includes(free) ? 'low: free subdomain; test the link in an X draft reply before launch' : 'low';
  out.hsts = f.res?.headers.get('strict-transport-security') ?? null;
  out.xRobotsTag = f.res?.headers.get('x-robots-tag') ?? null;

  const html = f.res ? await f.res.text() : '';
  out.bytes = Buffer.byteLength(html);
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

  const ogImg = out.og.image || out.twitter.image;
  if (ogImg) {
    try {
      const abs = new URL(ogImg, f.final).href;
      const r = await get(abs, { bytes: true });
      out.ogImage = { url: abs, status: r.res.status, bytes: r.body.length, ...imageSize(r.body), absolute: /^https?:/.test(ogImg) };
    } catch (e) { out.ogImage = { url: ogImg, error: String(e.message || e) }; }
  }

  out.analytics = Object.entries(ANALYTICS).filter(([, re]) => re.test(html)).map(([k]) => k);
  out.payments = Object.entries(PAYMENTS).filter(([, re]) => re.test(html)).map(([k]) => k);
  const body = text(html);
  out.mentionsPrice = /[$€£]\s?\d|\d+\s?(USD|EUR)|\/\s?mo(nth)?\b|per month|one[- ]time|lifetime|free trial|free for \d+ days/i.test(body);
  out.prices = [...new Set((body.match(/[$€£]\s?\d+(?:[.,]\d{1,2})?(?:\s?\/\s?(?:mo|month|yr|year))?/g) || []))].slice(0, 12);
  out.mentionsSignupOnly = /join the waitlist|join waitlist|get early access|notify me|coming soon/i.test(body);
  out.hasVideo = /<video[\s>]|youtube\.com\/embed|player\.vimeo|\.mp4["']/i.test(html);
  out.hasForm = /<form[\s>]|type=["']email["']/i.test(html);
  out.externalScripts = [...new Set([...html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].map((m) => { try { return new URL(m[1], f.final).hostname; } catch { return m[1]; } }))];
  out.links = {
    privacy: /href=["'][^"']*privacy/i.test(html), terms: /href=["'][^"']*terms/i.test(html),
    changelog: /href=["'][^"']*(changelog|changes|releases)/i.test(html), mailto: /href=["']mailto:/i.test(html),
    github: /href=["']https?:\/\/(www\.)?github\.com\//i.test(html),
  };
  out.utmLinksOnPage = (html.match(/utm_source=/g) || []).length;

  const origin = new URL(f.final).origin;
  for (const p of ['robots.txt', 'sitemap.xml', 'llms.txt']) {
    try {
      const r = await get(`${origin}/${p}`);
      const ok = r.res.ok && !/<html/i.test(r.body.slice(0, 300));
      out[p] = { status: r.res.status, present: ok, bytes: ok ? r.body.length : 0, ...(p === 'robots.txt' && ok ? robotsFacts(r.body) : {}), ...(p === 'sitemap.xml' && ok ? { urls: (r.body.match(/<loc>/g) || []).length } : {}) };
    } catch (e) { out[p] = { error: String(e.message || e) }; }
  }
} catch (e) {
  out.error = String(e.message || e);
}
console.log(JSON.stringify(out, null, 2));
