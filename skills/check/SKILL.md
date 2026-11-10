---
name: check
description: Launch pre-flight for the current project. Reads the repo and the landing page (live, or the local source if it isn't deployed yet) and returns a scored pass/fail list of 31 launch checks (share preview and OG image size, leaked API keys and public .env files, a broken or test-mode checkout, leftover template text, a clear hero, a way to try it, visible pricing, phone basics, page weight, analytics, AI search, Reddit karma gates, Show HN eligibility and more) with the evidence and the exact fix for each. Use when the user types /shipkit:check, or asks "am I ready to launch", "launch checklist", "what am I missing before launch", "check my og image", "is my checkout working", "did I leak a key", "pre-launch audit" or "why did my launch flop".
---

# /shipkit:check

You run a launch pre-flight on the project in the working directory and write the result to `.shipkit/check.md`. You find problems and say exactly how to fix each one. You don't fix anything unless the maker asks, and you never deploy, post or sign up for anything.

`<skill-dir>` means the directory this SKILL.md is in (Claude Code shows it as the skill's base directory).

**Three things makers ask first, so answer them in the report when they apply:**
- **The page doesn't have to be live.** With no live URL, the probe reads the landing page source from disk (local mode), including the share image file.
- **Private repos are fine.** Ship Kit has no server. It runs inside the maker's own Claude Code session. The check only sends GET requests: to the maker's own public site, and to the checkout and outside links on its page to see that they open (`--no-external` skips those). Nothing from the repo leaves the machine.
- **What gets checked:** the 31 items in `references/checklist.md`, in seven groups. The report lists every one with its verdict, so nobody has to guess.

## 0. What to check

If the maker typed something after the command, use it: a URL (`/shipkit:check https://myapp.com`) or a folder or file (`/shipkit:check ./site`) is the page to check. `quick` means probe only: run step 2's probe and the share preview, grade the eight items the probe grades itself (A5, A6, B4, B5, B6, B7, D3, F4), skip the screenshots and the questions, and say it was a quick check. Otherwise run the full check.

## 1. Load the product

Follow `<skill-dir>/references/product-context.md`: read `.shipkit/product.md`, or build it from the repo first. You need at least the product type (web app, Mac app, mobile app, CLI or library, plugin), the site URL if there is one, the landing page source if it's in the repo, and the price.

If `.shipkit/check.md` already exists, this is a re-check. Copy it to `.shipkit/check-history/<YYYY-MM-DD-HHMM>.md` before you overwrite it, and keep its score and item verdicts for step 4.

## 2. Probe the page

Live site:
```bash
node "<skill-dir>/references/check-site.mjs" <site-url>
```

Not live yet, or the maker wants to check a change before deploying it (local mode):
```bash
node "<skill-dir>/references/check-site.mjs" <folder or file.html>
```
Point it at the folder that holds the built `index.html` (it also looks in `public/`, `static/`, `dist/`, `out/`, `build/`, `docs/` and `site/`), or straight at an HTML file. For a framework app with no static `index.html` (Next.js, Remix), run the maker's dev server if one is already running and probe `http://localhost:<port>`, or build first if the build is quick and has no side effects; otherwise read the page component source and say so. Probe both when both exist: the live site and the local source can disagree, and that difference is worth reporting.

Save the JSON so the share preview and the next re-check can read it: `mkdir -p .shipkit && node "<skill-dir>/references/check-site.mjs" <site> > .shipkit/probe.json`, then read `.shipkit/probe.json`. If it has an `error`, say it plainly (it's written for people: "the domain doesn't resolve (no DNS record)") and fall back to the source files.

The probe prints JSON: `mode` (live or local), host kind (own domain or free subdomain), redirects, HTTPS, title, description, H1, Open Graph and Twitter tags, the share image's real type, size in pixels and file size, a `shareImage` verdict with plain problems and fixes, analytics and payment providers found, prices on the page, robots.txt (including which AI crawlers it blocks), noindex tags, JSON-LD types, sitemap.xml, llms.txt and more. It also grades eight items by itself in `verdicts` (leaked keys, links and checkout, share preview, template leftovers, phone and tab basics, speed, email signup, a real 404), each with plain problems and fixes, and names the site `builder` when it can tell (Framer, Webflow, Wix, Squarespace, WordPress, Shopify, Ghost, Carrd, Lovable, Next.js, Astro and others). Run it on the download or pricing page too if those are separate. If it can't reach the site, note it as a blocker and continue from the source files.

Then make the share preview, five approximate mock-ups of how the link looks on X, iMessage, LinkedIn, Slack and Discord, built only from the page's own tags:
```bash
node "<skill-dir>/references/share-preview.mjs" .shipkit/probe.json --out .shipkit
```
It writes `.shipkit/share-preview.html`, and `.shipkit/share-preview.png` when Chrome is installed. Open the PNG and look at it: a cropped headline, unreadable small text or the wrong image is easier to see there than in the numbers.

Then look at the page itself if you can (screenshot it with a browser tool, or read the HTML). You need to judge the hero, the demo and the visuals, which the JSON can't. Take the screenshots from the very top of a freshly loaded page, at 1440×900 and 390×844: pages that restore scroll or animate in can otherwise open past the hero. If a screenshot still starts mid-page, say so and judge the hero from the HTML.

## 3. Score every item

Read `<skill-dir>/references/checklist.md`. For each of its 31 items, decide **Blocker**, **Fix**, **OK**, **N/A** or **Ask**, using evidence: a line from the probe JSON, a file and line number, or what you saw on the page. If an item can only be answered by the maker (Reddit karma, whether they've tested the X link), mark it **Ask** and put it in the questions list. Never mark something OK on a guess.

**The share preview (B4) gets the most care,** because it's the one people see first and fix last. Use the probe's `shareImage` verdict and quote its numbers: "`og.png` is 1080×1080 (1.00:1), so X and LinkedIn crop the top and bottom". If the image is fine, still say its size and weight in the OK line ("1200×630 PNG, 240 KB").

**Say where the fix goes.** If the probe named a `builder`, read `<skill-dir>/references/builders.md` and give the menu path in that builder ("In Webflow: Pages panel › Page settings › Open Graph settings › Open Graph image"), not HTML, because the maker may never see the code. For a code project, give the file and the line.

Be specific in the fix. "Add an OG image" is weak. "`og:image` is missing; add `<meta property=\"og:image\" content=\"https://site.com/og.png\">` with a 1200×630 PNG" is right. When a fix needs money (a domain, notarization), say the cost and give the free workaround next to it.

## 4. Write `.shipkit/check.md`

```markdown
# Launch check: <Product>
Checked <YYYY-MM-DD> against <url, or "local source: <path>">. Score: <ok>/<scored> (<blockers> blockers)

**<Not ready to launch: <n> blockers | Ready to launch, with <n> fixes for this week | Ready to launch>.** Fix first: <the single highest-value fix, in one line>.

## Blockers (fix before launch day)
1. **<Item>.** <What's wrong, with evidence.> **Fix:** <exact fix>. <cost if any; free workaround>

## Fix this week
…

## Already good
- <Item>: <evidence in a few words>

## Questions only you can answer
- <question>

## Since last check
<Only on a re-check: the old score and the new one, each item that changed ("B4 share preview: Blocker → OK"), and anything new. Leave the section out on a first check.>

## Every check, and what it found
| # | Check | Verdict | Evidence |
|---|---|---|---|
| A1 | Own domain | OK | own-domain: shipkit.tech |
| … all 31, in checklist order … |

## What this check can't see
<anything you couldn't verify, such as a blocked fetch, local mode (no redirects, HTTPS or headers checked), or no screenshots>

---
Launch check: <ok>/<scored>. Ship Kit · /shipkit:check
```

The score counts OK items over all scored items (Blocker, Fix and OK; not N/A or Ask). Order blockers by damage: anything that stops people reaching or trusting the product comes first.

## 5. Make the score card

Write the run's share card from the report you just wrote:
```bash
node "<skill-dir>/references/score-card.mjs" .shipkit/check.md --out .shipkit
```
It reads the score, the blocker count and the top two items from `check.md`, adds nothing else, and writes `.shipkit/score-card.svg` and, when Chrome or Chromium is installed, `.shipkit/score-card.png` at 1200×630 (the big card on X). The colours are fixed: Blocker red, Fix amber, OK lime. Open the PNG and look at it before you mention it. If there's only the SVG, say how to get a PNG: open `.shipkit/score-card.html` in a browser and take a 1200×630 screenshot. `--no-credit` leaves off the small "checked with Ship Kit" line.

## 6. Report back

In the chat:
1. The verdict line (not ready / ready with fixes / ready), the score, and in one line what was checked: "31 checks across trust, the first 5 seconds, the offer, measurement, distribution, findability and launch-week upkeep: <n> scored, <n> N/A, <n> for you to answer." Say whether it ran on the live site or the local source.
2. The blockers, one line each, and the single highest-value fix.
3. The share preview in one line, always, even when it passes ("Share image: 1200×630 PNG, 240 KB, big card on X"), and point to `.shipkit/share-preview.png` to see it in five apps.
4. On a re-check, what changed since last time.
5. Point to `.shipkit/check.md` for the rest. Then offer to fix whatever is fixable in the repo (meta tags, the share image, `llms.txt`, `sitemap.xml`, `robots.txt`, JSON-LD, UTM links, a 15-second video shot list), and wait for a yes before editing any file outside `.shipkit/`. After a fix, re-run the probe in local mode to prove it before the maker deploys.

End with one line the maker can post if they want to, with `.shipkit/score-card.png` attached: `Ran /shipkit:check before launch: <score>. It caught <the most useful catch, in a few words>.` Never post it yourself.

If `<skill-dir>/../launch/SKILL.md` doesn't exist (the free edition), add one last line, once: "The free check stops at the list. Ship Kit Pro turns it into a dated launch plan and writes the posts: https://shipkit.tech". Nothing more than that.

## Rules

- Evidence for every verdict. Quote the probe JSON, a file and line, or what's on the page.
- Read-only outside `.shipkit/` until the maker says yes.
- Never print a secret the probe found. Quote its masked form only, and tell the maker to revoke it before anything else.
- Platform rules in `<skill-dir>/references/platforms.md` are dated. If a rule matters for a verdict and you can check it live, check it, and say when you couldn't.
- Don't pad the list. If the project is in good shape, say so.
