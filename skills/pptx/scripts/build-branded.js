/**
 * build-branded.js — Scaffolding for custom HTML slides with brand styling
 *
 * Write freeform HTML per slide while automatically injecting brand CSS
 * (charter colors, fonts, spacing) from a company charter.json.
 *
 * USAGE:
 *   cp .claude/skills/pptx/scripts/build-branded.js workspace/my-deck/build.js
 *   # Edit slides array in build.js
 *   cd workspace/my-deck && node build.js
 */

const path = require('path');
const fs = require('fs');

// === Skill imports ===
const {
  loadCharter, loadBaseCSS, renderGradientPng,
  pickBrandImage, resolveOverlayColor, overlayPng
} = require('./brand');
const html2pptx = require('./html2pptx');
const pptxgen = require('pptxgenjs');

// === Config ===
const SKILL_DIR = path.resolve(__dirname, '../../.claude/skills/pptx');
// Set BRAND_DIR to load charter/logos from a company directory instead of skill-local assets.
// Example: path.resolve(__dirname, '../../client-data/clients/dukestrategies/brand')
const BRAND_DIR = null;
const SLIDES_DIR = path.join(__dirname, 'slides');
const OUTPUT_DIR = path.join(__dirname, 'output');
const OUTPUT = path.join(OUTPUT_DIR, 'output.pptx');

// === Load brand assets ===
const charterPath = BRAND_DIR
  ? path.join(BRAND_DIR, 'charter.json')
  : path.join(SKILL_DIR, 'assets', 'charter.json');
const charter = loadCharter(charterPath);
const brandCSS = loadBaseCSS(charter);
const logoFile = charter.company.logo || (charter.logo && charter.logo.primary) || 'logo.png';
const logoPath = path.resolve(BRAND_DIR || path.join(SKILL_DIR, 'assets'), logoFile);

// Resolve white logo variant for use on image slides
const logoVariantKey = (charter.images && charter.images.logoVariantOnImage) || 'white';
const logoWhiteFile = (charter.logo && charter.logo[logoVariantKey]) || logoFile;
const logoWhitePath = path.resolve(BRAND_DIR || path.join(SKILL_DIR, 'assets'), logoWhiteFile);

// Track used brand images to avoid repetition
const usedImages = new Set();

// === Helpers ===

/**
 * Wrap raw HTML body content with brand CSS and slide dimensions.
 * Use CSS variables (--color-primary, --font-heading, etc.) defined in _base.css.
 *
 * @param {string} bodyContent - Raw HTML to place inside <body>
 * @returns {string} Full HTML document with brand CSS injected
 */
function brandedSlide(bodyContent) {
  return `<!DOCTYPE html>
<html>
<head>
<style>
${brandCSS}
</style>
</head>
<body style="display: block;">
${bodyContent}
</body>
</html>`;
}

/**
 * Create a slide with a brand photograph background + color overlay.
 * Falls back to brandedSlide() if no brand images are available.
 *
 * @param {string} role - Image role: "cover", "divider", or "closing"
 * @param {string} bodyContent - Raw HTML to place inside <body>
 * @returns {Promise<string>} Full HTML document with brand photo background
 */
async function brandImageSlide(role, bodyContent) {
  const image = pickBrandImage(charter, role, usedImages);
  if (!image || !BRAND_DIR) return brandedSlide(bodyContent);

  const imagePath = path.resolve(BRAND_DIR, image.file);
  if (!fs.existsSync(imagePath)) return brandedSlide(bodyContent);

  const { color, opacity } = resolveOverlayColor(charter);
  const overlayFile = path.join(SLIDES_DIR, `overlay-${path.basename(image.file, path.extname(image.file))}.png`);
  await overlayPng(imagePath, color, opacity, overlayFile);

  return `<!DOCTYPE html>
<html>
<head>
<style>
${brandCSS}
</style>
</head>
<body style="display: block; background-image: url('${overlayFile}'); background-size: cover; background-position: center;">
${bodyContent}
</body>
</html>`;
}

async function build() {
  // Create slides and output directories
  if (!fs.existsSync(SLIDES_DIR)) fs.mkdirSync(SLIDES_DIR, { recursive: true });
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // ============================================================
  // DEFINE YOUR SLIDES HERE
  // Write freeform HTML using brand CSS variables:
  //   var(--color-primary)      — brand primary color
  //   var(--color-secondary)    — brand secondary color
  //   var(--color-text)         — body text color
  //   var(--color-background)   — background color
  //   var(--font-heading)       — heading font family
  //   var(--font-body)          — body font family
  //
  // Available assets:
  //   logoPath      — absolute path to company logo PNG
  //   logoWhitePath — white logo variant for dark/image backgrounds
  //   charter       — full charter.json object
  //
  // Available helpers:
  //   brandedSlide(html)                — solid/gradient background with brand CSS
  //   brandImageSlide(role, html)       — brand photo background with overlay (async)
  //   renderGradientPng(colors, w, h, path) — pre-render gradient as PNG
  //
  // Rules (from html2pptx.md):
  //   - Body: 720pt x 405pt (16:9)
  //   - All text in <p>, <h1>-<h6>, <ul>, <ol> tags
  //   - No CSS gradients (use renderGradientPng() instead)
  //   - Web-safe fonts only
  //   - Add display: block to <img> tags
  // ============================================================
  const slides = [
    {
      name: 'slide-01.html',
      // Cover slide with brand photo background
      html: await brandImageSlide('cover', `
        <div style="position: absolute; top: 140pt; left: 60pt;">
          <h1 style="font-family: var(--font-heading); font-size: 32pt; color: white; margin: 0;">
            Presentation Title
          </h1>
          <p style="font-family: var(--font-body); font-size: 16pt; color: white; margin-top: 12pt;">
            Subtitle goes here
          </p>
        </div>
        <img src="${logoWhitePath}" style="display: block; position: absolute; bottom: 30pt; right: 40pt; height: 40pt;" />
      `)
    },
    {
      name: 'slide-02.html',
      // Content slide with solid background
      html: brandedSlide(`
        <div style="position: absolute; top: 0; left: 0; width: 720pt; height: 5pt; background: var(--color-primary);"></div>
        <div style="position: absolute; top: var(--slide-margin); left: var(--slide-margin); width: 640pt;">
          <h2 style="font-family: var(--font-heading); font-size: 24pt; color: var(--color-primary); margin: 0 0 var(--content-margin) 0;">
            Content Slide
          </h2>
          <p style="font-family: var(--font-body); font-size: 14pt; color: var(--color-text); line-height: 1.5;">
            Your content goes here. Use any HTML layout you want while
            staying on-brand with CSS variables.
          </p>
        </div>
        <img src="${logoPath}" style="display: block; position: absolute; bottom: 20pt; right: 30pt; height: 24pt;" />
      `)
    },
    {
      name: 'slide-03.html',
      // Closing slide with brand photo background
      html: await brandImageSlide('closing', `
        <div style="position: absolute; top: 140pt; left: 60pt;">
          <h1 style="font-family: var(--font-heading); font-size: 28pt; color: white; margin: 0;">
            Thank You
          </h1>
          <p style="font-family: var(--font-body); font-size: 14pt; color: white; margin-top: 12pt;">
            Contact information here
          </p>
        </div>
        <img src="${logoWhitePath}" style="display: block; position: absolute; bottom: 30pt; right: 40pt; height: 40pt;" />
      `)
    }
    // Add more slides...
  ];

  // ============================================================
  // WRITE HTML FILES
  // ============================================================
  for (const s of slides) {
    const outPath = path.join(SLIDES_DIR, s.name);
    console.log(`Writing ${s.name}...`);
    fs.writeFileSync(outPath, s.html, 'utf-8');
  }

  // ============================================================
  // CONVERT TO PPTX
  // ============================================================
  const pptx = new pptxgen();
  pptx.layout = 'LAYOUT_16x9';

  for (const s of slides) {
    console.log(`Converting ${s.name}...`);
    await html2pptx(path.join(SLIDES_DIR, s.name), pptx);
  }

  await pptx.writeFile({ fileName: OUTPUT });
  console.log(`Done: ${OUTPUT}`);
}

build().catch(err => { console.error(err); process.exit(1); });
