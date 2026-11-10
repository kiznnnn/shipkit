#!/usr/bin/env node
// Ship Kit share preview: how the page's link will look when it's pasted into X, iMessage, LinkedIn, Slack and Discord.
// Reads the probe's JSON (node check-site.mjs <site> > .shipkit/probe.json) and writes, in --out (default .shipkit):
//   share-preview.html   five approximate mock-ups side by side, built only from the page's own tags
//   share-preview.png    a screenshot of it, when Chrome or Chromium is installed (skip with --no-png)
// No dependencies; needs Node 18+. Nothing is uploaded or posted.
//   node share-preview.mjs .shipkit/probe.json --out .shipkit

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve, extname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const cut = (s, n) => { s = String(s ?? '').trim(); return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s; };

export function previewData(p) {
  const img = p.ogImage;
  let src = null;
  if (img?.localFile && existsSync(img.localFile) && img.bytes <= 5 * 1048576) {
    const type = { png: 'image/png', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' }[img.type] || 'image/png';
    src = `data:${type};base64,${readFileSync(img.localFile).toString('base64')}`;
  } else if (img?.url && /^https?:/i.test(img.url) && !img.error && (!img.status || img.status === 200) && !['svg', 'html'].includes(img.type)) src = img.url;
  else if (img?.url && p.finalUrl && !img.error && img.status === 200 && !['svg', 'html'].includes(img.type)) src = new URL(img.url, p.finalUrl).href;
  return {
    src,
    title: p.og?.title || p.title || p.host || 'Untitled',
    description: p.og?.description || p.description || '',
    domain: p.host || (p.finalUrl ? new URL(p.finalUrl).hostname : 'your-site'),
    large: p.twitter?.card === 'summary_large_image',
    imageNote: !img ? 'no share image' : src ? `${img.width ?? '?'}×${img.height ?? '?'} ${String(img.type || '').toUpperCase()}` : `share image can't be shown (${img.type === 'svg' ? 'SVG' : img.missingLocal ? 'file missing' : img.error || img.status || img.type})`,
    verdict: p.shareImage?.verdict ?? 'unknown',
  };
}

export function previewHtml(d) {
  const t = esc(d.title), ds = esc(d.description), dom = esc(d.domain);
  const pic = (cls) => d.src ? `<div class="${cls}" style="background-image:url('${d.src.replace(/'/g, '%27')}')"></div>` : `<div class="${cls} none">no image</div>`;
  const x = d.large && d.src
    ? `<div class="x-card">${pic('x-img')}<span class="x-over">${esc(cut(d.title, 70))}</span></div><div class="x-from">From ${dom}</div>`
    : `<div class="x-small">${pic('x-thumb')}<div><div class="muted">${dom}</div><div>${esc(cut(d.title, 70))}</div><div class="muted">${esc(cut(d.description, 100))}</div></div></div>`;
  const verdictColor = { ok: '#9be15d', fix: '#f5a623', blocker: '#ff4d4f' }[d.verdict] || '#999';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Share preview: ${dom}</title>
<style>
*{box-sizing:border-box}body{margin:0;padding:32px;background:#f2f3f5;font:15px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#0f1419}
h1{font-size:20px;margin:0 0 4px}.sub{color:#536471;margin:0 0 24px;max-width:900px}.pill{display:inline-block;padding:2px 10px;border-radius:99px;font-weight:600;color:#111;background:${verdictColor}}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(360px,1fr));gap:24px;max-width:1200px}
.app{background:#fff;border-radius:14px;padding:16px;box-shadow:0 1px 2px rgba(0,0,0,.08)}.app h2{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#536471;margin:0 0 12px}
.muted{color:#536471;font-size:13px}.none{display:flex;align-items:center;justify-content:center;color:#8b98a5;background:#e7e9ea!important;font-size:13px}
.x-card{position:relative;border:1px solid #cfd9de;border-radius:16px;overflow:hidden}.x-img{aspect-ratio:1.91/1;background:center/cover no-repeat}
.x-over{position:absolute;left:12px;bottom:12px;background:rgba(0,0,0,.77);color:#fff;font-size:13px;padding:2px 6px;border-radius:4px;max-width:85%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.x-from{color:#536471;font-size:13px;margin-top:4px}.x-small{display:flex;gap:12px;border:1px solid #cfd9de;border-radius:16px;overflow:hidden;align-items:center;padding-right:12px}.x-thumb{width:130px;height:130px;flex:none;background:center/cover no-repeat}
.im{max-width:300px;border-radius:18px;overflow:hidden;background:#e9e9eb;margin-left:auto}.im-img{aspect-ratio:1.91/1;background:center/cover no-repeat}.im-t{padding:8px 12px 10px}.im-t b{display:block;font-size:14px;line-height:1.25;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.li{border:1px solid #e0dfdc;border-radius:8px;overflow:hidden}.li-img{aspect-ratio:1.91/1;background:center/cover no-repeat}.li-t{padding:8px 12px;background:#eef3f8}.li-t b{display:block;font-size:14px}
.sl{border-left:4px solid #dddddd;padding-left:12px}.sl b{display:block;font-size:14px}.sl a{color:#1264a3;font-weight:700;text-decoration:none;display:block;margin:2px 0}.sl-img{width:100%;max-width:360px;aspect-ratio:1.91/1;border-radius:8px;margin-top:8px;background:center/cover no-repeat}
.dc{background:#2b2d31;color:#dbdee1;border-left:4px solid #1e1f22;border-radius:4px;padding:12px 16px}.dc .s{font-size:12px;color:#b5bac1}.dc a{color:#00a8fc;font-weight:600;text-decoration:none;display:block;margin:4px 0}.dc-img{width:100%;aspect-ratio:1.91/1;border-radius:4px;margin-top:12px;background:center/cover no-repeat}
@media (max-width:480px){body{padding:16px}.grid{grid-template-columns:1fr}}
</style></head><body>
<h1>How ${dom} looks when it's shared</h1>
<p class="sub">Share preview: <span class="pill">${esc(d.verdict.toUpperCase())}</span> · ${esc(d.imageNote)}. These are approximate mock-ups built from the page's own tags, following each app's layout as of November 2026. Apps change their cards, so paste the link into a private draft or a DM to yourself to see the real thing.</p>
<div class="grid">
<section class="app"><h2>X</h2>${x}</section>
<section class="app"><h2>iMessage</h2><div class="im">${pic('im-img')}<div class="im-t"><b>${esc(cut(d.title, 90))}</b><span class="muted">${dom}</span></div></div></section>
<section class="app"><h2>LinkedIn</h2><div class="li">${pic('li-img')}<div class="li-t"><b>${esc(cut(d.title, 110))}</b><span class="muted">${dom}</span></div></div></section>
<section class="app"><h2>Slack</h2><div class="sl"><b>${dom}</b><a>${esc(cut(d.title, 110))}</a><div>${esc(cut(d.description, 200))}</div>${pic('sl-img')}</div></section>
<section class="app"><h2>Discord</h2><div class="dc"><div class="s">${dom}</div><a>${esc(cut(d.title, 110))}</a><div>${esc(cut(d.description, 200))}</div>${pic('dc-img')}</div></section>
</div></body></html>`;
}

function chrome() {
  const paths = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
  return paths.find((p) => existsSync(p)) || null;
}

async function main() {
  const file = args.find((a) => !a.startsWith('--') && extname(a) === '.json');
  if (!file) { console.error('usage: node share-preview.mjs <probe.json> [--out .shipkit] [--no-png]'); process.exit(2); }
  const probe = JSON.parse(readFileSync(file, 'utf8'));
  if (probe.error) { console.error(`The probe couldn't read the page: ${probe.error}`); process.exit(1); }
  const out = resolve(opt('out', '.shipkit'));
  mkdirSync(out, { recursive: true });
  const html = previewHtml(previewData(probe));
  writeFileSync(join(out, 'share-preview.html'), html);
  const written = [join(out, 'share-preview.html')];
  const c = !flag('no-png') && chrome();
  if (c) {
    try {
      execFileSync(c, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1', '--virtual-time-budget=5000', '--window-size=1264,1000', `--screenshot=${join(out, 'share-preview.png')}`, pathToFileURL(join(out, 'share-preview.html')).href], { stdio: 'ignore', timeout: 30000 });
      written.push(join(out, 'share-preview.png'));
    } catch { /* the HTML is enough */ }
  }
  console.log(written.join('\n'));
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href || process.argv[1]?.endsWith('share-preview.mjs')) await main();
