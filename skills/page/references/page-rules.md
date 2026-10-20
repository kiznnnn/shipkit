# Landing page rules

What converts for small indie products, as of October 2026. It's drawn from pages that sold, such as Shelfy (a $5.99 Mac utility with a working in-browser demo at the top) and Chain Your Mac (whose interactive demo was its biggest conversion lift), and from what failed at Afterword's launch.

## Section order

Use the sections that fit the product, in this order. Leave a section out rather than fill it with filler.

1. **Hero.**
   - Eyebrow (optional): the status in a few words, such as "Free for Mac" or "v1.2 · macOS 14+".
   - H1: the outcome or the pain, 4–9 words. It answers "what do I get?". Two short lines are fine, as in "Your meeting ends. The note is already written."
   - Under it: one sentence that says what the product is, where it runs, and the one detail that makes it different (14–25 words).
   - The primary button names the benefit: "Download free for Mac", "Try it in your browser", "Start free for 7 days". Never just "Get started" or "Submit".
   - Under the button, one line of honest reassurance: price, trial, "no account", "works offline".
   - The real hero shot or video, already doing the job.
2. **Try it.** If the product can be shown in the browser (a demo, a live example, a sample output), put it right after the hero, with an instruction line such as "Go ahead, drag a file onto the shelf." This is the biggest conversion lever on a small product's page.
3. **Numbers strip** (only real numbers): download size, speed, memory or CPU, price, "0 accounts", "0 trackers". Three to four items, each a number plus 2–4 words. Skip the strip if there are no real numbers.
4. **How it works.** Three steps, each 3–6 words plus one sentence. Use the real order of events.
5. **The three features.** Each gets a headline that says what it does for the user, two sentences, and a real shot. Alternate the layout from side to side on desktop and stack it on mobile.
6. **Compared with the old way.** A small table: the product against "doing it by hand", "a typical cloud tool" or "macOS on its own", with 4–6 rows of concrete differences and plain ✓/— marks. Never name a competitor unless the maker asks, and never claim a competitor lacks something unless that's verified.
7. **Privacy / permissions, explained** (for anything touching files, screen, audio, accounts or data). One line per permission or data flow: what, why, and where it goes. "Your files never leave your Mac" only if that's true.
8. **Pricing.** Every plan with its real price, what's included, the trial, the launch price and its real limit ("first 50"), and multi-device options. One highlighted plan at most. The pay-now option is always visible, never hidden behind a waitlist.
9. **FAQ.** 4–8 real questions, with short honest answers taken from the product facts: requirements, privacy, refunds, "why not on the App Store?", "what happens to my data if I stop paying?", and updates.
10. **Final call to action.** Restate the H1 idea in a new way, with the same button.
11. **Footer.** Product name, a contact email, privacy, terms, changelog, the maker's name or handle, and the year.

## Copy rules

- **Plain and short.** Write sentences a friend would say out loud. Use the second person ("your notes"). Keep sentences to 20 words or fewer.
- **Concrete beats clever.** "Saves a markdown file to your Obsidian vault" beats "Your knowledge, everywhere".
- **One idea per section.** Each headline makes sense on its own when skimmed.
- **No AI tells.** The slop linter catches most. Also avoid: three-adjective chains, "Meet X" as the H1, rhetorical questions as headlines, "Introducing", "The ultimate…", and lines that only restate the headline.
- **No dash asides** (—, –, --) unless the maker's own site uses them. Use full stops and commas.
- **Numbers:** digits ("3 steps", "7 days"), with units, sourced.
- **Honest status.** If it's in beta, say beta. If a feature is coming, say "coming" or leave it out. Never imply something ships that doesn't.
- **Scarcity only if real** and backed by a real counter or cap.

## Visual rules

- One accent color, used for the primary button and at most two highlights. Everything else is neutral.
- One typeface family, or two at most (display plus body). Body text 16–18 px, line-height 1.5–1.65, measure 60–75 characters.
- Generous whitespace: 96–160 px between sections on desktop, 64–96 px on mobile.
- Real product shots in a simple frame (a window or browser chrome, or a device), with a soft shadow. No floating 3D blobs, no stock people.
- Contrast: body text at least 4.5:1 against the background, large text at least 3:1.
- Motion, if any, is subtle and respects `prefers-reduced-motion`.
- Mobile first: the hero H1 at 36–44 px on a phone, 56–80 px on desktop.

## Head checklist

```html
<html lang="en">
<title>Product · the outcome in a few words</title>
<meta name="description" content="What it is, who it's for, one differentiator, price. Under 160 characters.">
<link rel="canonical" href="https://domain/">
<meta property="og:type" content="website">
<meta property="og:url" content="https://domain/">
<meta property="og:title" content="…">
<meta property="og:description" content="…">
<meta property="og:image" content="https://domain/og.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.svg">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"SoftwareApplication","name":"…","operatingSystem":"…","applicationCategory":"…","offers":{"@type":"Offer","price":"…","priceCurrency":"USD"}}</script>
```

Don't add `aggregateRating` unless the product has real public ratings.
