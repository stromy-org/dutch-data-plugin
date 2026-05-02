# HD Slide Design Patterns

Layout patterns and CSS recipes for pptx-hd slides. All patterns use the 1280×720px HD canvas with tokens.css variables.

## Layout Patterns

### Full-Bleed Image with Text

Used for: cover, divider, closing slides.

```html
<body style="background: linear-gradient(rgba(29,52,43,0.52), rgba(29,52,43,0.52)), url('image.jpg'); background-size: cover; background-position: center;">
  <div style="position: absolute; bottom: 80px; left: 60px; right: 60px;">
    <h1 style="font-size: var(--text-display-xl); color: white;">Title</h1>
    <p style="font-size: var(--text-body); color: rgba(255,255,255,0.85);">Subtitle</p>
  </div>
</body>
```

**Key rules:**
- Always use overlay from manifest's `overlayPolicy` — never raw photos
- Place text within the image's `textSafeZone`
- Use white logo variant on image backgrounds

### Split Layout (40/60 or 50/50)

Used for: content slides with image + text.

```html
<div style="display: grid; grid-template-columns: 480px 1fr; height: 720px;">
  <div style="background: url('image.jpg'); background-size: cover;"></div>
  <div style="padding: 60px;">
    <h2 style="font-size: var(--text-display-md); color: var(--stromy-green);">Title</h2>
    <p style="font-size: var(--text-body); color: var(--stromy-neutral-700);">Content</p>
  </div>
</div>
```

### Card Grid (2×2 or 3-column)

Used for: key findings, feature highlights.

```html
<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; position: absolute; top: 120px; left: 60px; right: 60px;">
  <div style="background: white; border-radius: 8px; padding: 28px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); border-left: 4px solid var(--stromy-signal-orange);">
    <h3 style="font-size: 16px; color: var(--stromy-green);">Card Title</h3>
    <p style="font-size: 13px; color: var(--stromy-neutral-600);">Description</p>
  </div>
  <!-- More cards... -->
</div>
```

### Data Dashboard

Used for: metrics, KPIs, data visualization.

```html
<!-- Top metric strip -->
<div style="display: flex; gap: 24px; position: absolute; top: 50px; left: 60px; right: 60px;">
  <div style="flex: 1; background: var(--stromy-green); border-radius: 8px; padding: 20px;">
    <p style="font-size: 11px; color: rgba(255,255,255,0.7); text-transform: uppercase; letter-spacing: 0.08em;">Metric</p>
    <p style="font-family: var(--font-display); font-size: 32px; color: white;">$1.2M</p>
  </div>
  <!-- More metrics... -->
</div>

<!-- Chart placeholder below -->
<div class="placeholder" id="chart-area" style="position: absolute; top: 200px; left: 60px; right: 60px; bottom: 60px;"></div>
```

### Quote Slide

Used for: testimonials, key quotes.

```html
<div style="position: absolute; top: 50%; left: 120px; right: 120px; transform: translateY(-50%);">
  <div style="border-left: 4px solid var(--stromy-signal-orange); padding-left: 32px;">
    <p style="font-family: var(--font-display); font-size: 28px; color: var(--stromy-green); font-style: italic; line-height: 1.4;">
      "The analysis revealed patterns we hadn't considered before."
    </p>
    <p style="font-size: 14px; color: var(--stromy-neutral-600); margin-top: 20px;">
      — Jane Smith, CEO
    </p>
  </div>
</div>
```

### Timeline

Used for: project phases, historical sequence.

```html
<div style="position: absolute; top: 300px; left: 60px; right: 60px; display: flex; align-items: flex-start;">
  <!-- Timeline line -->
  <div style="position: absolute; top: 8px; left: 0; right: 0; height: 2px; background: var(--stromy-neutral-300);"></div>

  <div style="flex: 1; text-align: center; position: relative;">
    <div style="width: 16px; height: 16px; border-radius: 50%; background: var(--stromy-signal-orange); margin: 0 auto 12px;"></div>
    <p style="font-size: 12px; font-weight: 600; color: var(--stromy-green);">Phase 1</p>
    <p style="font-size: 11px; color: var(--stromy-neutral-600);">Q1 2026</p>
  </div>
  <!-- More phases... -->
</div>
```

## Typography Recipes

### Display Hierarchy

```css
/* Page title */
h1 { font-family: var(--font-display); font-size: var(--text-display-xl); /* 48px */ }

/* Section title */
h2 { font-family: var(--font-display); font-size: var(--text-display-lg); /* 36px */ }

/* Subsection */
h3 { font-family: var(--font-display); font-size: var(--text-display-md); /* 24px */ }

/* Body */
p { font-family: var(--font-body); font-size: var(--text-body); /* 15px */ }

/* Caption */
.caption { font-family: var(--font-body); font-size: var(--text-body-sm); /* 13px */ }

/* Overline */
.overline {
  font-family: var(--font-body);
  font-size: var(--text-overline); /* 11px */
  font-weight: 600;
  letter-spacing: var(--letter-spacing-wide);
  text-transform: uppercase;
}

/* Data/mono */
.mono { font-family: var(--font-mono); font-size: 14px; }
```

## Color Recipes

### Light content slide
```css
body { background: var(--stromy-neutral-50); } /* #ECE6DA warm cream */
h2 { color: var(--stromy-green); }              /* #1D342B dark green */
p { color: var(--stromy-neutral-700); }          /* body text */
.accent { color: var(--stromy-signal-orange); }  /* #B96034 */
```

### Dark content slide
```css
body { background: var(--stromy-neutral-950); } /* #0F1310 near-black */
h2 { color: white; }
p { color: var(--stromy-neutral-300); }
.accent { color: var(--stromy-signal-orange); }
```

### Gradient background
```css
body {
  background: linear-gradient(135deg, var(--stromy-green-800), var(--stromy-green));
}
```

## Brand Motif Integration

Motif components from tokens.css — use sparingly on divider and content slides.

### Tempo Ledger
```html
<div class="stromy-tempo-ledger" style="position: absolute; bottom: 0; left: 0; right: 0; height: 60px;"></div>
```

### Data Rail
```html
<div class="stromy-data-rail" style="position: absolute; right: 40px; top: 100px; bottom: 100px; width: 4px;"></div>
```

## Image Overlay Reference

| overlayPolicy | CSS | Use case |
|--------------|-----|----------|
| `dark-32` | `rgba(29,52,43,0.32)` | Light images, minimal text |
| `dark-40` | `rgba(29,52,43,0.40)` | Standard divider slides |
| `dark-52` | `rgba(29,52,43,0.52)` | Dense text over images |
| `light-30` | `rgba(236,230,218,0.30)` | Dark images, reversed text |

## Anti-Patterns

1. **No accent underlines** under titles (AI hallmark)
2. **No text-only slides** — every slide needs a visual element
3. **No centered body text** on content slides (left-align)
4. **No hardcoded hex** — use CSS variables
5. **No repeated images** on consecutive image slides
6. **No both width AND height** on images (aspect ratio)
7. **No text outside textSafeZone** on image slides
8. **No raw photos without overlay** — always apply overlayPolicy
