---
name: pdf
description: Comprehensive PDF manipulation toolkit for extracting text and tables, creating new PDFs, merging/splitting documents, and handling forms. When Claude needs to fill in a PDF form or programmatically process, generate, or analyze PDF documents at scale.
license: Proprietary. LICENSE.txt has complete terms
---

# PDF Processing Guide

## Overview

This guide covers essential PDF processing operations using Python libraries and command-line tools. For advanced features, JavaScript libraries, and detailed examples, see reference.md. If you need to fill out a PDF form, read forms.md and follow its instructions.

> **Logo & Image Sizing**: Never hardcode both width and height. Use `src/image-utils.js` (Node) or `src/image_utils.py` (Python) to compute aspect-ratio-preserving dimensions from the charter bounding box.

## Brand Architecture

This plugin defaults to **Ministerie van Economische Zaken en Klimaat (EZK)** brand data at `companies/nl-ez/`. Use this default unless the user explicitly names a different brand.

## Brand Data Integration

When creating a PDF for a **specific company or brand** (via reportlab), check for a brand charter before choosing colors and fonts manually. This is optional — when no brand is specified, produce an unbranded PDF with default styling. This section only applies to **PDF creation** (reportlab), not to reading, merging, splitting, or form-filling operations.

### Discovering brand data
Default to `companies/nl-ez/charter.json` (Ministerie van EZK). Override with `companies/<slug>/charter.json` only if the user explicitly names a different client. The charter provides:

- **Colors**: `primary`, `secondary`, `accent`, `background`, `backgroundAlt`, `text`, `textLight`, plus semantic colors (`success`, `warning`, `error`)
- **Fonts**: `heading` (family + weight + fallback), `body` (family + weight + fallback), `mono` (family + fallback)
- **Logo**: filename(s) in the same `brand/` directory (e.g. `logo.png`, `logo_white.png`) with max dimensions and `"sizing": "contain"` — the logo must fit within the `maxWidth`/`maxHeight` bounding box while preserving its natural aspect ratio (never stretch or squash)
- **Document settings**: `document.margins` (top/bottom/left/right), `document.header`, `document.footer`, `document.headingColor`, `document.tableHeaderColor`
- **Formatting rules**: `formatting.headingThreshold`, `formatting.accentCycleColors`, `formatting.autoContrastText`

### Applying brand data in reportlab

When a charter exists, read it and map fields to reportlab styles:

```python
import json
from pathlib import Path
from reportlab.lib.colors import HexColor
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

brand_dir = Path('companies/nl-ez/brand')
charter = json.loads((brand_dir / 'charter.json').read_text())

# Colors
primary = HexColor(charter['colors']['primary'])
text_color = HexColor(charter['colors']['text'])

# Fonts (reportlab uses standard font names; charter fonts are web-safe)
heading_font = charter['fonts']['heading']['family']     # e.g. "Tahoma"
heading_fallback = charter['fonts']['heading']['fallback']  # e.g. "Arial, sans-serif"
body_font = charter['fonts']['body']['family']           # e.g. "Verdana"
body_fallback = charter['fonts']['body']['fallback']     # e.g. "Arial, sans-serif"

# Document margins and table header color
margins = charter.get('document', {}).get('margins', {})
table_header_color = HexColor(charter['colors'][charter.get('document', {}).get('tableHeaderColor', 'primary')])

# Logo
logo_path = str(brand_dir / (charter.get('logo', {}).get('primary', 'logo.png')))

# Build branded styles
styles = getSampleStyleSheet()
styles.add(ParagraphStyle('BrandHeading', parent=styles['Heading1'],
    fontName=heading_font, textColor=primary))
styles.add(ParagraphStyle('BrandBody', parent=styles['Normal'],
    fontName=body_font, textColor=text_color))
```

Key mappings:

| Charter field | reportlab usage |
|--------------|-----------------|
| `colors.primary` | `HexColor` for headings, table headers, accent lines |
| `colors.text` | `textColor` on body ParagraphStyles |
| `fonts.heading.family` | `fontName` on heading styles |
| `fonts.body.family` | `fontName` on body styles |
| `document.margins` | `SimpleDocTemplate` margin parameters |
| `document.tableHeaderColor` | Background color for table header rows |
| `logo.primary` | `Image()` flowable or `drawImage()` on canvas — **always** use `preserveAspectRatio=True` (see Image Sizing Rule below) |
| `fonts.*.fallback` | Fallback font stack if primary font unavailable |
| `formatting.headingThreshold` | Apply heading font to text >= this pt size |
| `formatting.accentCycleColors` | Cycle charter color keys for accent lines, callout boxes |
| `formatting.autoContrastText` | Auto-pick text color on colored backgrounds |

### Image Sizing Rule — Preserve Aspect Ratio

**All images and logos must preserve their natural aspect ratio.** Never set both width and height to arbitrary values — this causes visible stretching/squashing.

The charter's `logo.maxWidth` / `logo.maxHeight` define a **bounding box**, not a target size. Fit the image within the box while keeping its proportions:

```python
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[3] / 'src'))
from image_utils import fit_logo_from_charter

dims = fit_logo_from_charter(logo_path, charter['logo'])
# dims = {'width': 39.5, 'height': 50, 'unit': 'pt', 'natural_width': 400, 'natural_height': 506}

# Canvas: use preserveAspectRatio=True as a safety net
canvas.drawImage(logo_path, x, y, width=dims['width'], height=dims['height'],
                 preserveAspectRatio=True, mask='auto')

# Flowable: use computed dimensions (Image() has no preserveAspectRatio param)
from reportlab.platypus import Image
logo = Image(logo_path, width=dims['width'], height=dims['height'])
```

This rule applies to **all images**, not just logos — cover page photos, section images, charts, etc. When inserting any image, always read its actual dimensions and compute proportional width/height. For `canvas.drawImage()`, always pass `preserveAspectRatio=True` as an additional safety net.

### Brand photography — default document structure

When the charter has an `images` block (`charter.images.catalog`), use brand photographs for cover pages and section headers **by default**:

| Page type | Purpose | Image role |
|-----------|---------|------------|
| Cover page | Full-width background image on page 1 | `"cover"` |
| Section header | Image strip between major sections | `"divider"` |
| Closing page | Final page with contact info / CTA | `"closing"` |

**Image selection rules:**
1. Match the `roles` array — pick images whose `roles` include the current page type
2. Rotate images — avoid repeating the same photo on consecutive image pages
3. Use `description` for topical relevance — prefer images whose description fits the section's content

**Overlay technique** (required for text legibility on photos):
- The charter provides `images.overlay.color` (a key like `"primary"` referencing `charter.colors`) and `images.overlay.opacity` (0–1 float)
- Pre-composite the photo + semi-transparent color overlay as a single PNG using Pillow (`Image.blend()` or paste with alpha mask) before drawing with `canvas.drawImage()`
- This ensures the overlay is baked into the image (reportlab has no CSS-style blend modes)

**Logo on image pages**: Use `charter.images.logoVariantOnImage` (e.g. `"white"`) to resolve the white logo variant for dark photo backgrounds.

**Fallback**: When no `charter.images` block exists, skip brand photography and use solid-color headers/accents only.

### Diagram Integration

When a page would benefit from a process flow, architecture diagram, org chart, timeline, or other structural visual, use the `diagram` skill to generate a branded PNG. The diagram skill reads the same charter and produces images that match brand colors and typography. Embed the resulting PNG using the same image embedding pattern as logos and brand photography.

### Company identity data
When a company directory exists, also check for `profile.json` at `companies/nl-ez/profile.json`. If present, use company identity fields:

- **`company.name`** — headers, footers, title pages
- **`company.tagline`** — subtitle text on cover pages

Load only the `company` block — other profile fields (services, pricing, legal) are not relevant for PDF generation.

### Author & contact metadata
When a company directory exists, check for `people.json` at `companies/nl-ez/people.json`. If present, use it for author metadata in footers, contact blocks, and PDF document properties. Filter by `roles` containing `"author"` — if one person has `"default": true`, auto-select them.

### Applying formatting rules
If the charter has a `formatting` section, apply these rules:

- **`headingThreshold`** (default 24): Apply the heading font to any text element >= this pt size. Text below the threshold uses the body font.
- **`accentCycleColors`** (e.g. `["accent", "secondary", "primary"]`): Cycle through these charter color keys when coloring accent lines, divider rules, or callout box backgrounds.
- **`autoContrastText`**: When `true`, auto-select white or dark text on colored backgrounds (cover pages, table headers, callout boxes).

### When there is no brand charter
If no charter exists for the company (or no company is specified), skip this section entirely and use reportlab's default `getSampleStyleSheet()`. Do not invent brand colors.

## Output Location

**Default**: `<projectRoot>/output/<deliverable>/` — auto-detected from build script location.
**Override**: If the prompt specifies a target output directory, use that path instead.
**Discovery**: Before creating new output, check the project's `output/` folder for existing deliverables. Briefly mention what you find, then proceed with the current task. Do NOT modify existing files unless explicitly asked.
**Iteration**: When asked to edit/rework an existing file, work on it in place (overwrite).

### Python build script output setup

```python
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[3] / 'src'))
from workspace import ensure_output_dir

output_dir = ensure_output_dir(__file__)
# → workspace/<client>/output/<deliverable>/
doc.build(str(output_dir / 'report.pdf'))
```

## Quick Start

```python
from pypdf import PdfReader, PdfWriter

# Read a PDF
reader = PdfReader("document.pdf")
print(f"Pages: {len(reader.pages)}")

# Extract text
text = ""
for page in reader.pages:
    text += page.extract_text()
```

## Python Libraries

### pypdf - Basic Operations

#### Merge PDFs
```python
from pypdf import PdfWriter, PdfReader

writer = PdfWriter()
for pdf_file in ["doc1.pdf", "doc2.pdf", "doc3.pdf"]:
    reader = PdfReader(pdf_file)
    for page in reader.pages:
        writer.add_page(page)

with open("merged.pdf", "wb") as output:
    writer.write(output)
```

#### Split PDF
```python
reader = PdfReader("input.pdf")
for i, page in enumerate(reader.pages):
    writer = PdfWriter()
    writer.add_page(page)
    with open(f"page_{i+1}.pdf", "wb") as output:
        writer.write(output)
```

#### Extract Metadata
```python
reader = PdfReader("document.pdf")
meta = reader.metadata
print(f"Title: {meta.title}")
print(f"Author: {meta.author}")
print(f"Subject: {meta.subject}")
print(f"Creator: {meta.creator}")
```

#### Rotate Pages
```python
reader = PdfReader("input.pdf")
writer = PdfWriter()

page = reader.pages[0]
page.rotate(90)  # Rotate 90 degrees clockwise
writer.add_page(page)

with open("rotated.pdf", "wb") as output:
    writer.write(output)
```

### pdfplumber - Text and Table Extraction

#### Extract Text with Layout
```python
import pdfplumber

with pdfplumber.open("document.pdf") as pdf:
    for page in pdf.pages:
        text = page.extract_text()
        print(text)
```

#### Extract Tables
```python
with pdfplumber.open("document.pdf") as pdf:
    for i, page in enumerate(pdf.pages):
        tables = page.extract_tables()
        for j, table in enumerate(tables):
            print(f"Table {j+1} on page {i+1}:")
            for row in table:
                print(row)
```

#### Advanced Table Extraction
```python
import pandas as pd

with pdfplumber.open("document.pdf") as pdf:
    all_tables = []
    for page in pdf.pages:
        tables = page.extract_tables()
        for table in tables:
            if table:  # Check if table is not empty
                df = pd.DataFrame(table[1:], columns=table[0])
                all_tables.append(df)

# Combine all tables
if all_tables:
    combined_df = pd.concat(all_tables, ignore_index=True)
    combined_df.to_excel("extracted_tables.xlsx", index=False)
```

### reportlab - Create PDFs

#### Basic PDF Creation
```python
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

c = canvas.Canvas("hello.pdf", pagesize=letter)
width, height = letter

# Add text
c.drawString(100, height - 100, "Hello World!")
c.drawString(100, height - 120, "This is a PDF created with reportlab")

# Add a line
c.line(100, height - 140, 400, height - 140)

# Save
c.save()
```

#### Create PDF with Multiple Pages
```python
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak
from reportlab.lib.styles import getSampleStyleSheet

doc = SimpleDocTemplate("report.pdf", pagesize=letter)
styles = getSampleStyleSheet()
story = []

# Add content
title = Paragraph("Report Title", styles['Title'])
story.append(title)
story.append(Spacer(1, 12))

body = Paragraph("This is the body of the report. " * 20, styles['Normal'])
story.append(body)
story.append(PageBreak())

# Page 2
story.append(Paragraph("Page 2", styles['Heading1']))
story.append(Paragraph("Content for page 2", styles['Normal']))

# Build PDF
doc.build(story)
```

## Command-Line Tools

### pdftotext (poppler-utils)
```bash
# Extract text
pdftotext input.pdf output.txt

# Extract text preserving layout
pdftotext -layout input.pdf output.txt

# Extract specific pages
pdftotext -f 1 -l 5 input.pdf output.txt  # Pages 1-5
```

### qpdf
```bash
# Merge PDFs
qpdf --empty --pages file1.pdf file2.pdf -- merged.pdf

# Split pages
qpdf input.pdf --pages . 1-5 -- pages1-5.pdf
qpdf input.pdf --pages . 6-10 -- pages6-10.pdf

# Rotate pages
qpdf input.pdf output.pdf --rotate=+90:1  # Rotate page 1 by 90 degrees

# Remove password
qpdf --password=mypassword --decrypt encrypted.pdf decrypted.pdf
```

### pdftk (if available)
```bash
# Merge
pdftk file1.pdf file2.pdf cat output merged.pdf

# Split
pdftk input.pdf burst

# Rotate
pdftk input.pdf rotate 1east output rotated.pdf
```

## Common Tasks

### Extract Text from Scanned PDFs
```python
# Requires: pip install pytesseract pdf2image
import pytesseract
from pdf2image import convert_from_path

# Convert PDF to images
images = convert_from_path('scanned.pdf')

# OCR each page
text = ""
for i, image in enumerate(images):
    text += f"Page {i+1}:\n"
    text += pytesseract.image_to_string(image)
    text += "\n\n"

print(text)
```

### Add Watermark
```python
from pypdf import PdfReader, PdfWriter

# Create watermark (or load existing)
watermark = PdfReader("watermark.pdf").pages[0]

# Apply to all pages
reader = PdfReader("document.pdf")
writer = PdfWriter()

for page in reader.pages:
    page.merge_page(watermark)
    writer.add_page(page)

with open("watermarked.pdf", "wb") as output:
    writer.write(output)
```

### Extract Images
```bash
# Using pdfimages (poppler-utils)
pdfimages -j input.pdf output_prefix

# This extracts all images as output_prefix-000.jpg, output_prefix-001.jpg, etc.
```

### Password Protection
```python
from pypdf import PdfReader, PdfWriter

reader = PdfReader("input.pdf")
writer = PdfWriter()

for page in reader.pages:
    writer.add_page(page)

# Add password
writer.encrypt("userpassword", "ownerpassword")

with open("encrypted.pdf", "wb") as output:
    writer.write(output)
```

## Quick Reference

| Task | Best Tool | Command/Code |
|------|-----------|--------------|
| Merge PDFs | pypdf | `writer.add_page(page)` |
| Split PDFs | pypdf | One page per file |
| Extract text | pdfplumber | `page.extract_text()` |
| Extract tables | pdfplumber | `page.extract_tables()` |
| Create PDFs | reportlab | Canvas or Platypus |
| Command line merge | qpdf | `qpdf --empty --pages ...` |
| OCR scanned PDFs | pytesseract | Convert to image first |
| Fill PDF forms | pdf-lib or pypdf (see forms.md) | See forms.md |

## Next Steps

- For advanced pypdfium2 usage, see reference.md
- For JavaScript libraries (pdf-lib), see reference.md
- If you need to fill out a PDF form, follow the instructions in forms.md
- For troubleshooting guides, see reference.md
