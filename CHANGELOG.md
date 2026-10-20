# Changelog

## 0.3.0 (2026-10-20)

- **New: `/shipkit:lint` (free).** Checks any launch post before it goes out. The linter flags AI and hype tells. An independent critic reads the post as that platform's audience. The subreddit's dated rules catch what would get it removed. You get a verdict, a score, the weakest line and fixes in your own voice. It triggers from plain questions like "is this tweet cringe?" and never touches the original.
- **New: the `launch-critic` agent.** Posts, lint and recap send every draft to a separate critic, so the writer never grades its own work. Where subagents aren't available, the skills apply the critic inline and say so.
- **New: `/shipkit:recap` (Pro).** At the end of launch week, it totals the real numbers from `tracker.csv`. Blank days stay blank and the recap says how many were recorded. It checks every directory listing and backlink, then writes a results post in your voice and a 1200×675 receipts card.
- **New: a places database.** 44 launch sites, directories and subreddits, each with its self-promotion rule, AI-content rule, timing, source and the date it was checked (`places.json`, queried by `places.mjs`). It warns when a community removes AI-written posts, when a subreddit bans your kind of product (r/SaaS and content tools), and when an entry is over 45 days old.
- **Directory kit.** `/shipkit:posts` writes the full asset set with character counts: name, tagline, headline, short, description, long and tags. The first line is tailored to each directory type. `/shipkit:launch` checks that each directory still resolves before listing it, and adds a T+7 listing and backlink check.
- **Check.** New item F3, AI search: the probe reads robots.txt per crawler and reports which AI crawlers are blocked. It separates answer-time crawlers (OAI-SearchBot, Claude-SearchBot, PerplexityBot) from training crawlers. It also reads JSON-LD types and catches `noindex` in meta tags or the `X-Robots-Tag` header. Blocking only GPTBot no longer counts as blocking everything.
- **Slop linter.** New rules: sentences over 30 words, hyphens used as dashes, and emoji walls. The long-sentence rule is skipped for HTML.
- **Product Hunt rules** rewritten from the official help center: gallery size, description length, timing and who can post.
- **Interop.** If the project has a marketingskills context file (`.agents/product-marketing.md`), Ship Kit reads it when building `.shipkit/product.md` and never changes it.
- **Tests.** 12 unit tests (linter rules, robots.txt parsing, JSON-LD, noindex, the places database) and eval cases for lint and recap.

## 0.2.0 (2026-10-20)

- **Platform rules.** X accepts free-host links such as `vercel.app` again. The check no longer treats a free subdomain as a blocker, and an own domain is now a trust suggestion. Every skill still tests the main link in an X draft reply the day before launch.
- **Share loops.** `/shipkit:launch` comes with a guide to the loops that work for small launches: numbered founding cards (pick your number, add your logo as a sticker), a founders wall, shareable scores, community lists and referrals. Each comes with what it needs built.
- **Check.** It takes screenshots from the top of a freshly loaded page at 1440×900 and 390×844, so pages that open mid-scroll don't skew the hero verdict.
- **Slop linter.** Post text inside plain code fences is linted, and fences tagged as code (` ```bash `, ` ```js `…) are skipped. Phrases like "all in one message" no longer trip the hyphenated cliché rule.
- **Tests.** Unit tests for the linter and the site probe (`node --test "tests/unit/*.test.mjs"`), plus an eval suite for check, page and posts on a fixture app (`evals/`).

## 0.1.0 (2026-10-19)

- First release: `/shipkit:check` and `/shipkit:page` (free), and `/shipkit:posts`, `/shipkit:seo` and `/shipkit:launch` (Pro).
