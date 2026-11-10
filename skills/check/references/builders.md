# Where the fix goes, by site builder

`/shipkit:check` reads this when the probe names a `builder`. Many makers never see their HTML, so tell them where to click in their builder, and give the HTML only as a fallback.

How to use it:
- Quote the menu path as written here, and say "in <builder>". Builders rename menus, so add "(the label may differ slightly)" when you're not sure it's current.
- "not verified" means the builder's own docs didn't confirm a path on the date checked. Don't invent one. Say so, and give the fallback: the builder's custom head code setting with the exact tag, or asking the builder's support.
- Some settings need a paid plan (noted where the docs say so). Say which plan, and give a free workaround when there is one.
- For AI builders (Lovable, Bolt), the fix is often a chat prompt. Give the exact words to paste ("Set the page title to …, the meta description to …, and og:image to /og.png").

Checked 2026-11-10 against each builder's official help center or docs (source on each line). Re-check this file with the monthly platform upkeep.

## Framer
- Title/description: Site Settings › Site title / Site description (site-wide); Page Settings › Title / Page Description (per page). Source: https://www.framer.com/help/articles/how-to-update-page-titles-descriptions-and-social-images/
- Social image: the site-wide social image is set in Site Settings (sub-section not verified). On CMS pages: Page Settings › Page images › Social preview. Source: same URL; https://www.framer.com/academy/lessons/framer-seo-site-settings
- Favicon: Site Settings › General › Favicon (light and dark versions, 64×64 PNG). Apple touch icon support was added in the Sept 2024 update; where to set it is not verified. Sources: https://www.framer.com/help/articles/how-to-add-icons-and-set-up-a-favicon/ ; https://www.framer.com/updates/september-update-2024
- Head code: Site Settings › Custom Code, with start/end of head or body as the position. The help article calls this "Project Settings › Custom Code › Add Script". Sources: https://www.framer.com/academy/lessons/custom-code ; https://www.framer.com/help/articles/how-to-add-custom-code/
- Noindex: Page Settings › "Search engines" toggle off, then republish (per page). A site-wide toggle is not verified. Source: https://www.framer.com/help/articles/how-do-i-prevent-specific-pages-from-getting-indexed-by-search-engines/
- 404: Pages panel › "+" › New 404 Page. Source: https://www.framer.com/help/articles/creating-a-custom-not-found-404-page/
- www/apex: Site Settings › Hosting › Domains › "Connect a domain you own". DNS is 2 A records for the apex plus a CNAME for www → sites.framer.app. Which way www/apex redirects is not verified. Source: https://www.framer.com/help/articles/how-to-connect-a-custom-domain/

## Webflow
- Title/description: Pages panel › Page settings › SEO settings › Title tag / Meta description. Per page only, no global setting. Source: https://help.webflow.com/hc/en-us/articles/33961237278611
- Social image: Pages panel › Page settings › Open Graph settings › Open Graph image › Select image (JPG/PNG). Per page only. Source: https://help.webflow.com/hc/en-us/articles/33961370297107
- Favicon: Site settings › General › Icons › Upload icon. This covers the favicon (light/dark) and the webclip/Apple touch icon. Source: https://help.webflow.com/hc/en-us/articles/33961256955539
- Head code: Site settings › Custom code tab › Head code (site-wide); Page settings › Custom code › Inside `<head>` tag (per page). Source: https://help.webflow.com/hc/en-us/articles/33961357265299
- Noindex: Page settings › SEO settings › "Sitemap indexing" toggle off (per page). Site settings › SEO › Indexing › "Staging indexing" off (webflow.io only). The same Indexing section has Traffic control toggles for bots. Source: https://help.webflow.com/hc/en-us/articles/33961368603539
- 404: Pages panel › Utility Pages › 404. Source: https://help.webflow.com/hc/en-us/articles/33961393564435
- www/apex: Site settings › Publishing › Production. Add both, then "Make default" on one and publish. Quick connect defaults to www. Source: https://help.webflow.com/hc/en-us/articles/33961339571475

## Carrd
- Title/description: Builder › Publish › Title / Description › Publish Changes. Source: https://carrd.co/docs/sites/changing-a-title-and-description
- Social image: Publish › Media tab › Share Image › Upload (Pro Lite+). Source: https://carrd.co/docs/sites/adding-a-share-image
- Favicon: Publish › Media tab › Icon › Upload (Pro Lite+). A separate Apple touch icon is not verified. Source: https://carrd.co/docs/sites/adding-a-site-icon
- Head code: Add Element › Embed › Type: Code › Style: Hidden › Head (Pro Standard+). Analytics: https://carrd.co/docs/sites/setting-up-site-analytics. Source: https://carrd.co/docs/building/embedding-custom-code
- Noindex: no toggle. Publish › Settings tab › Meta Tags › add `robots=noindex` (Pro Standard+). Source: https://carrd.co/docs/sites/setting-up-meta-tags
- 404: not verified (Carrd docs have no 404 page).
- www/apex: Publish › Action: "Publish to a custom domain" (Pro Standard+). Enter either domain.ext or www.domain.ext and the other one auto-forwards. DNS needs a CNAME www → bare domain. Source: https://carrd.co/docs/sites/using-a-custom-domain

## Squarespace
- Title/description: SEO/AI Visibility panel › SEO Settings › Search Appearance › Home/Pages/Items tab (title format plus homepage SEO site description). Per page: Pages › page ⚙ › SEO tab. Sources: https://support.squarespace.com/hc/en-us/articles/205814428 ; https://support.squarespace.com/hc/en-us/articles/206016198
- Social image: Social Sharing panel › social sharing logo (site-wide). Per page: Pages › page ⚙ › Social tab › Alternate Social Sharing Image. Source: https://support.squarespace.com/hc/en-us/articles/205812778
- Favicon: Favicon panel › upload › Save. Apple touch icon: upload a PNG as a file link, then add `<link rel="apple-touch-icon">` in Code Injection. Sources: https://support.squarespace.com/hc/en-us/articles/206542527 ; https://support.squarespace.com/hc/en-us/articles/205815228
- Head code: Code Injection panel › Header (Core/Plus/Advanced plans). Source: https://support.squarespace.com/hc/en-us/articles/205815908
- Noindex: Settings › Crawlers › "Block Search engine crawlers" (site-wide). Per page: Pages › page ⚙ › SEO tab › "Hide page from search results". Source: https://support.squarespace.com/hc/en-us/articles/21829426828045
- 404: Pages panel › System Pages › 404 Page. Source: https://support.squarespace.com/hc/en-us/articles/205814478
- www/apex: linked automatically, with the naked domain redirecting to www. To drop www: Domains panel › "Use 'www' prefix" toggle off. Source: https://support.squarespace.com/hc/en-us/articles/206541837

## Wix
- Title/description: Editor › Pages & Menu › ⋯ (More Actions) › SEO basics. Source: https://support.wix.com/en/article/adding-seo-title-tags-and-meta-descriptions-to-your-pages
- Social image: Dashboard › SEO & GEO › SEO Settings › page type › Edit "Basics & social share" › og:image. A per-page editor path is not verified. Source: https://support.wix.com/en/article/customizing-the-social-share-settings-for-your-sites-pages
- Favicon: Dashboard › Settings › Website settings › Favicon › Upload Image. Needs a Premium plan and a connected domain; size is a multiple of 48px. Apple touch icon is not verified. Source: https://support.wix.com/en/article/wix-editor-changing-your-favicon
- Head code: Dashboard › Settings › Development & integrations › Custom Code › + Add Custom Code › Place Code in: Head. Source: https://support.wix.com/en/article/embedding-custom-code-on-your-site
- Noindex: Dashboard › SEO & GEO › SEO Settings › "Let search engines index your site" off › Hide Site. A per-page toggle label is not verified. Source: https://support.wix.com/en/article/enabling-search-engines-like-google-to-index-your-site
- 404: Wix Editor › Pages & Menu › … › (404) Error Page (premium plan required). Source: https://support.wix.com/en/article/customizing-your-404-error-page
- www/apex: Wix account › Domains › Add an Existing Domain › Connect a domain you already own. Pointing method needs both an A record (root) and a CNAME (www). Redirect direction is not verified. Source: https://support.wix.com/en/article/connecting-a-domain-to-wix-using-the-pointing-method

## WordPress (block themes / Site Editor)
- Title/description: Settings › General › Site Title / Tagline. Core has no meta description field (not verified). Source: https://wordpress.org/documentation/article/settings-general-screen/
  - Yoast: per post, Yoast sidebar › Search appearance. Source: https://yoast.com/help/optimize-your-content-with-yoast-seo-sidebar/
  - Rank Math: site-wide defaults in Rank Math SEO › Titles & Meta; per post via the snippet editor. Source: https://rankmath.com/kb/titles-and-meta/
- Social image: not in core (not verified).
  - Yoast: sidebar › Social media appearance (free). Source: https://yoast.com/help/optimize-your-content-with-yoast-seo-sidebar/
  - Rank Math: per post in the Social tab; default in Rank Math SEO › Titles & Meta › Global Meta › OpenGraph Thumbnail. Source: https://rankmath.com/kb/open-graph-meta-tags/
- Favicon: Site Editor › Site Logo block › Settings › "Use as site icon". Source: https://wordpress.org/documentation/article/site-logo-block/
- Head code: no core UI for block themes (not verified). Needs a plugin or theme code.
- Noindex: Settings › Reading › "Discourage search engines from indexing this site". This outputs `noindex,nofollow`. Source: https://wordpress.org/documentation/article/settings-reading-screen/
  - Yoast per post: sidebar › Advanced. Source: https://yoast.com/help/optimize-your-content-with-yoast-seo-sidebar/
  - Rank Math per post: Advanced tab › Robots Meta › No Index. Source: https://rankmath.com/kb/advanced-tab/
- 404: Appearance › Editor › Templates › 404 (the template exists if the theme ships one). Source: https://wordpress.org/documentation/article/template-editor/
- www/apex: Settings › General › WordPress Address / Site Address set the canonical host. Redirecting the other host depends on the web host (not verified). Source: https://wordpress.org/documentation/article/settings-general-screen/

## Shopify
- Title/description: Online Store › Preferences › "Social sharing image and SEO" (homepage). Per page: Online Store › Pages › page › Search engine listing › Edit website SEO. Source: https://help.shopify.com/en/manual/promoting-marketing/seo/adding-keywords
- Social image: Online Store › Preferences › "Social sharing image and SEO". Source: same URL.
- Favicon: theme editor › Theme settings › Logo (or Favicon) › Favicon image (32×32). Apple touch icon is not verified. Source: https://help.shopify.com/en/manual/online-store/themes/customizing-themes/theme-editor/theme-settings
- Head code: Online Store › theme ⋯ › Edit code › `layout/theme.liquid`, before `</head>`. Leave `content_for_header` in place. Sources: https://help.shopify.com/en/manual/online-store/themes/customizing-themes/edit-code/edit-theme-code ; https://shopify.dev/docs/api/liquid/objects/content_for_header
- Noindex: no simple toggle. Password protection / private mode hides the whole store (Online Store › Preferences › Password protection). Per page uses theme code or the `seo.hidden` metafield. Sources: https://help.shopify.com/en/manual/promoting-marketing/seo/hide-a-page-from-search-engines ; https://help.shopify.com/en/manual/online-store/themes/password-page
- 404: the theme's `templates/404.json`. The exact theme-editor selector path is not verified. Source: https://shopify.dev/docs/themes/theme-templates/404-liquid
- www/apex: Settings › Domains › domain › Type › Change › Primary domain. Other connected domains auto-redirect to the primary; keep both root and www connected. Sources: https://help.shopify.com/en/manual/domains/domain-type/change-primary-domain ; https://help.shopify.com/en/manual/domains/domain-type

## Ghost
- Title/description: Settings › General › Title & description; Settings › General › Meta data. Per post: post settings menu. Sources: https://ghost.org/help/site-setup/ ; https://ghost.org/help/seo/
- Social image: Settings › General › Meta data › Facebook card / X card. Per post: post settings › Facebook/X card. Source: https://ghost.org/help/site-setup/
- Favicon: Settings › Design (site icon; the exact label varies by theme). Apple touch icon is not verified. Source: https://ghost.org/help/design-settings/
- Head code: Settings › Advanced › Code injection › Site header. Source: https://ghost.org/help/code-injection-styles/
- Noindex: no toggle. Private site mode at Settings › Membership › Access turns off SEO features. Source: https://ghost.org/help/site-setup/
- 404: the theme file `error-404.hbs` (or `error.hbs`), so it needs a theme edit. Source: https://docs.ghost.org/themes/structure
- www/apex: Ghost Admin › Ghost(Pro) › Domain › Setup. For a www site: CNAME www → [sub].ghost.io plus A @ 178.128.137.126, which redirects root → www. Root-primary is the reverse. Source: https://ghost.org/help/using-custom-domains/

## Lovable
- Title/description: ask Lovable in chat. Review in Publish › ⋮ › "Social & search appearance" (or click the favicon by the URL). Source: https://docs.lovable.dev/features/publish
- Social image: same path. When unset, the OG image is the latest app screenshot. Source: same URL.
- Favicon: same path (one site icon). Apple touch icon is not verified.
- Head code: no setting (not verified). Edit `index.html` via chat or Code mode. Source: https://docs.lovable.dev/features/code-mode
- Noindex: no toggle verified. Publish › visibility row › "Who can view your site?"; restricted or unpublished sites never appear in search. Sources: https://docs.lovable.dev/features/publish ; https://docs.lovable.dev/tips-tricks/seo-geo
- 404: not verified. GitHub repos show `src/pages/NotFound.tsx` in the template, but no doc covers it.
- www/apex: Project › Settings › Domains › connect. The "Redirect www.domain → domain" option is on by default. The primary domain gets a 302 from all other domains; 301 is not supported. Source: https://docs.lovable.dev/features/custom-domain

## Bolt (bolt.new)
- Title/description: not verified (the Bolt help center has no settings for it; change via prompt or code).
- Social image: not verified.
- Favicon: not verified.
- Head code: not verified (edit `index.html` via prompt or code). Built-in hosting analytics: https://support.bolt.new/bolt-cloud/hosting/analytics
- Noindex: not verified. Paid plans can publish privately. Source: https://support.bolt.new/bolt-cloud/hosting/publish
- 404: not verified. Hosting analytics lists top "not found" pages.
- www/apex: project name › All project settings › Domains & Hosting › Connect a domain you own. DNS is CNAME www → `site-dns.bolt.host` and ALIAS/ANAME root → `site-dns.bolt.host`. Aliases forward to the primary. Sources: https://support.bolt.new/bolt-cloud/domains/connect ; https://support.bolt.new/bolt-cloud/domains/aliases

## Next.js (App Router)
- Title/description: `export const metadata = { title, description }` (or `generateMetadata`) in `app/layout.tsx` / `page.tsx`. Set `metadataBase` for absolute URLs. Source: https://nextjs.org/docs/app/api-reference/functions/generate-metadata
- Social image: `app/opengraph-image.(png|jpg)` (and `twitter-image`) or `metadata.openGraph.images`. Source: https://nextjs.org/docs/app/api-reference/file-conventions/metadata/opengraph-image
- Favicon: `app/favicon.ico` (root segment only), `app/icon.(png|svg)`, and `app/apple-icon.(png|jpg)`. Source: https://nextjs.org/docs/app/api-reference/file-conventions/metadata/app-icons
- Head code: `next/script` `<Script>` in `app/layout.tsx`, or `@next/third-parties` for GA/GTM. Sources: https://nextjs.org/docs/app/guides/scripts ; https://nextjs.org/docs/app/guides/third-party-libraries
- Noindex: `metadata.robots = { index: false }`, or `app/robots.ts`. Sources: https://nextjs.org/docs/app/api-reference/functions/generate-metadata ; https://nextjs.org/docs/app/api-reference/file-conventions/metadata/robots
- 404: `app/not-found.tsx` (the experimental `global-not-found.js` covers unmatched URLs). Source: https://nextjs.org/docs/app/api-reference/file-conventions/not-found
- www/apex: host-level. On Vercel: Project › Domains, add both and redirect www → apex (or the reverse). Source: https://vercel.com/docs/domains/working-with-domains/deploying-and-redirecting

## Astro
- Title/description: `<title>` / `<meta name="description">` in the layout's `<head>`. There is no built-in SEO setting. Source: https://docs.astro.build/en/basics/layouts/
- Social image: an `og:image` meta tag in the layout `<head>`. Not a built-in feature (not verified as an Astro API). Source: https://ogp.me/
- Favicon: `public/favicon.svg` (starter), linked in the layout `<head>`. Source: https://docs.astro.build/en/basics/project-structure/
- Head code: the layout component's `<head>`. Source: https://docs.astro.build/en/basics/layouts/
- Noindex: add `<meta name="robots" content="noindex">` manually. There is no Astro toggle (not verified). Source: https://developers.google.com/search/docs/crawling-indexing/block-indexing
- 404: `src/pages/404.astro` (or `404.md`), which builds to `404.html`. Source: https://docs.astro.build/en/basics/astro-pages/
- www/apex: depends on the host (not verified). Source: https://docs.astro.build/en/guides/deploy/

## Plain HTML
- Title/description: `<title>` and `<meta name="description">` in `<head>`. Sources: https://developers.google.com/search/docs/appearance/title-link ; https://developers.google.com/search/docs/appearance/snippet
- Social image: `<meta property="og:image" content="https://…absolute…">`. Source: https://ogp.me/
- Favicon: `<link rel="icon" href="…">` and `<link rel="apple-touch-icon" href="…">`. Sources: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/rel ; https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html
- Head code: paste inside `<head>`. Source: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/head
- Noindex: `<meta name="robots" content="noindex">` or the `X-Robots-Tag` header. Source: https://developers.google.com/search/docs/crawling-indexing/block-indexing
- 404: depends on the host. Example: GitHub Pages serves `404.html` at the root. Source: https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-custom-404-page-for-your-github-pages-site
- www/apex: set at the host/DNS. A generic path is not verified.
