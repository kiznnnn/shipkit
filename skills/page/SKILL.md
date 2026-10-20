---
name: page
description: Write a launch-ready landing page for the current project from its repo, as one self-contained HTML file plus the share image, llms.txt, sitemap.xml and robots.txt. Uses only real facts and real product shots, in the product's own brand. Use when the user types /shipkit:page, or asks for a landing page, a launch page, a product page, a homepage, "a site for my app" or "rewrite my landing page".
---

# /shipkit:page

You write a landing page for the project in the working directory into `.shipkit/page/`. One self-contained `index.html` (inline CSS, no build step, no framework), so it deploys to any static host as-is. You never deploy it and never overwrite the maker's existing site; the maker decides where it goes.

`<skill-dir>` means the directory this SKILL.md is in.

## 1. Load the product

Follow `<skill-dir>/references/product-context.md`: read or build `.shipkit/product.md`. The page may only say what that file says. If `.shipkit/check.md` exists, read it too, because its blockers are things this page should fix (a stale description, no demo, hidden pricing).

## 2. Gather the real visuals

List every real image and video of the product in the repo: `public/`, `assets/`, `media/`, `docs/`, `screenshots/`, `.github/`, existing site folders, and app icon files. Look at each one (Read the image). Choose:

- **the hero shot:** the product doing its main job, the clearest single picture
- **one shot per feature**, if they exist
- **the icon or logo**

If there are no usable shots, don't draw fake UI. Use a clean placeholder block labelled `[shot needed: <exactly what to capture>]`, and list the shots the maker should take in your report. For a web product with a live URL or a local dev server, capture real screenshots with a browser tool if one is available.

Copy the chosen files into `.shipkit/page/assets/` and reference them relatively.

## 3. Write the copy

Read `<skill-dir>/references/page-rules.md` and follow its section order and copy rules. Draft the copy in `.shipkit/page/copy.md` first, with a source tag on every factual line. Then lint it:

```bash
node "<skill-dir>/references/slop.mjs" .shipkit/page/copy.md
```

Fix every hit and run it again until it's clean. If the brand's own site uses a pattern the linter flags (for example dashes), keep the maker's style and run with `--allow-dashes`.

## 4. Build the page

Write `.shipkit/page/index.html`:

- **Brand:** take colors, fonts and light or dark mode from `.shipkit/product.md` (which takes them from the existing site or app). If the product has no brand yet, pick one restrained look that fits the product (one accent color, one typeface from Google Fonts, generous spacing) and say in your report that it's a placeholder for the maker to change.
- **Responsive:** it must work from 360 px wide up, with no horizontal scroll and tap targets of at least 44 px.
- **Accessible:** real headings in order, alt text on every image, visible focus, text contrast of at least 4.5:1.
- **Light:** no frameworks, and at most one Google Fonts request. Images get `loading="lazy"` below the fold and explicit `width`/`height`.
- **Head:** `<title>` (under 60 characters), meta description (under 160 characters), canonical, Open Graph and Twitter tags (`summary_large_image`), favicon, `lang`, and JSON-LD `SoftwareApplication` with the real price and operating system. Use absolute URLs where the live domain is known; otherwise use `https://YOUR-DOMAIN` and say so.
- **Links:** every call to action points to the real place to get the product (download, store, checkout, install command). If one doesn't exist yet, use `#get` and flag it.
- **Analytics:** leave a commented-out slot for the maker's analytics script.

Also write:

- `.shipkit/page/og.html`: a 1200×630 share card in the same brand (hook, product name, the hero shot). Render it to `og.png` if a browser is available. For example, with Chrome: `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --hide-scrollbars --window-size=1200,630 --screenshot=.shipkit/page/og.png .shipkit/page/og.html`. If no browser is available, keep the HTML and say how to render it.
- `.shipkit/page/llms.txt`: what it is, who it's for, platform, price and pages, in the llmstxt.org format, plain facts only.
- `.shipkit/page/sitemap.xml` and `.shipkit/page/robots.txt`.

## 5. Check your own work

- Render the page at 1440 px and at 390 px wide, with a browser tool if you have one, or headless Chrome as above. Look at both screenshots (Read them). Check that nothing overflows, nothing overlaps, the hero fits above the fold on desktop, and the first screen on mobile shows the headline, the one-line description and the button.
- Run `node "<skill-dir>/references/slop.mjs" .shipkit/page/index.html` and fix anything new.
- Re-read every factual claim on the page against `.shipkit/product.md`. Remove anything without a source.

Fix and re-render until it passes.

## 6. Hand over

Tell the maker:

- where the files are, and how to preview them: `open .shipkit/page/index.html`
- the hero line and the three section headlines, so they can react to the words without opening it
- what's a placeholder (shots, links, domain, brand)
- how to ship it: copy the folder's files to their site's root, or deploy it as its own static site. **They** deploy; you don't.

## Rules

- Real facts and real shots only. No invented testimonials, logos, user counts, ratings, press or "trusted by".
- Never overwrite the maker's existing site files. Everything goes in `.shipkit/page/` until they say otherwise.
- Never deploy, publish or register anything.
