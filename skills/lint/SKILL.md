---
name: lint
description: Check any launch post or launch copy before it goes out. A linter catches AI and hype tells, an independent critic reads it as the platform's real audience, and the post is checked against that platform's rules (a subreddit's self-promotion and AI-content rules, Show HN, Product Hunt). You get a verdict, a score, the weakest line and fixes that keep your own voice. Use when the user types /shipkit:lint, or asks "does this sound like AI?", "is this tweet cringe?", "check my Show HN", "will this get removed from r/…", "is my launch post good?" or pastes a draft and asks for feedback.
---

# /shipkit:lint

You check one draft and hand back a verdict, a score, the weakest line and line-by-line fixes in the author's own voice. A script catches the obvious tells, an independent critic catches the rest, and the platform's rules catch what would get the post removed. You never post, send or schedule anything.

`<skill-dir>` means the directory this SKILL.md is in.

## 1. Get the draft as a file

- If the user gave a file path, use that file and never overwrite it. Its slug is the file name without the extension (`posts/x-launch.md` → `x-launch`).
- If they pasted text, save it to `.shipkit/drafts/<yyyy-mm-dd>-<short-slug>.md`; that name is the slug.
- Find the **facts you may use**: `.shipkit/product.md` if it exists, otherwise the project's `README`. Fixes can use what those state (what it does, the price, the platform), and nothing else.
- Work out **where it's going**: X post or thread, a subreddit (which one), Show HN, Product Hunt, LinkedIn, email, or landing copy. Use what the user said, then the draft itself. If it's a Reddit post and no subreddit is named, ask once; otherwise assume X.

## 2. Lint it

```bash
node "<skill-dir>/references/slop.mjs" <draft> --json
```

The linter flags:
- hype and AI phrases ("excited to announce", "game-changer", "unlock", "seamless")
- dash asides, and hyphens used as dashes
- sentences over 30 words
- emoji walls, and more than 2 exclamation marks
- three or more hashtags
- broetry (most lines six words or fewer)

Same input, same output, every time. If the author's own style uses dashes on purpose, re-run with `--allow-dashes` and say so.

## 3. Load the platform's rules

- **A subreddit:**
  ```bash
  node "<skill-dir>/references/places.mjs" --kind subreddit --json
  ```
  Find the subreddit's entry. If it isn't there or it's more than 45 days old, check the live rules the way `<skill-dir>/references/platforms.md` describes (Reddit, then ThreadFox, then ask). Note the source and the date.
- **Show HN, Product Hunt or X:** use `<skill-dir>/references/platforms.md`.
- **AI-content rules:** if the community removes AI-written posts, say so plainly. The fix is that the author rewrites it in their own words. Never suggest disguising AI text.
- **Products that write posts:** if the product itself is a marketing, outreach or content-generation tool, check for rules that ban promoting that kind of product (r/SaaS does).

## 4. Get the critic's verdict

Send the draft to the `launch-critic` agent that ships with this plugin (`shipkit:launch-critic`). Wait for its verdict in this turn. Give it:
- the draft's path
- where it's going
- the lint output
- the platform rules from step 3
- the facts file from step 1
- `.shipkit/voice.md`, if it exists

The critic reads the post as that platform's audience and scores it independently, so the author of a fix never grades it.

If you can't start a subagent here, read `<skill-dir>/references/launch-critic.md`, apply it yourself, and say in the report that the critic ran inline.

## 5. Merge into one list of fixes

Combine the linter hits, the rule problems and the critic's fixes into one list, in line order. For each line:
- Rewrite it **in the author's voice**: their casing, slang and punctuation.
- Never add a number, a feature or a claim that isn't in the draft or the facts file. A fact from the facts file is fine; say where it came from in the report. Where something is still missing, write `[needs: a real number for …]`.
- If a line breaks a platform rule, fix the rule problem first.

Write the fixed copy to `.shipkit/drafts/<slug>.fixed.md`. For drafts under about 120 words, lint the fixed copy again and fix anything new.

## 6. Report

```
<VERDICT> · <score>/10 · <platform>
First line: <stop or scroll, and why>
Weakest line: "<quote>" (<why>)
Rules: <what would get it removed, with the source and date, or "none found">
Linter: <n> hits (<the main kinds>)

Fixes
L1  "<original>"  ->  "<fixed>"
L3  …

Still needs from you: <a demo clip, a real number…, or "nothing">
Fixed copy: .shipkit/drafts/<slug>.fixed.md
```

Keep it short. If the draft is good, say so and stop.

## Rules

- The author's words, the author's facts. Point out, fix and suggest; never invent.
- Don't help get a post past a community's rules. If a post doesn't belong somewhere, say where it does belong.
- Never post, send or schedule anything.
