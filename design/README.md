# DTE 2027 design assets

| File | What it is |
|---|---|
| `brand.css` | The brand tokens and shared components. Verified token-for-token against the save-the-date page — all 18 CSS variables match exactly. Import it, or port the values into the Tailwind theme. Do not invent new brand colours. |
| `dte27-logo.svg` | DTE 2027 logo, extracted from the live page source. |
| `ticket-page-direction.html` | Working layout for the ticket page, built as a deliberate sibling of the save-the-date: same hero architecture (eyebrow -> script lead -> display line -> outlined year -> chips), same pink stat strip, same rotated photo strip, same key/value venue card, same footer. Design blueprint, not production code. Fully self-contained (logo inlined as an SVG symbol). |

Fonts load from Google Fonts (Anton, Montserrat, Caveat). For production, self-host with `next/font` so there is no render-blocking third-party request.

Photography in the photo strip points at the existing GHL CDN URLs. Replace with self-hosted assets when the site moves off GHL.
