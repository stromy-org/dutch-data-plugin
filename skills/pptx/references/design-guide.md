# Design Guide for Presentations

Design principles, color palettes, visual elements, and layout guidance for creating presentations without a brand charter.

> **When a brand charter exists**: Skip this guide entirely — use `colors.primary`, `colors.secondary`, `colors.accent`, etc. from the charter directly (or via CSS variables if using `build-branded.js`). This guide is only for presentations without a brand identity.

## Design Principles

**CRITICAL**: Before creating any presentation, analyze the content and choose appropriate design elements:
1. **Check for brand data first**: If the user specifies a company or brand, look for `charter.json` at `client-data/clients/<name>/`. When a charter exists, use its colors and fonts — do NOT pick from the generic palettes below. See [Brand Data Integration](../SKILL.md#brand-data-integration).
2. **Consider the subject matter**: What is this presentation about? What tone, industry, or mood does it suggest?
3. **Match palette to content**: If no brand charter exists, select colors that reflect the subject
4. **State your approach**: Explain your design choices before writing code

## Color Palette Selection

**Choosing colors creatively**:
- **Think beyond defaults**: What colors genuinely match this specific topic? Avoid autopilot choices.
- **Consider multiple angles**: Topic, industry, mood, energy level, target audience, brand identity (if mentioned)
- **Be adventurous**: Try unexpected combinations - a healthcare presentation doesn't have to be green, finance doesn't have to be navy
- **Build your palette**: Pick 3-5 colors that work together (dominant colors + supporting tones + accent)
- **Ensure contrast**: Text must be clearly readable on backgrounds

**Example color palettes** (use these to spark creativity - choose one, adapt it, or create your own):

1. **Classic Blue**: Deep navy (#1C2833), slate gray (#2E4053), silver (#AAB7B8), off-white (#F4F6F6)
2. **Teal & Coral**: Teal (#5EA8A7), deep teal (#277884), coral (#FE4447), white (#FFFFFF)
3. **Bold Red**: Red (#C0392B), bright red (#E74C3C), orange (#F39C12), yellow (#F1C40F), green (#2ECC71)
4. **Warm Blush**: Mauve (#A49393), blush (#EED6D3), rose (#E8B4B8), cream (#FAF7F2)
5. **Burgundy Luxury**: Burgundy (#5D1D2E), crimson (#951233), rust (#C15937), gold (#997929)
6. **Deep Purple & Emerald**: Purple (#B165FB), dark blue (#181B24), emerald (#40695B), white (#FFFFFF)
7. **Cream & Forest Green**: Cream (#FFE1C7), forest green (#40695B), white (#FCFCFC)
8. **Pink & Purple**: Pink (#F8275B), coral (#FF574A), rose (#FF737D), purple (#3D2F68)
9. **Lime & Plum**: Lime (#C5DE82), plum (#7C3A5F), coral (#FD8C6E), blue-gray (#98ACB5)
10. **Black & Gold**: Gold (#BF9A4A), black (#000000), cream (#F4F6F6)
11. **Sage & Terracotta**: Sage (#87A96B), terracotta (#E07A5F), cream (#F4F1DE), charcoal (#2C2C2C)
12. **Charcoal & Red**: Charcoal (#292929), red (#E33737), light gray (#CCCBCB)
13. **Vibrant Orange**: Orange (#F96D00), light gray (#F2F2F2), charcoal (#222831)
14. **Forest Green**: Black (#191A19), green (#4E9F3D), dark green (#1E5128), white (#FFFFFF)
15. **Retro Rainbow**: Purple (#722880), pink (#D72D51), orange (#EB5C18), amber (#F08800), gold (#DEB600)
16. **Vintage Earthy**: Mustard (#E3B448), sage (#CBD18F), forest green (#3A6B35), cream (#F4F1DE)
17. **Coastal Rose**: Old rose (#AD7670), beaver (#B49886), eggshell (#F3ECDC), ash gray (#BFD5BE)
18. **Orange & Turquoise**: Light orange (#FC993E), grayish turquoise (#667C6F), white (#FCFCFC)

## Visual Details Options

**Geometric Patterns**:
- Diagonal section dividers instead of horizontal
- Asymmetric column widths (30/70, 40/60, 25/75)
- Rotated text headers at 90° or 270°
- Circular/hexagonal frames for images
- Triangular accent shapes in corners
- Overlapping shapes for depth

**Border & Frame Treatments**:
- Thick single-color borders (10-20pt) on one side only
- Double-line borders with contrasting colors
- Corner brackets instead of full frames
- L-shaped borders (top+left or bottom+right)
- Underline accents beneath headers (3-5pt thick)

**Typography Treatments**:
- Extreme size contrast (72pt headlines vs 11pt body)
- All-caps headers with wide letter spacing
- Numbered sections in oversized display type
- Monospace (Courier New) for data/stats/technical content
- Condensed fonts (Arial Narrow) for dense information
- Outlined text for emphasis

**Chart & Data Styling**:
- Monochrome charts with single accent color for key data
- Horizontal bar charts instead of vertical
- Dot plots instead of bar charts
- Minimal gridlines or none at all
- Data labels directly on elements (no legends)
- Oversized numbers for key metrics

**Layout Innovations**:
- Full-bleed images with text overlays
- Sidebar column (20-30% width) for navigation/context
- Modular grid systems (3×3, 4×4 blocks)
- Z-pattern or F-pattern content flow
- Floating text boxes over colored shapes
- Magazine-style multi-column layouts

**Background Treatments**:
- Solid color blocks occupying 40-60% of slide
- Gradient fills (vertical or diagonal only)
- Split backgrounds (two colors, diagonal or vertical)
- Edge-to-edge color bands
- Negative space as a design element

## Layout Tips

**When creating slides with charts or tables:**
- **Two-column layout (PREFERRED)**: Use a header spanning the full width, then two columns below - text/bullets in one column and the featured content in the other. This provides better balance and makes charts/tables more readable. Use flexbox with unequal column widths (e.g., 40%/60% split) to optimize space for each content type.
- **Full-slide layout**: Let the featured content (chart/table) take up the entire slide for maximum impact and readability
- **NEVER vertically stack**: Do not place charts/tables below text in a single column - this causes poor readability and layout issues

## Imagery Strategy: Mix Treatments

A branded deck should use **visual variety**, not a single treatment applied uniformly.

### Treatment Mix (for a 30-slide deck)

| Treatment | Slides | When to Use |
|---|---|---|
| **Brand overlay** (photo + brand color at charter opacity) | 3-4 slides | Cover, closing, hero moments — high-impact brand statements |
| **Clean B&W** (original photos, no overlay) | 4-5 slides | Sophistication — accent strips, half-slide crops, card backgrounds |
| **Solid dark** (#222222 or near-black) | 4-5 slides | Data-heavy slides, agendas, dividers — lets content breathe |
| **Solid white** with brand accents | 8-10 slides | Content slides, methodology, service details — clean and readable |
| **Gradient backgrounds** (pre-rendered PNG) | 2-3 slides | Transitions, "the ask", visual variety |
| **Motif/pattern** backgrounds | 2-3 slides | Dividers, section breaks — subtle brand texture |

### Image Insertion Modes

Don't just use full-bleed backgrounds. Vary how images appear:

- **Full-bleed background**: Photo covers entire slide, text overlaid with gradient scrim
- **Half-slide split**: Photo on left/right half, content on other half
- **Accent strip**: Thin horizontal band (e.g., bottom 80pt) with a cropped photo
- **Card inset**: Small rounded-corner photo inside a content card
- **Grid/mosaic**: Multiple small images in a grid (e.g., 2×2 for portfolio)
- **Circle crop**: Pre-render circular crop via Sharp for team headshots or icons
- **Faded edge**: Photo fades to solid color via pre-rendered gradient overlay

## Pre-Rendering Decorative Assets

Since CSS gradients and SVGs don't survive html2pptx conversion, pre-render everything as PNG:

```javascript
const sharp = require('sharp');

// Gradient background
async function renderGradient(color1, color2, width, height, outputPath) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${color1}"/>
      <stop offset="100%" stop-color="${color2}"/>
    </linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
  </svg>`;
  await sharp(Buffer.from(svg)).png().toFile(outputPath);
}

// SVG motif rasterization
async function renderSVG(svgPath, width, outputPath) {
  await sharp(svgPath).resize(width).png().toFile(outputPath);
}

// Photo with gradient scrim (dark fade at bottom for text legibility)
async function addGradientScrim(photoPath, outputPath) {
  const meta = await sharp(photoPath).metadata();
  const scrimSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${meta.width}" height="${meta.height}">
    <defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="black" stop-opacity="0"/>
      <stop offset="100%" stop-color="black" stop-opacity="0.7"/>
    </linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#s)"/>
  </svg>`;
  await sharp(photoPath)
    .composite([{ input: Buffer.from(scrimSvg), blend: 'over' }])
    .toFile(outputPath);
}
```

## Image Aspect Ratio — Split Layout Crops

**CRITICAL**: Never set both `width` and `height` on `<img>` tags to values that don't match the source image's aspect ratio. This causes visible stretching in PowerPoint.

For split-layout slides (image fills one side of the slide), pre-crop images to the exact target ratio:

```javascript
async function cropForLayout(inputPath, outputPath, targetW, targetH) {
  const meta = await sharp(inputPath).metadata();
  const targetRatio = targetW / targetH;
  const sourceRatio = meta.width / meta.height;

  let cropW, cropH;
  if (sourceRatio > targetRatio) {
    cropH = meta.height;
    cropW = Math.round(meta.height * targetRatio);
  } else {
    cropW = meta.width;
    cropH = Math.round(meta.width / targetRatio);
  }

  await sharp(inputPath)
    .extract({
      left: Math.round((meta.width - cropW) / 2),
      top: Math.round((meta.height - cropH) / 2),
      width: cropW,
      height: cropH
    })
    .resize(targetW * 2, targetH * 2) // 2x for retina sharpness
    .jpeg({ quality: 90 })
    .toFile(outputPath);
}
```

Common crop targets:
| Layout | Target dimensions | Aspect ratio |
|--------|------------------|--------------|
| Left/right split strip | 240pt x 405pt | ~3:5 |
| Bottom accent strip | 720pt x 80pt | 9:1 |
| Card inset | 200pt x 125pt | 8:5 |
| Half-slide | 360pt x 405pt | ~9:10 |
| Square card | 180pt x 180pt | 1:1 |

Always pre-crop with Sharp, then set the img element to the exact same dimensions.

## Deck Structure: Story Arc

A branded deck should tell a coherent story, not just show layout options:

```
Opening (3-4 slides)
  → Cover, Agenda, Positioning, Story/Timeline

Core Message (3-5 slides)
  → Key concept, Pillars/Framework, Methodology

People (3-4 slides)
  → Leadership, Experts, Team, Network/Partners

Capabilities (4-6 slides)
  → Service overview, Deep-dives, Technology differentiator

Evidence (4-6 slides)
  → Impact metrics, Case studies, Testimonials

Differentiation (2-3 slides)
  → Competitive comparison, Unique value

Close (3-4 slides)
  → Next steps, Contact, Divider, Thank you

Utility (2-3 slides)
  → Blank templates, Data table template
```

## Multi-Variant Slide Types

A comprehensive deck should offer **2-3 design variants** for commonly used slide types:

| Slide Type | Variant A | Variant B | Variant C |
|------------|-----------|-----------|-----------|
| **Agenda** | Numbered list (dark bg) | Visual grid (numbered circles) | Timeline with dots |
| **Content** | White bg, left-aligned | Dark bg, white text | Two-column with divider |
| **Data/KPI** | Card row (3-4 metrics) | Single big number + context | Comparison table |
| **Image** | Full-bleed background | Half-slide split | Image card with text |
| **Divider** | Brand background | Dark with motif | Bridge photo with overlay |
| **Closing** | Thank you + photo | Contact details | Next steps list |

## Typography Scale

Establish a clear hierarchy and use it consistently:

| Level | Size | Weight | Color | Usage |
|---|---|---|---|---|
| Display | 36-42pt | Bold (700) | White or Dark | Cover title, hero statements |
| H1 | 28-32pt | SemiBold (600) | Primary or Dark | Slide titles |
| H2 | 20-24pt | SemiBold (600) | Primary | Section headings |
| Body | 14-16pt | Regular (400) | Text grey | Paragraphs, descriptions |
| Caption | 11-12pt | Regular (400) | Text grey | Footnotes, attributions |
| Metric | 42-56pt | Bold (700) | Primary | KPI numbers, stats |

## Visual Validation Loop

**Never ship without visual review.** The feedback loop is:

1. **Generate PPTX** — run build script
2. **Create thumbnails** — `python scripts/thumbnail.py output.pptx thumbnails --cols 5`
3. **Read thumbnail image** — examine every slide for:
   - Text cutoff or overflow
   - Text overlap with other elements
   - Positioning too close to edges
   - Contrast/readability issues
   - Alignment inconsistencies across slides
   - Image quality (pixelated, stretched, mispositioned)
4. **Fix issues** — adjust HTML, regenerate affected slides
5. **Re-thumbnail and re-review** — repeat until clean

**Minimum iterations**: 2 (initial build + one fix pass). Complex decks may need 3-4.
