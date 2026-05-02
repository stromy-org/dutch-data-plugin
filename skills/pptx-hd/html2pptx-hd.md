# HTML to PowerPoint HD Guide

Convert HD HTML slides (1280×720px) to editable PowerPoint with enhanced CSS support.

## Creating HTML Slides

### Layout Dimensions

- **HD 16:9**: `width: 1280px; height: 720px` (the only supported format)
- Body MUST have these exact dimensions — validation will throw on mismatch

### Supported Elements

Everything from the standard `html2pptx.md` guide, plus:

- **CSS gradients** — `linear-gradient()` converts to native PPTX gradient fills
- **Google Fonts** — Fraunces, Plus Jakarta Sans, IBM Plex Mono (names preserved in PPTX)
- **SVG elements** — rasterized as high-res PNG per-element
- **CSS custom properties** — tokens.css variables (var(--stromy-green), etc.)
- **Complex overlays** — `linear-gradient(rgba(...), rgba(...)), url(image.jpg)` composited as background

### Critical Text Rules

Same as standard pptx skill — ALL text MUST be inside `<p>`, `<h1>`-`<h6>`, `<ul>`, or `<ol>` tags.

### What's Different from Standard html2pptx

| Feature | Standard (720pt × 405pt) | HD (1280px × 720px) |
|---------|--------------------------|---------------------|
| Canvas | 720pt × 405pt | 1280px × 720px |
| CSS gradients | **ERROR** — must pre-render as PNG | **NATIVE** — converts to PPTX gradient fills |
| Fonts | Web-safe only | Google Fonts (brand fonts) |
| SVG | Not supported | Per-element rasterization |
| Font loading | Immediate | Waits for `document.fonts.ready` |
| Background compositing | Sharp pre-compositing | CSS overlay, browser rasterization |

### Gradient Support

```css
/* Supported — converts to native PPTX gradient fill */
background: linear-gradient(135deg, #1D342B, #2A5441);
background: linear-gradient(to right, var(--stromy-green), var(--stromy-green-700));

/* Supported — image with overlay (composited via browser screenshot) */
background: linear-gradient(rgba(29,52,43,0.52), rgba(29,52,43,0.52)), url('photo.jpg');

/* Supported on shapes */
div { background: linear-gradient(180deg, #1D342B 0%, #B96034 100%); }
```

### Font Embedding

The HTML uses Google Fonts via `@import`. Font names are preserved in the PPTX — they render correctly when the fonts are installed on the presenting machine, with graceful fallback to the charter's fallback stack.

```html
<style>
@import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@400;500;700&family=Plus+Jakarta+Sans:wght@400;500;700&family=IBM+Plex+Mono:wght@400;500&display=swap');
</style>
```

### SVG Elements

SVGs are detected during extraction and rasterized as individual high-res PNGs:

```html
<!-- This SVG will be rasterized at 2x resolution and placed as an image -->
<svg id="icon-chart" width="200" height="200" viewBox="0 0 200 200">
  <circle cx="100" cy="100" r="80" fill="var(--stromy-signal-orange)" />
</svg>
```

## Using the html2pptx-hd Library

### Dependencies

Required (globally installed):
- `pptxgenjs` — PPTX generation
- `playwright` — HTML rendering
- `sharp` — image processing for fallback rasterization

### Basic Usage

```javascript
const pptxgen = require('pptxgenjs');
const html2pptxHD = require('./html2pptx-hd');

const pptx = new pptxgen();

// CRITICAL: Define and use HD layout
pptx.defineLayout({ name: 'HD_16x9', width: 13.333, height: 7.5 });
pptx.layout = 'HD_16x9';

const { slide, placeholders } = await html2pptxHD('slide.html', pptx);

await pptx.writeFile('output.pptx');
```

### API Reference

```javascript
await html2pptxHD(htmlFile, pres, options)
```

**Parameters:**
- `htmlFile` (string): Path to HTML file
- `pres` (pptxgen): PptxGenJS instance with HD layout set
- `options` (object, optional):
  - `tmpDir` (string): Temp directory for rasterized elements
  - `slide` (object): Existing slide to reuse

**Returns:** `{ slide, placeholders }`

### Exported Constants

```javascript
html2pptxHD.HD_WIDTH_PX   // 1280
html2pptxHD.HD_HEIGHT_PX  // 720
html2pptxHD.HD_WIDTH_IN   // 13.333
html2pptxHD.HD_HEIGHT_IN  // 7.5
```

### Utility Functions

```javascript
// Parse CSS gradient to PptxGenJS format
const gradientFill = html2pptxHD.parseCSSGradient('linear-gradient(135deg, #1D342B, #2A5441)');
// Returns: { fill: { type: 'gradient', gradientType: 'linear', rotate: 45, stops: [...] } }

// Rasterize a single element as high-res PNG
const box = await html2pptxHD.rasterizeElement(page, '#complex-svg', 'output.png', 2);
// Returns: { x, y, w, h } in inches
```

## Brand Integration

### Loading the Brand System

```javascript
const { loadBrandSystem, pickImage, imageSlide, wrapSlide } = require('./brand-hd');

const brand = loadBrandSystem('/path/to/client-data/clients/stromy');
// brand.charter    — parsed charter.json
// brand.tokensCSS  — raw tokens.css content
// brand.manifest   — parsed images/manifest.json
// brand.logos       — resolved logo paths (primary, white, mono, icon, onImage)
```

### Image Selection with Manifest Metadata

```javascript
const usedImages = new Set();

// Select cover image — prefers hero images, respects overlayPolicy
const image = pickImage(brand, 'cover', usedImages);
// image.resolvedPath     — absolute path to best crop
// image.overlayCSS       — CSS gradient for overlay compositing
// image.textSafeZone     — where to place text ("lower-third", "center-safe", etc.)
// image.overlayPolicy    — raw policy string ("dark-52")
// image.motifAffinity    — compatible motifs

// Select with theme preference
const dividerImage = pickImage(brand, 'divider', usedImages, {
  theme: 'dark-geometry',
  motifAffinity: 'tempo-ledger'
});
```

### Creating Branded Slides

```javascript
// Solid background slide with tokens.css injected
const html = wrapSlide(brand, '<h1>Title</h1>');

// Image background with manifest-driven overlay
const coverHtml = imageSlide(brand, 'cover', '<h1 style="color: white;">Title</h1>', usedImages);
```

## Validation

The library validates:
1. Body dimensions must be 1280×720px
2. Content must not overflow body
3. Text must be in semantic HTML elements
4. Unwrapped text in DIVs is flagged

All errors collected and thrown together.

## Visual QA

After generating the PPTX:

```bash
# Generate thumbnail grid
python ../pptx/scripts/thumbnail.py output.pptx thumbnails --cols 4
```

Check for:
- Text cutoff or overlap
- Image positioning issues
- Color contrast problems
- Brand consistency (correct logo variant, correct colors)
- Image repetition on consecutive image slides
