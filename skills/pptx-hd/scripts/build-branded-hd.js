/**
 * build-branded-hd.js — HD branded presentation scaffold
 *
 * Copy this file to your workspace and customize the slides array.
 * Uses the full client-data brand system: tokens.css, manifest.json,
 * charter.json with Google Fonts, CSS gradients, and HD resolution.
 *
 * USAGE:
 *   cp .claude/skills/pptx-hd/scripts/build-branded-hd.js workspace/my-deck/build.js
 *   # Edit slides array in build.js
 *   cd workspace/my-deck && node build.js
 */

const path = require('path');
const fs = require('fs');

// === Skill imports ===
const {
  loadBrandSystem, pickImage, imageSlide, wrapSlide, getSlideCSS, getTextSafeZoneCSS
} = require('./brand-hd');
const html2pptxHD = require('./html2pptx-hd');
const pptxgen = require('pptxgenjs');

// === Config ===
// Set CLIENT_DIR to the client-data directory for the target client.
// Example: path.resolve(__dirname, '../../client-data/clients/stromy')
const CLIENT_DIR = path.resolve(__dirname, '../../client-data/clients/stromy');
const SLIDES_DIR = path.join(__dirname, 'slides');
const OUTPUT_DIR = path.join(__dirname, 'output');
const OUTPUT = path.join(OUTPUT_DIR, 'output.pptx');

// === Load brand system ===
const brand = loadBrandSystem(CLIENT_DIR);
const { charter, logos } = brand;

// Track used images to avoid repetition
const usedImages = new Set();

async function build() {
  // Create directories
  if (!fs.existsSync(SLIDES_DIR)) fs.mkdirSync(SLIDES_DIR, { recursive: true });
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // ============================================================
  // DEFINE YOUR SLIDES HERE
  //
  // Use the full CSS power available:
  //   - CSS variables from tokens.css (var(--stromy-green), var(--font-display), etc.)
  //   - CSS gradients (linear-gradient, radial-gradient)
  //   - Google Fonts (Fraunces, Plus Jakarta Sans, IBM Plex Mono)
  //   - SVG elements (rasterized to high-res PNG per-element)
  //   - box-shadow, border-radius, backdrop-filter
  //   - CSS Grid, Flexbox
  //
  // Canvas: 1280px × 720px (HD 16:9)
  //
  // Available helpers:
  //   brand         — full brand system (charter, tokensCSS, manifest, logos, paths)
  //   wrapSlide(brand, html, bodyStyle)         — solid/gradient bg with tokens.css
  //   imageSlide(brand, role, html, usedImages) — brand photo bg with overlay
  //   pickImage(brand, role, usedImages, opts)  — select image with manifest metadata
  //   getTextSafeZoneCSS(zone)                  — positioning for text-safe zones
  //
  // Brand image roles: "cover", "divider", "background", "closing"
  // Text safe zones: "lower-third", "center-safe", "bottom-left", "top-left", "full"
  // ============================================================

  const slides = [
    // --- SLIDE 1: Cover ---
    {
      name: 'slide-01-cover.html',
      html: imageSlide(brand, 'cover', `
        <div style="position: absolute; bottom: 80px; left: 60px; right: 60px;">
          <p class="overline" style="color: rgba(255,255,255,0.7); margin-bottom: 12px;">
            ${charter.meta && charter.meta.name || 'Company Name'}
          </p>
          <h1 style="font-size: var(--text-display-xl, 48px); color: white; margin-bottom: 16px; line-height: 1.1;">
            Presentation Title
          </h1>
          <p style="font-size: var(--text-body, 15px); color: rgba(255,255,255,0.85); max-width: 600px;">
            Subtitle or tagline goes here — one to two lines maximum
          </p>
        </div>
        ${logos.onImage ? `<img src="${logos.onImage}" style="display: block; position: absolute; top: 40px; right: 50px; height: 36px;" />` : ''}
      `, usedImages)
    },

    // --- SLIDE 2: Content ---
    {
      name: 'slide-02-content.html',
      html: wrapSlide(brand, `
        <div style="position: absolute; top: 0; left: 0; right: 0; height: 4px; background: var(--stromy-green, #1D342B);"></div>
        <div style="position: absolute; top: 50px; left: 60px; right: 60px;">
          <p class="overline" style="color: var(--stromy-signal-orange, #B96034); margin-bottom: 8px;">
            SECTION ONE
          </p>
          <h2 style="font-size: var(--text-display-lg, 36px); color: var(--stromy-green, #1D342B); margin-bottom: 24px;">
            Content Slide Title
          </h2>
          <p style="font-size: var(--text-body, 15px); color: var(--stromy-neutral-700, #4A463E); line-height: 1.65; max-width: 700px;">
            Your content goes here. Use CSS variables from tokens.css for all colors,
            fonts, and spacing. The full type scale is available — display, body, caption,
            overline, and mono variants.
          </p>
        </div>
        ${logos.primary ? `<img src="${logos.primary}" style="display: block; position: absolute; bottom: 24px; right: 40px; height: 20px;" />` : ''}
      `)
    },

    // --- SLIDE 3: Divider ---
    {
      name: 'slide-03-divider.html',
      html: imageSlide(brand, 'divider', `
        <div style="position: absolute; top: 50%; left: 60px; transform: translateY(-50%);">
          <p style="font-family: var(--font-mono, 'IBM Plex Mono'); font-size: 14px; color: rgba(255,255,255,0.5); margin-bottom: 16px;">
            02
          </p>
          <h2 style="font-size: var(--text-display-lg, 36px); color: white; line-height: 1.2;">
            Section Title
          </h2>
          <p style="font-size: var(--text-body, 15px); color: rgba(255,255,255,0.75); margin-top: 12px; max-width: 500px;">
            Brief section description
          </p>
        </div>
      `, usedImages)
    },

    // --- SLIDE 4: Card Grid ---
    {
      name: 'slide-04-cards.html',
      html: wrapSlide(brand, `
        <div style="position: absolute; top: 0; left: 0; right: 0; height: 4px; background: var(--stromy-green, #1D342B);"></div>
        <div style="position: absolute; top: 50px; left: 60px;">
          <h2 style="font-size: var(--text-display-md, 24px); color: var(--stromy-green, #1D342B);">
            Key Findings
          </h2>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; position: absolute; top: 120px; left: 60px; right: 60px; bottom: 60px;">
          <div style="background: white; border-radius: 8px; padding: 28px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); border-left: 4px solid var(--stromy-signal-orange, #B96034);">
            <p style="font-family: var(--font-display); font-size: var(--text-display-md, 24px); color: var(--stromy-signal-orange, #B96034); margin-bottom: 8px;">
              01
            </p>
            <h3 style="font-size: 16px; color: var(--stromy-green, #1D342B); margin-bottom: 8px;">
              Finding Title
            </h3>
            <p style="font-size: 13px; color: var(--stromy-neutral-600, #6D665C); line-height: 1.5;">
              Description of the first key finding with supporting detail.
            </p>
          </div>
          <div style="background: white; border-radius: 8px; padding: 28px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); border-left: 4px solid var(--stromy-signal-orange, #B96034);">
            <p style="font-family: var(--font-display); font-size: var(--text-display-md, 24px); color: var(--stromy-signal-orange, #B96034); margin-bottom: 8px;">
              02
            </p>
            <h3 style="font-size: 16px; color: var(--stromy-green, #1D342B); margin-bottom: 8px;">
              Finding Title
            </h3>
            <p style="font-size: 13px; color: var(--stromy-neutral-600, #6D665C); line-height: 1.5;">
              Description of the second key finding with supporting detail.
            </p>
          </div>
          <div style="background: white; border-radius: 8px; padding: 28px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); border-left: 4px solid var(--stromy-signal-orange, #B96034);">
            <p style="font-family: var(--font-display); font-size: var(--text-display-md, 24px); color: var(--stromy-signal-orange, #B96034); margin-bottom: 8px;">
              03
            </p>
            <h3 style="font-size: 16px; color: var(--stromy-green, #1D342B); margin-bottom: 8px;">
              Finding Title
            </h3>
            <p style="font-size: 13px; color: var(--stromy-neutral-600, #6D665C); line-height: 1.5;">
              Description of the third key finding with supporting detail.
            </p>
          </div>
        </div>
      `)
    },

    // --- SLIDE 5: Closing ---
    {
      name: 'slide-05-closing.html',
      html: imageSlide(brand, 'closing', `
        <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center;">
          ${logos.onImage ? `<img src="${logos.onImage}" style="display: block; margin: 0 auto 32px; height: 48px;" />` : ''}
          <h1 style="font-size: var(--text-display-lg, 36px); color: white; margin-bottom: 16px;">
            Thank You
          </h1>
          <p style="font-size: var(--text-body, 15px); color: rgba(255,255,255,0.8);">
            contact@example.com
          </p>
        </div>
      `, usedImages)
    },

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
  // CONVERT TO HD PPTX
  // ============================================================
  const pptx = new pptxgen();

  // Define HD layout: 1280×720px = 13.333" × 7.5" at 96 DPI
  pptx.defineLayout({ name: 'HD_16x9', width: 13.333, height: 7.5 });
  pptx.layout = 'HD_16x9';

  if (charter.meta && charter.meta.name) pptx.author = charter.meta.name;
  pptx.title = 'Branded Presentation';

  for (const s of slides) {
    console.log(`Converting ${s.name}...`);
    await html2pptxHD(path.join(SLIDES_DIR, s.name), pptx);
  }

  await pptx.writeFile({ fileName: OUTPUT });

  // Fix PptxGenJS Content_Types.xml bug (phantom slide master entries)
  await html2pptxHD.repairPptx(OUTPUT);

  console.log(`Done: ${OUTPUT}`);
}

build().catch(err => { console.error(err); process.exit(1); });
