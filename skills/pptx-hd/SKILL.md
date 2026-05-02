---
name: pptx-hd
description: "High-fidelity branded presentation creation using HTML-first design with full web stack (CSS gradients, web fonts, SVG, animations) and enhanced HTML→PPTX conversion via dom-to-pptx. Deeply integrated with client-data brand system (charter.json, tokens.css, manifest.json, hero images). Use when asked to create presentations, slide decks, pitch decks, or any branded .pptx output where visual quality matters. Triggers on: 'create presentation', 'build slide deck', 'make pptx', 'branded slides', 'pitch deck', 'HD slides', 'high quality presentation', or any request for visually polished branded presentations."
---

# PPTX-HD: High-Fidelity Branded Presentations

HTML-first slide design with full web rendering quality, converted to editable native PowerPoint via enhanced DOM-to-PPTX pipeline. Deeply integrated with the `client-data` brand system.

## Why This Skill Exists

The standard `pptx` skill uses a basic html2pptx pipeline that drops CSS gradients, limits to web-safe fonts, and can't handle SVG or shadows. This skill takes a different approach:

1. **Design in HTML/CSS** with full creative freedom (gradients, brand fonts, SVG motifs, shadows)
2. **Render via Playwright** for pixel-perfect layout measurement
3. **Convert to editable PPTX** using enhanced DOM-to-PPTX that preserves gradients (as vector fills), shadows, rounded corners, and precise typography
4. **Fallback safety**: elements that can't convert natively get rasterized as high-res PNG per-element (not full-slide screenshots)

The result: presentations that approach Claude Design quality while remaining fully editable in PowerPoint.

## Brand Architecture

This plugin defaults to **Ministerie van Economische Zaken en Klimaat (EZK)** brand data at `companies/nl-ez/`. Use this default unless the user explicitly names a different brand.

## Brand Data Integration (Required)

Every presentation MUST use brand data from `companies/`. This skill does not support unbranded decks — use the standard `pptx` skill for those.

### Brand artifact inventory

Default to `companies/nl-ez/`. Override with `companies/<slug>/` only if the user explicitly names a different client. Load all artifacts from the brand directory:

| Artifact | Path | Purpose |
|----------|------|---------|
| **Charter** | `charter.json` | Colors, fonts, logo refs, presentation spacing, formatting rules, image catalog, overlay config |
| **Design tokens** | `tokens.css` | Full CSS custom property system — colors, typography scales, spacing, shadows, motifs |
| **Logo variants** | `logos/` | `logo.svg`, `logo_white.svg`, `logo_mono.svg`, `icon_dark.svg`, `symbol.svg`, etc. |
| **Image manifest** | `images/manifest.json` | Extended metadata per image: roles, overlayPolicy, textSafeZone, motifAffinity, crops |
| **Hero crops** | `images/heroes/` | Pre-cropped images in 16:9, 2:1, and square formats for slide backgrounds |
| **Processed images** | `images/processed/` | Brand-treated versions of all images |
| **Brand guidelines** | `guidelines.md` | Written brand rules, do's and don'ts, voice/tone |
| **Image originals** | `images/*.jpg` | Full-resolution source images |

### Loading order

```
1. Read charter.json → extract colors, fonts, logo paths, image catalog, overlay config
2. Read tokens.css → inject as <style> in every slide HTML
3. Read images/manifest.json → get extended image metadata (overlayPolicy, textSafeZone, crops)
4. Read guidelines.md → absorb brand rules before designing
5. Resolve logo paths → use charter.logo.primary for light backgrounds, charter.images.logoVariantOnImage for dark/image backgrounds
```

### Color system

Use CSS custom properties from `tokens.css`, never hardcoded hex values:

| Semantic use | CSS variable | Example value |
|-------------|-------------|---------------|
| Primary brand | `var(--stromy-green)` | `#1D342B` |
| Accent/signal | `var(--stromy-signal-orange)` | `#B96034` |
| Background | `var(--stromy-neutral-50)` | `#ECE6DA` |
| Dark surface | `var(--stromy-neutral-950)` | `#0F1310` |
| Text primary | `var(--stromy-neutral-900)` | `#171611` |
| Text secondary | `var(--stromy-neutral-600)` | `#6D665C` |
| Success | `var(--stromy-success)` | `#47685B` |

Full scales (50–900 or 50–950) available for green, orange, and neutral.

### Typography system

From `tokens.css`:

| Use | Variable | Value |
|-----|----------|-------|
| Display/heading | `var(--font-display)` | `'Fraunces', Georgia, serif` |
| Body text | `var(--font-body)` | `'Plus Jakarta Sans', sans-serif` |
| Code/data | `var(--font-mono)` | `'IBM Plex Mono', monospace` |
| Display XL | `var(--text-display-xl)` | `3rem (48px)` |
| Display LG | `var(--text-display-lg)` | `2.25rem (36px)` |
| Display MD | `var(--text-display-md)` | `1.5rem (24px)` |
| Body | `var(--text-body)` | `0.9375rem (15px)` |
| Caption | `var(--text-body-sm)` | `0.8125rem (13px)` |
| Overline | `var(--text-overline)` | `0.6875rem (11px)` |

**Font embedding**: When generating the PPTX, embed Google Fonts (Fraunces, Plus Jakarta Sans, IBM Plex Mono) via `@import` in the HTML. The DOM-to-PPTX conversion preserves font names in the PPTX — the fonts render correctly when installed on the presenting machine, and fall back gracefully to the charter fallback stack otherwise.

### Image system

The brand image catalog (`charter.images.catalog` + `manifest.json`) provides a rich metadata layer:

**Image roles** — each image is tagged for specific slide positions:
- `"cover"` — title slides with full-bleed photography
- `"divider"` — section breaks between major topics
- `"background"` — subtle texture behind content
- `"closing"` — final slide (thank you, contact, CTA)

**Extended manifest metadata** (from `manifest.json`):
- `overlayPolicy` — e.g., `"dark-52"` means 52% dark overlay for text legibility
- `textSafeZone` — e.g., `"bottom-left"`, `"center-safe"`, `"lower-third"` — where to place text
- `motifAffinity` — which brand motifs pair well with this image (e.g., `"tempo-ledger"`, `"data-rail"`)
- `crops` — pre-cropped hero versions in `hero-16x9`, `hero-2x1`, `hero` formats
- `theme` — image thematic group (e.g., `"oxidized-infrastructure"`, `"dark-geometry"`, `"workshop-material"`)

**Image selection algorithm:**
1. Filter images by role matching the current slide type
2. Prefer hero images (`"hero": true`) for cover and closing slides
3. Use `description` for topical relevance — match image mood to slide content
4. Track used images in a `Set` to avoid repetition on consecutive image slides
5. When all images for a role are exhausted, reset and reuse
6. Use pre-cropped hero versions from `images/heroes/` when available (prefer `hero-16x9` for 16:9 slides)

**Overlay compositing:**
- Read `overlayPolicy` from manifest (e.g., `"dark-52"` → 52% opacity primary color overlay)
- Apply as CSS: `background: linear-gradient(rgba(29,52,43,0.52), rgba(29,52,43,0.52)), url(image.jpg)`
- This is CSS-native — no Sharp pre-compositing needed (unlike the standard pptx skill)
- The DOM-to-PPTX pipeline handles this by rasterizing the composited background as a single high-res image

### Brand motifs

`tokens.css` defines motif components that can be used as decorative elements:

- **Tempo ledger** (`stromy-tempo-ledger`) — ruled lines with oxide accent, ledger boxes
- **Data rail** (`stromy-data-rail`) — vertical rail with dot markers
- **Switch track** (`stromy-switch-track`) — horizontal track element
- **Echo band** (`stromy-echo-band`) — layered gradient lines

Use motifs sparingly on divider and content slides. Match images to their `motifAffinity` metadata.

### Diagram Integration

When a slide would benefit from a process flow, architecture diagram, org chart, timeline, or other structural visual, use the `diagram` skill to generate a branded PNG. The diagram skill reads the same charter and produces images that match brand colors and typography. Embed the resulting PNG using the same image embedding pattern as logos and brand photography.

## Slide Architecture

### Default branded deck structure

| # | Slide type | Content | Image role | Design approach |
|---|-----------|---------|------------|-----------------|
| 1 | **Cover** | Title + tagline + logo + date | `"cover"` | Full-bleed hero image, dark overlay, white text in textSafeZone, logo white variant |
| 2-N | **Content** | Analysis, data, text | none | Solid brand backgrounds, CSS grid layouts, charter typography |
| — | **Divider** | Section title + optional subtitle | `"divider"` | Full-bleed image with overlay, section number, motif element |
| — | **Data** | Charts, tables, matrices | none | Light background, brand palette for data viz, mono font for numbers |
| last | **Closing** | Thank you / contact / CTA | `"closing"` | Full-bleed hero image, logo centered, contact info |

### Slide dimensions

From `charter.presentation`:
- **Aspect ratio**: `16:9` (default)
- **HTML canvas**: `1280px × 720px` (HD resolution, not the standard 720pt × 405pt)
- **Slide margin**: `charter.presentation.slideMargin` (default `40pt`)

### Layout patterns

Use CSS Grid and Flexbox freely — the DOM-to-PPTX conversion measures computed positions:

- **Full-bleed image** — `background-size: cover; background-position: center`
- **Split layout** — 40/60 or 50/50 grid columns
- **Card grid** — 2×2 or 3-column card layouts with brand borders
- **Data dashboard** — top metric strip + chart area + footnotes
- **Quote slide** — large serif pull-quote with attribution
- **Timeline** — horizontal or vertical with brand accent markers

## Workflow

### Phase 1: Brand Discovery

1. Identify the client slug from the user's request
2. Read all brand artifacts (charter.json, tokens.css, manifest.json, guidelines.md)
3. Inventory available images by role — count covers, dividers, backgrounds, closings
4. Note the logo variants available
5. State your design approach: color scheme, typography choices, image theme preference, motif usage

### Phase 2: Content Planning

1. Analyze the content to present — what are the key messages, sections, data?
2. Plan the slide sequence — map content to slide types (cover → content → divider → content → closing)
3. Assign images to image slides — select from the catalog by role and thematic relevance
4. Plan data visualizations — what charts/tables are needed?

### Phase 3: HTML Slide Generation

For each slide, generate a self-contained HTML file:

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    /* Inject tokens.css content here */
    @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@400;500;700&family=Plus+Jakarta+Sans:wght@400;500;700&family=IBM+Plex+Mono:wght@400;500&display=swap');

    body {
      margin: 0;
      width: 1280px;
      height: 720px;
      overflow: hidden;
      /* tokens.css variables are available */
    }
  </style>
</head>
<body>
  <!-- Slide content with full CSS freedom -->
</body>
</html>
```

**Design rules:**
- Use `var(--...)` for all colors, fonts, spacing — never hardcode
- Use CSS gradients freely — they convert to vector gradient fills in PPTX
- Use SVG for icons and decorative elements — they convert to EMF/PNG in PPTX
- Use `box-shadow` for depth — converts to PowerPoint shadow properties
- Use `border-radius` — converts to rounded corners in PPTX
- Use CSS `backdrop-filter: blur(...)` sparingly — rasterized as fallback
- Text MUST be in semantic HTML elements (`<h1>`-`<h6>`, `<p>`, `<ul>`, `<ol>`)

### Phase 4: Build Script

Create a Node.js build script that:

1. Launches Playwright with a 1280×720 viewport
2. Loads each HTML slide
3. Waits for fonts to load (`document.fonts.ready`)
4. Uses the DOM-to-PPTX conversion pipeline to extract elements and generate native PPTX objects
5. For elements that can't convert natively (complex CSS effects), rasterizes individual elements as high-res PNG and places them as images
6. Saves the final `.pptx`

```javascript
// Build script structure
const { chromium } = require('playwright');
const PptxGenJS = require('pptxgenjs');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// 1. Load brand data
const charter = JSON.parse(fs.readFileSync('<client-data-path>/charter.json'));
const manifest = JSON.parse(fs.readFileSync('<client-data-path>/images/manifest.json'));

// 2. Generate HTML slides (inline or from files)
// 3. Launch browser, render each slide
// 4. Extract DOM positions + styles → map to PptxGenJS objects
// 5. Handle gradients: parse CSS gradient → PptxGenJS gradient fill
// 6. Handle shadows: CSS box-shadow → PptxGenJS shadow props
// 7. Handle complex elements: screenshot individual element → embed as image
// 8. Save PPTX
```

### Phase 5: Visual QA

1. Generate thumbnail grid: `python ../pptx/scripts/thumbnail.py <output.pptx> thumbnails --cols 4`
2. Read and inspect the thumbnail image for:
   - Text cutoff or overlap
   - Image positioning issues
   - Color contrast problems
   - Brand consistency (correct logo variant, correct colors)
   - Image repetition (same photo on consecutive image slides)
3. Fix issues and regenerate
4. Repeat until all slides pass visual inspection

## Key Differences from Standard PPTX Skill

| Feature | Standard `pptx` | `pptx-hd` |
|---------|-----------------|-----------|
| Canvas size | 720pt × 405pt | 1280px × 720px (HD) |
| Fonts | Web-safe only (Arial, Georgia) | Brand fonts via Google Fonts import |
| CSS gradients | Must pre-render as PNG | Convert to native PPTX gradient fills |
| SVG | Must rasterize to PNG | Convert to EMF or high-res PNG per-element |
| Shadows | Not supported | CSS → PPTX shadow property conversion |
| Border radius | Not supported | Preserved in PPTX shapes |
| Brand images | Manual overlay via Sharp | CSS overlay compositing, manifest-driven selection |
| Image metadata | Basic roles from charter | Full manifest: overlayPolicy, textSafeZone, motifAffinity, crops |
| Brand motifs | Not supported | CSS motif components from tokens.css |
| Typography | Limited to threshold rule | Full type scale with display/body/mono hierarchy |
| Unbranded decks | Supported | Not supported — use standard `pptx` skill |

## Anti-Patterns

Borrowed from the upstream Anthropic skill + our experience:

- **NEVER** use accent lines under titles (AI-generated hallmark)
- **NEVER** create text-only slides — every slide needs a visual element
- **NEVER** center body text on content slides (left-align for readability)
- **NEVER** default to blue when a brand palette exists
- **NEVER** hardcode hex values — use CSS variables from tokens.css
- **NEVER** use the same image on consecutive image slides
- **NEVER** set both width AND height on images — preserve aspect ratio
- **NEVER** place text outside the image's `textSafeZone`
- **NEVER** skip the overlay on image slides — raw photos are too bright for text legibility

## Dependencies

- **PptxGenJS**: `npm install pptxgenjs` — PPTX generation
- **Playwright**: `npm install playwright` — HTML rendering and DOM measurement
- **Sharp**: `npm install sharp` — image processing for fallback rasterization
- **Standard pptx skill tools**: Reuses `ooxml/scripts/`, `scripts/thumbnail.py` from the sibling `pptx` skill

## Output Location

Same convention as standard pptx skill:
- Default: `<projectRoot>/output/<deliverable>/`
- Override: user-specified path
- Iteration: overwrite in place when asked to rework
