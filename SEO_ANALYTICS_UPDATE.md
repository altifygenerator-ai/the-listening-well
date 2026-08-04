# SEO, indexing, analytics, and toss update

Production domain: `https://throwapenny.com`

## Added

- Google Search Console verification meta tag
- Canonical URL and complete homepage title/description metadata
- Open Graph and Twitter sharing metadata with absolute image URLs
- WebSite and WebApplication JSON-LD
- Root `robots.txt` and `sitemap.xml`
- Vercel Web Analytics loader on public pages
- Privacy-safe URL cleanup before analytics events are sent
- Working Vercel custom-event calls for key conversion actions
- Additional click events for the journal, wallet, sealing, sharing, install prompt, legal links, and returns to the well

## Changed

- Penny toss: 1,450 ms → 1,900 ms
- Splash trigger: 1,220 ms → 1,600 ms
- Minimum ritual time: 3,200 ms
- PWA cache key bumped to `listening-well-v4`

## Vercel requirement

Enable Web Analytics in the Vercel project dashboard, then redeploy. The site uses `/_vercel/insights/script.js`; no analytics package is required for this static frontend.
