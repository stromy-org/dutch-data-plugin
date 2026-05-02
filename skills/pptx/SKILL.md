---
name: pptx
description: "Presentation creation, editing, and analysis. When Claude needs to work with presentations (.pptx files) for: (1) Creating new presentations, (2) Modifying or editing content, (3) Working with layouts, (4) Adding comments or speaker notes, or any other presentation tasks"
license: Proprietary. LICENSE.txt has complete terms
---

# PPTX creation, editing, and analysis

## Overview

A user may ask you to create, edit, or analyze the contents of a .pptx file. A .pptx file is essentially a ZIP archive containing XML files and other resources that you can read or edit. You have different tools and workflows available for different tasks.

> **Logo & Image Sizing**: Never hardcode both width and height. Use `src/image-utils.js` (Node) or `src/image_utils.py` (Python) to compute aspect-ratio-preserving dimensions from the charter bounding box.

## Brand Architecture

This plugin defaults to **Ministerie van Economische Zaken en Klimaat (EZK)** brand data at `companies/nl-ez/`. Use this default unless the user explicitly names a different brand. For a non-default brand, use `companies/<slug>/` if that directory exists.

## Brand Data Integration

When creating a presentation for a **specific company or brand**, check for a brand charter before choosing colors and fonts manually.

### Discovering brand data
Default to `companies/nl-ez/charter.json` (Ministerie van EZK, this plugin's default brand). Override with `companies/<slug>/charter.json` only if the user explicitly names a different client. The charter provides:

- **Colors**: `primary`, `secondary`, `accent`, `background`, `backgroundAlt`, `text`, `textLight`, plus semantic colors (`success`, `warning`, `error`)
- **Fonts**: `heading` (family + weight + fallback), `body` (family + weight + fallback), `mono` (family + fallback)
- **Logo**: filename(s) in the same `brand/` directory (e.g. `logo.png`, `logo_white.png`) with max dimensions and `"sizing": "contain"` — the logo must fit within the `maxWidth`/`maxHeight` bounding box while preserving its natural aspect ratio (never stretch or squash)
- **Presentation spacing**: `slideMargin`, `titleMargin`, `contentMargin`, `aspectRatio`
- **Formatting rules**: `formatting.headingThreshold`, `formatting.accentCycleColors`, `formatting.autoContrastText`

### Using brand data in the freeform HTML workflow
When a charter exists, copy `build-branded.js` as your build scaffold instead of writing a raw `html2pptx` script:

```bash
mkdir -p workspace/my-deck
cp .claude/skills/pptx/scripts/build-branded.js workspace/my-deck/build.js
```

Then set `BRAND_DIR` in the copied file to point to the company brand directory:
```javascript
const BRAND_DIR = path.resolve(__dirname, '../../companies/nl-ez/brand');
```

This gives you:
- **`brandedSlide(html)`** helper — wraps your freeform HTML with brand CSS variables automatically injected
- **CSS variables** usable in your HTML: `var(--color-primary)`, `var(--color-secondary)`, `var(--color-text)`, `var(--color-background)`, `var(--font-heading)`, `var(--font-body)`, etc.
- **`logoPath`** — resolved absolute path to the company logo
- **`charter`** — the full charter object for reading any value directly
- **`renderGradientPng()`** — pre-render gradient backgrounds as PNG (CSS gradients not supported)

You still write freeform HTML (full creative control over layout), but the brand colors, fonts, and logo are pre-loaded and consistent.

### Image Sizing Rule — Preserve Aspect Ratio

**All images and logos must preserve their natural aspect ratio.** Never set both width and height to arbitrary values — this causes visible stretching/squashing.

The charter's `logo.maxWidth` / `logo.maxHeight` define a **bounding box**, not a target size. Fit the image within the box while keeping its proportions:

- **HTML workflow** (safe by default): Set only one CSS dimension (e.g. `height: 40pt`) and let the browser compute the other via `width: auto`. The `build-branded.js` scaffold already does this correctly.
- **PptxGenJS direct API**: Always read actual image dimensions and compute the other from the aspect ratio (see `html2pptx.md` "Adding Images" section).
- **OOXML editing**: Always derive `cy` from `cx` (or vice versa) using the source image's aspect ratio. Include `<a:picLocks noChangeAspect="1"/>` to prevent UI-level distortion (see `ooxml.md` "Images" section).

This rule applies to **all images**, not just logos — cover photos, charts, diagrams, etc.

### Brand photography — default deck structure

When the charter has an `images` block (`charter.images.catalog`), use brand photographs on cover, divider, and closing slides **by default**. This is the standard branded deck structure:

| Slide type | Purpose | Image role |
|------------|---------|------------|
| Cover (slide 1) | Title slide with full-bleed brand photo | `"cover"` |
| Divider | Section break between major topics | `"divider"` |
| Closing (last slide) | Thank-you / contact / CTA | `"closing"` |

**Image selection rules:**
1. Match the `roles` array — pick images whose `roles` include the current slide type
2. Rotate images — track used images in a `Set` to avoid repeating the same photo on consecutive image slides. When all images for a role are exhausted, reset and reuse.
3. Use `description` for topical relevance — when multiple images match a role, prefer the one whose description best fits the slide's content

**Overlay technique** (required — raw photos are too bright for text legibility):
- The charter provides `images.overlay.color` (a key like `"primary"` referencing `charter.colors`) and `images.overlay.opacity` (0–1 float)
- Pre-render the photo + semi-transparent color overlay as a single PNG using Sharp's `composite()` with an SVG overlay rect
- Use the composited PNG as `background-image: url(...); background-size: cover` in slide HTML
- This is necessary because CSS blend modes do not survive PPTX conversion

**Logo on image slides**: Use `charter.images.logoVariantOnImage` (e.g. `"white"`) to resolve the logo path for slides with dark photo backgrounds: `charter.logo[charter.images.logoVariantOnImage]` → `"logo_white.png"`

**Fallback**: When no `charter.images` block exists, skip brand photography entirely and use `brandedSlide()` with solid-color or gradient backgrounds for all slides.

The `build-branded.js` scaffold provides `brandImageSlide(role, bodyContent)` which handles image selection, overlay compositing, and fallback automatically.

### Pre-rendered PPTX assets (pptxAssets)

When the charter has a `pptxAssets` section, use pre-rendered presentation assets directly — no runtime Sharp compositing needed:

- **`pptxAssets.gradients`**: Pre-rendered gradient PNGs for branded slide backgrounds
- **`pptxAssets.overlays`**: Pre-rendered photo overlays (brand color + opacity already applied) for cover/divider/closing slides
- **`pptxAssets.motifs`**: Pre-rendered pattern tile PNGs for subtle background textures

**Resolution order:**
1. When `pptxAssets` exists: use pre-rendered assets directly as `background-image` in slide HTML
2. When `pptxAssets` doesn't exist but `images` catalog does: fall back to runtime compositing via Sharp (current behavior in `build-branded.js`)
3. When neither exists: use solid-color or gradient backgrounds only (via `renderGradientPng()`)

**Image selection with extended metadata:**
- Use the `mood` tag (when available) for contextual matching — e.g., prefer `"mood": "bold"` images for cover slides, `"mood": "calm"` for closing slides
- Use `orientation` to pick images suited to the layout — landscape for full-bleed, portrait for split layouts
- Track used images to avoid repetition (already documented above)

### Diagram Integration

When a slide would benefit from a process flow, architecture diagram, org chart, timeline, or other structural visual, use the `diagram` skill to generate a branded PNG. The diagram skill reads the same charter and produces images that match brand colors and typography. Embed the resulting PNG using the same image embedding pattern as logos and brand photography.

### CSS variable discipline

**Always use CSS variables from `_base.css` instead of hardcoded hex values** when writing slide HTML. This ensures slides update automatically if the charter changes.

| Instead of | Use |
|-----------|-----|
| `#FF7F66` | `var(--color-primary)` |
| `#DFDFE0` | `var(--color-secondary)` |
| `#807F83` | `var(--color-text)` |
| `#FFFFFF` | `var(--color-background)` |
| `#F5F5F5` | `var(--color-background-alt)` |
| `Tahoma, Arial, sans-serif` | `var(--font-heading)` |
| `Verdana, Arial, sans-serif` | `var(--font-body)` |

**Spacing variables** (from charter `presentation` section):
- `var(--slide-margin)` — outer slide margin (default `40pt`)
- `var(--title-margin)` — margin around title elements (default `30pt`)
- `var(--content-margin)` — margin around body content (default `20pt`)

**Exceptions** — these values can be hardcoded:
- `white`, `black`, `transparent` — structural/universal colors
- Specific pixel/pt values for margins, padding, font sizes, positioning
- One-off accent colors not in the charter (rare — prefer charter colors)

### Company identity data
When a company directory exists, also check for `profile.json` at `companies/nl-ez/profile.json`. If present, use company identity fields for presentation slides:

- **`company.name`** — title slides, headers, footers
- **`company.tagline`** — subtitle text on title/cover slides
- **`company.website`** and **`company.email`** — closing/contact slides

Load only the `company` block — other profile fields (services, pricing, legal) are not relevant for presentations.

### Author & contact metadata
When a company directory exists, check for `people.json` at `companies/nl-ez/people.json`. If present, use it for author metadata in footers, contact slides, and file properties. Filter by `roles` containing `"author"` — if one person has `"default": true`, auto-select them.

### Applying formatting rules
If the charter has a `formatting` section, apply these rules:

- **`headingThreshold`** (default 24): Apply the heading font to any text element >= this pt size. Text below the threshold uses the body font.
- **`accentCycleColors`** (e.g. `["accent", "secondary", "primary"]`): Cycle through these charter color keys when coloring accent shapes, divider lines, or multi-item highlights.
- **`autoContrastText`**: When `true`, automatically pick white or dark text based on the background luminance of the shape or slide behind it.

### When there is no brand charter
If no charter exists for the company (or no company is specified), skip this section entirely and use the generic color palettes and workflow below.

## Output Location

**Default**: `<projectRoot>/output/<deliverable>/` — auto-detected from build script location using `src/workspace.js`.
**Override**: If the prompt specifies a target output directory, pass it as `{ outputDir: '<path>' }`.
**Discovery**: Before creating new output, check the project's `output/` folder for existing deliverables. Briefly mention what you find, then proceed with the current task. Do NOT modify existing files unless explicitly asked.
**Iteration**: When asked to edit/rework an existing file, work on it in place (overwrite).

### Build script output setup

```javascript
const { ensureOutputDir } = require('../../src/workspace');
const outputDir = ensureOutputDir(__dirname);
// → workspace/<client>/output/<deliverable>/
```

## Reading and analyzing content

### Text extraction
If you just need to read the text contents of a presentation, you should convert the document to markdown:

```bash
# Convert document to markdown
python -m markitdown path-to-file.pptx
```

### Raw XML access
You need raw XML access for: comments, speaker notes, slide layouts, animations, design elements, and complex formatting. For any of these features, you'll need to unpack a presentation and read its raw XML contents.

#### Unpacking a file
`python ooxml/scripts/unpack.py <office_file> <output_dir>`

**Note**: The unpack.py script is located at `skills/pptx/ooxml/scripts/unpack.py` relative to the project root. If the script doesn't exist at this path, use `find . -name "unpack.py"` to locate it.

#### Key file structures
* `ppt/presentation.xml` - Main presentation metadata and slide references
* `ppt/slides/slide{N}.xml` - Individual slide contents (slide1.xml, slide2.xml, etc.)
* `ppt/notesSlides/notesSlide{N}.xml` - Speaker notes for each slide
* `ppt/comments/modernComment_*.xml` - Comments for specific slides
* `ppt/slideLayouts/` - Layout templates for slides
* `ppt/slideMasters/` - Master slide templates
* `ppt/theme/` - Theme and styling information
* `ppt/media/` - Images and other media files

#### Typography and color extraction
**When given an example design to emulate**: Always analyze the presentation's typography and colors first using the methods below:
1. **Read theme file**: Check `ppt/theme/theme1.xml` for colors (`<a:clrScheme>`) and fonts (`<a:fontScheme>`)
2. **Sample slide content**: Examine `ppt/slides/slide1.xml` for actual font usage (`<a:rPr>`) and colors
3. **Search for patterns**: Use grep to find color (`<a:solidFill>`, `<a:srgbClr>`) and font references across all XML files

---

## Creating a new PowerPoint presentation

When creating a new PowerPoint presentation from scratch, use the **html2pptx** workflow to convert HTML slides to PowerPoint with accurate positioning.

### Design Approach

**Before writing any code**, read [references/design-guide.md](references/design-guide.md) for color palettes, visual element options, and layout guidance. When a brand charter exists, skip the design guide and use charter colors/fonts directly.

The skill aims for **ambitious, creative, and professional** slide designs. Avoid generic or safe defaults — match the visual approach to the subject matter, audience, and tone.

**Requirements**:
- ✅ State your content-informed design approach BEFORE writing code
- ✅ Use web-safe fonts only: Arial, Helvetica, Times New Roman, Georgia, Courier New, Verdana, Tahoma, Trebuchet MS, Impact
- ✅ Create clear visual hierarchy through size, weight, and color
- ✅ Ensure readability: strong contrast, appropriately sized text, clean alignment
- ✅ Be consistent: repeat patterns, spacing, and visual language across slides
- ✅ Use real company data from profile.json, people.json, proposals/, messaging/ — never placeholder text when real content exists
- ✅ Mix imagery treatments — never apply the same photo overlay uniformly to all slides
- ✅ Pre-render ALL gradients, SVG motifs, and decorative elements as PNG via Sharp before use in HTML

### Workflow
1. **MANDATORY - READ ENTIRE FILE**: Read [`html2pptx.md`](html2pptx.md) completely from start to finish. **NEVER set any range limits when reading this file.** Read the full file content for detailed syntax, critical formatting rules, and best practices before proceeding with presentation creation.
1b. **(If branded)** When a brand charter exists, copy `build-branded.js` as your build scaffold:
    ```bash
    mkdir -p workspace/my-deck
    cp .claude/skills/pptx/scripts/build-branded.js workspace/my-deck/build.js
    ```
    Then set `BRAND_DIR` in the copied `build.js` to the company brand directory. Use the `brandedSlide()` helper to wrap each slide's HTML — it automatically injects brand CSS variables (`var(--color-primary)`, `var(--font-heading)`, etc.) so your freeform HTML stays on-brand. Skip to step 3 for the build script structure; steps 2-3 below are for the unbranded path.
2. Create an HTML file for each slide with proper dimensions (e.g., 720pt × 405pt for 16:9)
   - Use `<p>`, `<h1>`-`<h6>`, `<ul>`, `<ol>` for all text content
   - Use `class="placeholder"` for areas where charts/tables will be added (render with gray background for visibility)
   - **CRITICAL**: Rasterize gradients and icons as PNG images FIRST using Sharp, then reference in HTML
   - **LAYOUT**: For slides with charts/tables/images, use either full-slide layout or two-column layout for better readability
3. Create and run a JavaScript file using the [`html2pptx.js`](scripts/html2pptx.js) library to convert HTML slides to PowerPoint and save the presentation
   - Use the `html2pptx()` function to process each HTML file
   - Add charts and tables to placeholder areas using PptxGenJS API
   - Save the presentation using `pptx.writeFile()`
4. **Visual validation**: Generate thumbnails and inspect for layout issues
   - Create thumbnail grid: `python scripts/thumbnail.py workspace/<project>/output/output.pptx workspace/<project>/output/thumbnails --cols 4`
   - Read and carefully examine the thumbnail image for:
     - **Text cutoff**: Text being cut off by header bars, shapes, or slide edges
     - **Text overlap**: Text overlapping with other text or shapes
     - **Positioning issues**: Content too close to slide boundaries or other elements
     - **Contrast issues**: Insufficient contrast between text and backgrounds
   - If issues found, adjust HTML margins/spacing/colors and regenerate the presentation
   - Repeat until all slides are visually correct

## Editing an existing PowerPoint presentation

When editing slides in an existing PowerPoint presentation, you need to work with the raw Office Open XML (OOXML) format. This involves unpacking the .pptx file, editing the XML content, and repacking it.

### Iterating on a workspace deliverable

When the user asks to edit a PPTX that was previously generated in a workspace project:

1. Look in `workspace/<client>/output/<deliverable>/` for the `.pptx` file (fall back to `workspace/<project>/output/` for legacy projects)
2. Unpack it to `workspace/<client>/build/<deliverable>/unpacked/`
3. Apply edits using the OOXML workflow below
4. Repack to the same file path in `output/`

This avoids regenerating from scratch — the build script creates the first draft, and the edit workflow refines it.

### Workflow
1. **MANDATORY - READ ENTIRE FILE**: Read [`ooxml.md`](ooxml.md) (~500 lines) completely from start to finish.  **NEVER set any range limits when reading this file.**  Read the full file content for detailed guidance on OOXML structure and editing workflows before any presentation editing.
2. Unpack the presentation: `python ooxml/scripts/unpack.py <office_file> <output_dir>`
3. Edit the XML files (primarily `ppt/slides/slide{N}.xml` and related files)
4. **CRITICAL**: Validate immediately after each edit and fix any validation errors before proceeding: `python ooxml/scripts/validate.py <dir> --original <file>`
5. Pack the final presentation: `python ooxml/scripts/pack.py <input_directory> <office_file>`

## Creating Thumbnail Grids

To create visual thumbnail grids of PowerPoint slides for quick analysis and reference:

```bash
python scripts/thumbnail.py template.pptx [output_prefix]
```

**Features**:
- Creates: `thumbnails.jpg` (or `thumbnails-1.jpg`, `thumbnails-2.jpg`, etc. for large decks)
- Default: 5 columns, max 30 slides per grid (5×6)
- Custom prefix: `python scripts/thumbnail.py template.pptx my-grid`
  - Note: The output prefix should include the path if you want output in a specific directory (e.g., `workspace/my-grid`)
- Adjust columns: `--cols 4` (range: 3-6, affects slides per grid)
- Grid limits: 3 cols = 12 slides/grid, 4 cols = 20, 5 cols = 30, 6 cols = 42
- Slides are zero-indexed (Slide 0, Slide 1, etc.)

**Use cases**:
- Template analysis: Quickly understand slide layouts and design patterns
- Content review: Visual overview of entire presentation
- Navigation reference: Find specific slides by their visual appearance
- Quality check: Verify all slides are properly formatted

**Examples**:
```bash
# Basic usage
python scripts/thumbnail.py presentation.pptx

# Combine options: custom name, columns
python scripts/thumbnail.py template.pptx analysis --cols 4
```

## Converting Slides to Images

To visually analyze PowerPoint slides, convert them to images using a two-step process:

1. **Convert PPTX to PDF**:
   ```bash
   soffice --headless --convert-to pdf template.pptx
   ```

2. **Convert PDF pages to JPEG images**:
   ```bash
   pdftoppm -jpeg -r 150 template.pdf slide
   ```
   This creates files like `slide-1.jpg`, `slide-2.jpg`, etc.

Options:
- `-r 150`: Sets resolution to 150 DPI (adjust for quality/size balance)
- `-jpeg`: Output JPEG format (use `-png` for PNG if preferred)
- `-f N`: First page to convert (e.g., `-f 2` starts from page 2)
- `-l N`: Last page to convert (e.g., `-l 5` stops at page 5)
- `slide`: Prefix for output files

Example for specific range:
```bash
pdftoppm -jpeg -r 150 -f 2 -l 5 template.pdf slide  # Converts only pages 2-5
```

## Code Style Guidelines
**IMPORTANT**: When generating code for PPTX operations:
- Write concise code
- Avoid verbose variable names and redundant operations
- Avoid unnecessary print statements

## Dependencies

Required dependencies (should already be installed):

- **markitdown**: `pip install "markitdown[pptx]"` (for text extraction from presentations)
- **pptxgenjs**: pre-installed in root `node_modules` (for creating presentations via html2pptx)
- **playwright**: pre-installed in root `node_modules` (for HTML rendering in html2pptx)
- **react-icons**: pre-installed in root `node_modules` with react and react-dom (for icons)
- **sharp**: pre-installed in root `node_modules` (for SVG rasterization and image processing)
- **LibreOffice**: `sudo apt-get install libreoffice` (for PDF conversion)
- **Poppler**: `sudo apt-get install poppler-utils` (for pdftoppm to convert PDF to images)
- **defusedxml**: `pip install defusedxml` (for secure XML parsing)
