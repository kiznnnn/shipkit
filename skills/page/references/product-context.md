# The product file: `.shipkit/product.md`

Every Ship Kit skill starts from this one file, so the maker answers each question once. If it exists, read it, check it against the repo for anything stale (a new price, a new feature, a version bump), and use it. If it doesn't exist, build it now, before doing anything else.

## How to build it

1. **Use what's already written.** If the project has a marketing context file from another tool, read it first: `.agents/product-marketing.md` (the marketingskills plugin), `.claude/product-marketing.md`, or `product-marketing-context.md` in either folder. Carry over who it's for, the problem in their words, positioning, voice and any proof, with the tag `[product-marketing.md]`. Check its facts against the repo like any other source. Never edit or move that file; it belongs to the other tool.
2. **Read before asking.** In this order, as far as they exist: `README*`, `PRODUCT.md`/`DESIGN.md`/`docs/`, `package.json` (name, description, homepage), `llms.txt`, the landing page source (`index.html`, `app/page.*`, `src/pages/index.*`, `public/`), app metadata (`Info.plist`, `Package.swift`, `app.json`, `manifest.json`), pricing code or Stripe/Gumroad/Lemon Squeezy links, `CHANGELOG*`, and `git log --oneline -30`.
3. **If there is a live site,** fetch it and read the hero, pricing and FAQ. The live site wins over stale source.
4. **Write down only what you can source.** Put a source tag after every fact: `[README]`, `[index.html:212]`, `[live site]`, `[maker]`. A fact with no source doesn't go in.
5. **List the gaps as questions,** and ask them all in one message. Never ask something the repo already answers. Typical gaps: who exactly it's for, the price if none is in the code, real numbers (users, downloads, stars, revenue, speed), and the maker's X handle and past posts for their voice.
6. **Write the file** in the format below, then carry on with the skill that called you.

## Format

```markdown
# <Product name>
Updated: <YYYY-MM-DD>

## One line
<What it is, 14 words or fewer, in plain words.> [source]

## Who it's for
<The specific person, and the moment they need it.> [source]

## The problem, in their words
<1–3 sentences a user would actually say. Quote real posts or reviews if the maker has them.> [source]

## How they solve it today
<The old way: manual work, a competitor, a bot, nothing.> [source]

## What it does (the three that matter)
1. <Feature as an outcome> | proof: <where you saw it work: file, screen, demo> [source]
2. …
3. …

## Facts and numbers (real only)
- <e.g. 6.7 MB download> [source]
(No real numbers? Write "None yet." Never estimate.)

## Price and offer
<Every plan, trial, launch price and scarcity, exactly as sold.> [source]

## Links
- Site: <url>   (host: <own domain | vercel.app | netlify.app | github.io | …>)
- Get it: <download, store or install command>
- Repo: <url, if public>

## Platform and requirements
<OS, versions, browsers, accounts needed.> [source]

## Brand
- Mode: <light | dark>; background <hex>; text <hex>; accent <hex>
- Fonts: <display>, <body>
- Look: <3–5 words, taken from the existing site or app>

## Voice
- X handle: <@handle or none>
- Samples: <path to .shipkit/voice.md, or "none yet">

## Status
<In development | beta | launched on YYYY-MM-DD | version x.y>

## Never claim
<Anything the maker said is not true or not ready, plus: no invented testimonials, logos, user counts, ratings or press.>
```

## Rules for every skill that uses this file

- **No fabrication.** Copy, pages and posts may only state what this file states. If a section needs a fact you don't have (a testimonial, a number), leave the slot out or mark it `[needs: …]` for the maker. Never fill it with something plausible.
- **Keep it current.** When the maker corrects a fact, update this file first, then the output.
- **Dates are absolute.** Write "2026-10-19", never "today" or "last week".
