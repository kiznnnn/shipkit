---
name: check
description: Launch pre-flight for the current project. Reads the repo, probes the live site, and returns a scored pass/fail list of what will hurt the launch (an untrusted domain, missing share previews, no way to try it, hidden pricing, no analytics, Reddit karma gates, Show HN eligibility) with the exact fix for each. Use when the user types /shipkit:check, or asks "am I ready to launch", "launch checklist", "what am I missing before launch", "pre-launch audit" or "why did my launch flop".
---

# /shipkit:check

You run a launch pre-flight on the project in the working directory and write the result to `.shipkit/check.md`. You find problems and say exactly how to fix each one. You don't fix anything unless the maker asks, and you never deploy, post or sign up for anything.

`<skill-dir>` means the directory this SKILL.md is in (Claude Code shows it as the skill's base directory).

## 1. Load the product

Follow `<skill-dir>/references/product-context.md`: read `.shipkit/product.md`, or build it from the repo first. You need at least the product type (web app, Mac app, mobile app, CLI or library, plugin), the site URL, and the price. If there's no live URL, say so and check the local landing page source instead.

## 2. Probe the live site

```bash
node "<skill-dir>/references/check-site.mjs" <site-url>
```

It prints JSON: host kind (own domain or free subdomain), redirects, HTTPS, title, description, H1, Open Graph and Twitter tags, the OG image's real size, analytics and payment providers found, prices on the page, robots.txt (including which AI crawlers it blocks), noindex tags, JSON-LD types, sitemap.xml, llms.txt and more. Run it on the download or pricing page too if those are separate. If it can't reach the site, note it as a blocker and continue from the source files.

Then look at the page itself if you can (screenshot it with a browser tool, or read the HTML). You need to judge the hero, the demo and the visuals, which the JSON can't. Take the screenshots from the very top of a freshly loaded page, at 1440×900 and 390×844: pages that restore scroll or animate in can otherwise open past the hero. If a screenshot still starts mid-page, say so and judge the hero from the HTML.

## 3. Score every item

Read `<skill-dir>/references/checklist.md`. For each item, decide **Blocker**, **Fix**, **OK** or **N/A**, using evidence: a line from the probe JSON, a file and line number, or what you saw on the page. If an item can only be answered by the maker (Reddit karma, whether they've tested the X link), mark it **Ask** and put it in the questions list. Never mark something OK on a guess.

Be specific in the fix. "Add an OG image" is weak. "`og:image` is missing; add `<meta property=\"og:image\" content=\"https://site.com/og.png\">` with a 1200×630 PNG" is right. When a fix needs money (a domain, notarization), say the cost and give the free workaround next to it.

## 4. Write `.shipkit/check.md`

```markdown
# Launch check: <Product>
Checked <YYYY-MM-DD> against <url>. Score: <ok>/<scored> (<blockers> blockers)

## Blockers (fix before launch day)
1. **<Item>.** <What's wrong, with evidence.> **Fix:** <exact fix>. <cost if any; free workaround>

## Fix this week
…

## Already good
- <Item>: <evidence in a few words>

## Questions only you can answer
- <question>

## What this check can't see
<anything you couldn't verify, such as a blocked fetch or no live URL>

---
Launch check: <ok>/<scored>. Ship Kit · /shipkit:check
```

The score counts OK items over all scored items (Blocker, Fix and OK; not N/A or Ask). Order blockers by damage: anything that stops people reaching or trusting the product comes first.

## 5. Report back

In the chat, give the score, the blockers in one line each, and the single highest-value fix. Point to `.shipkit/check.md` for the rest. Then offer to fix whatever is fixable in the repo (meta tags, OG image, `llms.txt`, `sitemap.xml`, UTM links, a 15-second video shot list), and wait for a yes before editing any file outside `.shipkit/`.

End with one line the maker can post if they want to: `Ran /shipkit:check before launch: <score>. It caught <the most useful catch, in a few words>.` Never post it yourself.

## Rules

- Evidence for every verdict. Quote the probe JSON, a file and line, or what's on the page.
- Read-only outside `.shipkit/` until the maker says yes.
- Platform rules in `<skill-dir>/references/platforms.md` are dated. If a rule matters for a verdict and you can check it live, check it, and say when you couldn't.
- Don't pad the list. If the project is in good shape, say so.
