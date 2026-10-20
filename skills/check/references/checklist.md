# Launch checklist

Built from a real Mac app launch (October 2026) and from what worked for other small makers that month. Each item says why it matters, how to check it, and what a fix looks like. Skip items that don't apply to the product type and mark them N/A.

## A. Trust: can people reach it and believe it?

**A1. Own domain.**
- Why: an own domain reads as an established product to Reddit, HN and press, and it survives a host change. It's a trust signal, not a blocker.
- Check: `hostKind` in the probe.
- Fix if: the site is on a free subdomain. Suggest a domain (about $10/yr), and say it can wait until after launch. Always test the main link in an X draft reply the day before.

**A2. HTTPS and clean redirects.**
- Check: `httpRedirectsToHttps`, `redirects` and `status` in the probe.
- Fix if: there's more than one hop, any 4xx or 5xx, or http stays on http.

**A3. The download opens without a scare (desktop and mobile apps).**
- Check, on macOS: is the app signed with a Developer ID and notarized? Look for `notarytool`, `codesign --options runtime` or `xcrun stapler` in the build scripts. Self-signed or ad-hoc apps trigger "can't be opened" and need System Settings › Privacy & Security › Open Anyway.
- Fix: notarization needs the $99/yr Apple Developer Program. Free workaround: a download page that shows the Open Anyway steps with screenshots, and says why the app isn't notarized yet. On Windows, the same applies to SmartScreen for unsigned installers.

**A4. Privacy, terms and a human contact.**
- Check: `links.privacy`, `links.terms` and `links.mailto` in the probe.
- Blocker if: the site takes payments with neither a privacy page nor a terms page.
- For products that touch sensitive data (audio, screen, files, health), the page should say plainly what leaves the device, and early users will ask for kill switches.

## B. First 5 seconds: do they get it?

**B1. The hero says the outcome in plain words.**
- Check: the probe's `h1` and `title`, plus the page.
- Fix if: a stranger can't say what it does and who it's for after reading only the H1 and the line under it. Product-name-only or slogan heroes ("Reimagine your workflow") fail. The test: can the problem be shown in 3 seconds without words?

**B2. Real product on screen above the fold.**
- Check: `hasVideo` in the probe, plus the page.
- Fix if: the hero shows no screenshot, recording or live UI of the actual product. Never use stock photos or generated fake UI.

**B3. A way to try it right now.**
- Why: an interactive in-browser demo was the biggest conversion lift for a small Mac app in October 2026 (Chain Your Mac). Show HN also requires something people can try.
- Check: is there a demo, a free tier, a trial, or a download that works without signing up? `mentionsSignupOnly: true` with no download or demo means the page is waitlist-only.
- Fix: a 20-second interactive demo of the core moment, a free tier, or a no-signup trial.

**B4. Share preview.**
- Check: `og.title`, `og.description` and `twitter.card` (should be `summary_large_image`) in the probe. `ogImage.width × height` should be about 1200×630 and the image absolute. The description must be current: compare it with the product's status, because stale "coming soon" text is common after launch.
- Fix: exact meta tags plus an image spec.

## C. The offer

**C1. The price is on the page.**
- Check: `prices` and `mentionsPrice` in the probe.
- Fix if: there's no price, "contact us" for an indie product, or prices that only show after signup.

**C2. A free start plus a pay-now option.**
- Why: a free tier or trial plus a visible pay-now lifetime option did better than hiding paid options, and multi-device licenses (3, 5 or 20 machines) sell.
- Fix if: there's only one path, or the paid option is hidden until later.

**C3. Scarcity is real and countable.**
- Check: any "limited" or "only N left" copy must be backed by a real counter or cap in the code.
- Blocker if: it's fake (a countdown that resets, a made-up number).

**C4. The free offer has abuse limits.**
- Why: abuse of free offers tends to show up within hours of a launch.
- Check: the signup and claim code. Look for per-email-domain limits, a disposable-inbox blocklist, per-browser or per-IP limits, and a manual review step.
- Fix: name the limits to add, in the file that handles signups.

## D. Measurement

**D1. Analytics is installed.**
- Check: `analytics` in the probe.
- Fix: a free option the maker can add in one line (Vercel Analytics, Cloudflare Web Analytics, GoatCounter, Umami self-hosted).

**D2. UTM-tagged links for every channel.**
- Check: does the maker have a link per channel? Ask, or check the launch plan if there is one.
- Fix: list the links, `?utm_source=<channel>&utm_medium=social&utm_campaign=launch-<yyyymmdd>`, one each for X, Reddit, HN, Product Hunt and each directory.

## E. Distribution

**E1. Reddit accounts are ready.**
- Why: for small makers Reddit often drives the first signups, but r/macapps' main feed needs 10 karma earned in that subreddit, and new accounts get filtered.
- Ask: which subreddits, and does the maker have karma in each? Two weeks of genuinely useful comments before launch is the fix.

**E2. Show HN eligibility.**
- Check against `platforms.md`: something people can try with no signup, the maker's own non-trivial work. A waitlist page doesn't qualify.

**E3. One launch asset that works with the sound off.**
- Check: is there a 15–45 second video or GIF showing the real product? For X, landscape (16:9).
- Fix: a shot list for a 15-second video, problem in 5 seconds and solution in 10, to screen-record.

**E4. A share loop.**
- Why: people share things that show something about them. A card, a score or a page with their name on it gives them a reason.
- Check: is there any reason for a user to post about it (a personal page, a card, a score, a referral bonus, something they made with it)?
- Fix: one concrete loop that fits the product.

**E5. Listed on trusted directories.**
- Check: is the product on Product Hunt, AlternativeTo, Uneed or Peerlist, or the platform's store?
- These also give the product a second trusted page to link to.

## F. Findability

**F1. Search basics.**
- Check: `title` (under 60 characters, says what it is), `description` (under 160 characters), `canonical`, `robots.txt.blocksAll` false, `noindex` false, `sitemap.xml` present, `lang` set.
- A `noindex` on the live page (in `metaRobots` or the `X-Robots-Tag` header) is a Blocker: search engines drop the page. It's often left over from a staging build.

**F2. `llms.txt`.**
- Why: AI answers increasingly cite small products that explain themselves in plain text.
- Check: `llms.txt.present` in the probe.
- Fix: offer to write one from `.shipkit/product.md`.

**F3. AI search can read it.**
- Why: people now ask ChatGPT, Claude and Perplexity "what's a good tool for X", and those answers come from crawlers. A robots.txt copied from a template often blocks them all.
- Check: `robots.txt.aiBotsBlocked` in the probe. Crawlers that fetch pages for AI answers are `OAI-SearchBot`, `ChatGPT-User`, `Claude-SearchBot`, `Claude-User`, `PerplexityBot` and `Perplexity-User`; blocking those keeps the product out of AI answers. `GPTBot`, `ClaudeBot`, `Google-Extended`, `CCBot` and `Applebot-Extended` collect training data; blocking them is a fair choice and doesn't hide the product from search.
- Also check `jsonLd` for a `SoftwareApplication`, `Product` or `WebApplication` with a name, a description and an offer with the price. Structured data helps both search and AI answers state the price correctly.
- Status: Fix if any answer-time crawler is blocked or there's no JSON-LD. OK otherwise. Say which bots are blocked by name and don't change the maker's training-data choice.
- Fix: offer the robots.txt lines for the answer-time crawlers and a JSON-LD block built from `.shipkit/product.md`.

## G. Keeping launch-week users

**G1. An update path and a changelog (apps).**
- Check: `links.changelog`, plus an auto-update framework (Sparkle on macOS) in the repo.
- Why: launch week finds bugs, and users who can't get the fix leave.

**G2. Launch-test the build.**
- Why: a build that quits on launch is the most common launch-week bug, and users find it before you do.
- Ask: has the exact build being shipped been opened on a clean machine, and does it stay open?
