# Changelog

## 0.6.0 (2026-11-10)

The check now looks for the launch-day mistakes that aren't on most checklists: the ones you only find after the post is out.

- **31 checks, up from 24.** Seven new ones, and the probe grades them itself, so every run says the same thing:
  - **A5 Nothing secret is public.** It reads the page and its own scripts for live API keys (Stripe, OpenAI, Anthropic, AWS, GitHub, Slack, SendGrid, Google OAuth, private keys and a Supabase `service_role` key), and asks the live site for `/.env`, `/.env.local`, `/.env.production` and `/.git/config`. Keys are shown masked. Keys that are public by design (Stripe `pk_live_`, Supabase anon, Firebase) aren't flagged.
  - **A6 The buy button and links work.** It opens every checkout link (Stripe, Gumroad, Lemon Squeezy, Polar, Dodo, Paddle, the app stores and more), the page's own links and a few outside ones. A Stripe test-mode link, a `pk_test_` key with no live key, or a dead product page is a blocker. Links behind bot protection are listed as unverified, not broken.
  - **B5 Nothing left over from the template.** "Vite + React + TS" in the tab, "Lovable Generated Project" as the description, the AI builder's own share image, Lorem ipsum, "your headline here", `{{ tags }}`, `$NaN`, localhost and example.com links, a canonical on the preview domain, and an old © year.
  - **B6 Phone and tab basics.** The viewport tag, a favicon that loads, an apple-touch-icon, `lang`, alt text, and http scripts on an https page.
  - **B7 It loads fast.** Server response time, page weight, and any image over 1 MB, named.
  - **D3 A way to stay in touch.** An email field or a newsletter tool, for visitors who aren't ready to buy today.
  - **F4 Wrong URLs get a real 404,** not the home page with status 200.
  - A2 now also checks that `www.` (or the bare domain) works, and a site without working HTTPS gets a full report with the reason, not "fetch failed".
- **See your link in five apps.** `/shipkit:check` writes `.shipkit/share-preview.png`: approximate mock-ups of how the link looks on X, iMessage, LinkedIn, Slack and Discord, built from the page's own tags. `/shipkit:page` makes one for its page too.
- **A verdict at the top.** `check.md` starts with one line: not ready (with the blocker count), ready with fixes, or ready, then the single fix to do first.
- **Fixes say where to click.** The probe recognises the site builder (Framer, Webflow, Wix, Squarespace, WordPress, Shopify, Ghost, Carrd, Lovable, Next.js, Astro and others), and the report gives the menu path in that builder, from the builder's own docs, instead of raw HTML.
- **Quality of life.** `/shipkit:check quick` grades the eight self-graded checks in about a minute. `/shipkit:check https://myapp.com` or `/shipkit:check ./public` names what to check. The probe saves its JSON to `.shipkit/probe.json`. Network errors are in plain words ("the domain doesn't resolve"). `--no-external` skips links to other sites.
- **Pro: `/shipkit:today` watches the checkout.** In launch week, a broken or test-mode checkout, a leaked key or a template leftover goes to the top of the morning brief.
- **Fixes.**
  - The favicon was read from `apple-touch-icon` when that tag came first.
  - Titles and descriptions with HTML entities (`&middot;`, `&#39;`) are decoded.
  - Alpine and Vue `:href` bindings are no longer read as links.
  - A self-hosted analytics counter is no longer reported as "no analytics".
  - The web check at shipkit.tech/check says "That address doesn't load" for a domain that doesn't exist, instead of "The page returned 530". It also checks for template leftovers, a test-mode or broken checkout, and a favicon.
- **Tests.** 31 unit tests (5 new: a broken local site, a clean site with no false alarms, a live server with a public `.env`, `.git` and a soft 404, plain network errors, and the share preview).

## 0.5.0 (2026-11-08)

Built from what people asked about Ship Kit on X this week: "what are the checks?", "does the page have to be live?", "does it work on a private repo?", and "the OG image size check would've saved me ugly previews".

- **The check works before you deploy.** Point `/shipkit:check` at a folder or an HTML file and the probe reads the page from disk, share image included. It also finds `index.html` in `public/`, `static/`, `dist/`, `out/`, `build/`, `docs/` or `site/`. Nothing has to be live.
- **A real share-image check.** The probe now opens the image your `og:image` points to and gives a verdict with plain reasons: SVGs that X won't show, images under X's 300×157 minimum, small or soft images under 600×315, square or tall images that get cropped, files over X's 5 MB limit or over 1 MB, relative or http URLs, `og:image:width`/`height` that don't match the file, and a missing `summary_large_image` card, `og:title` or `og:description`. It now reads GIF and WebP sizes too.
- **The report says what it checked.** `check.md` ends with a table of all 24 checks, each with its verdict and evidence, and the chat summary names the seven groups. The share preview always gets a line, even when it passes.
- **Re-checks show progress.** The previous report is kept in `.shipkit/check-history/`, and the new one has a "Since last check" section: the old and new score and every item that changed.
- **The page checks itself.** `/shipkit:page` runs the same probe on its own output in local mode and won't hand over a page whose share preview fails.
- **Private repos, said plainly.** The check, both READMEs and the site now say it: Ship Kit has no server, it runs in your own Claude Code session, and the check only sends GET requests to your own public site.
- **A score card for every check.** `/shipkit:check` now writes `.shipkit/score-card.png`, a 1200×630 card with that run's score and its top two findings, read straight from `check.md`. Post it with the one-line summary if you like; nothing is posted for you.
- **A new mark.** The triangle is now a sail: a mainsail, a jib and a hull, on the same blue and lime. Verdicts use the brand's colours everywhere: Blocker red, Fix amber, OK lime.
- **Pro: `/shipkit:today` watches the site in launch week.** From the day before launch to the day after, it probes the live site and puts a broken share preview, a `noindex`, an error page or a missing price at the top of the brief.
- **Pro: real proof, collected the honest way.** The run sheet now has a T+1 to T+3 task to ask your first happy users for one sentence you may quote. Answers go into `product.md` with the date permission was given, so the page and posts can use them.
- **Pro: one line asking for a rating.** After the first successful `/shipkit:launch` in a project, the report ends with one line inviting an honest Gumroad rating. It shows once, asks for no particular score, and nothing depends on it.
- **Fixes.**
  - The founders sync now updates the Pro price in the site's JSON-LD offers list (it only matched a single offer, so the price would have stayed at $9 after the ladder moved).
  - `places.mjs --name` works (outreach called it, and it was ignored).
  - The outreach skill no longer passes a `--file` flag the linter doesn't have.
  - Outreach always writes `people.csv`, `messages.md` and `outreach.json`, even when an honest search finds nobody, so the kit's Outreach tab still has its note.
  - The Pro manifest and marketplace descriptions list all nine commands.
  - The probe ignores HTML comments, so a commented-out analytics snippet or a price in a comment no longer counts as real.
  - The Pro licence names all three free skills (check, page and lint).
- **Tests.** 26 unit tests (7 new: the score card, local mode, a missing share-image file, share-image verdicts, GIF and WebP sizes, `places --name`, and HTML comments), and the founders test now checks the JSON-LD price in the offers list.
- **Site.** shipkit.tech leads with "Find what will sink your launch." and a free check box, shows a real check result on the first screen, lists all 24 checks, answers "does it have to be live?" and "private repo?" up front, splits free from Pro, and adds privacy and terms pages.

## 0.4.0 (2026-10-21)

- **New: `/shipkit:outreach` (Pro).** It finds 20 real people who'd want your product right now, from their own public posts from the last 14 days: people asking for a tool, complaining about the problem, or about to need it. It writes one personal message for each one, in your voice, under 60 words, with the follow-up for when they say yes. Every message goes through the linter and the critic. The results go into `people.csv` and an Outreach tab in the kit. You send each one yourself.
- **New: `/shipkit:today` (Pro).** The morning brief: what goes out today, what posts by itself and what you post live, the exact words and where they go, who to message next and which follow-ups are due, plus yesterday's numbers.
- **The launch kit, rebuilt for launch week.**
  - Day tabs, and an Up next bar that jumps to the next card you haven't ticked.
  - The real video or image previews on every card, with a Copy file path button so you attach the right file.
  - An Open button on every card: X's composer with the post already filled in, or the subreddit's submit page with the title and body filled in.
  - Scheduled posts are marked "posts by itself" and show only the reply you still need to post.
  - Character counts against X's limit.
  - Product filters and a "Not done" filter.
  - Missing media is flagged as "make this first".

- **Project launch kit.** `/shipkit:launch` writes `schedule.json` and builds `kit.html` from it with `build-kit.mjs`, so edits rebuild in one command. One kit can cover several products launching in the same weeks, spaced so they never share a first hour, and filtered by product.

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
