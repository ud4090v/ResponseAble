# Chrome Web Store Screenshots

Self-contained HTML mockups for capturing Chrome Web Store screenshots. Each file uses fictional data (no real email addresses or content) and embeds brand images as base64 data URIs.

## Files

| # | File | Description |
|---|------|-------------|
| 1 | `01-gmail-drafts.html` | Gmail with xReplAI draft overlay — hero screenshot |
| 2 | `02-gmail-progress.html` | Gmail with analysis progress overlay |
| 3 | `03-options-page.html` | Extension Options page (Pro plan, Models tab) |
| 4 | `04-popup.html` | Extension popup with usage stats |
| 5 | `05-linkedin.html` | LinkedIn messaging with draft overlay |
| 6 | `06-rate-limit.html` | Rate limit reached popup over Gmail |

## How to Take Screenshots

1. Open each HTML file in Chrome
2. Set the browser window to **1280 × 800**
   - Option A: Use a window resizer extension (e.g. "Window Resizer")
   - Option B: Open DevTools (F12) → toggle device toolbar (Ctrl+Shift+M) → set to 1280 × 800
3. Take a full-page screenshot:
   - DevTools → Ctrl+Shift+P → type "Capture full size screenshot" → Enter
   - Or use the Snipping Tool / screenshot shortcut
4. Upload to Chrome Web Store Developer Dashboard in order (1–6)

## Fictional Content

All mockups use completely fictional people, companies, and email addresses:

- **Sender:** Sarah Mitchell, VP of Partnerships at Horizon Labs (`sarah.mitchell@horizonlabs.io`)
- **Recipient:** Alex Chen (`alex.chen@innovatech.co`)
- **LinkedIn recruiter:** Jessica Reynolds, Senior Technical Recruiter at Nova Dynamics

## Promotional Tiles

| File | Size | Purpose |
|------|------|---------|
| `promo-small-440x280.html` | 440 × 280 | Search results and category listings |
| `promo-large-1400x560.html` | 1400 × 560 | Featured/marquee placement on CWS homepage |

To capture these at exact pixel dimensions:
1. Open the file in Chrome
2. Open DevTools (F12) → toggle device toolbar (Ctrl+Shift+M)
3. Set dimensions to **440 × 280** (small) or **1400 × 560** (large)
4. Ctrl+Shift+P → "Capture screenshot"

## Chrome Web Store Requirements

- Screenshot size: **1280 × 800** or **640 × 400**
- Small promotional tile: **440 × 280** (strongly recommended)
- Large promotional tile: **1400 × 560** (optional, for featured placement)
- Format: PNG or JPEG
- Minimum: 1 screenshot, maximum: 5
- Must accurately represent the extension's functionality
