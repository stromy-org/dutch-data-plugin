/**
 * brand-hd.js — Brand utilities for HD branded presentations
 *
 * Loads the full client-data brand system: charter.json, tokens.css,
 * images/manifest.json. Provides image selection using manifest metadata
 * (overlayPolicy, textSafeZone, motifAffinity, hero crops).
 *
 * Unlike brand.js (standard pptx skill), this module:
 * - Uses tokens.css directly (not _base.css with template substitution)
 * - Uses manifest.json for extended image metadata
 * - Composes overlays via CSS (not Sharp pre-compositing)
 * - Supports hero image crops (16x9, 2x1, square)
 * - Provides textSafeZone-aware content positioning
 *
 * USAGE:
 *   const { loadBrandSystem, pickImage, getOverlayCSS, getTextSafeZoneCSS } = require('./brand-hd');
 *   const brand = loadBrandSystem('/path/to/client-data/clients/stromy');
 */

const fs = require('fs');
const path = require('path');

/**
 * Load the complete brand system from a client-data client directory.
 *
 * @param {string} clientDir - Absolute path to client-data/clients/<slug>
 * @returns {Object} Brand system with charter, tokens, manifest, guidelines, paths
 */
function loadBrandSystem(clientDir) {
  const charterPath = path.join(clientDir, 'charter.json');
  const tokensPath = path.join(clientDir, 'tokens.css');
  const manifestPath = path.join(clientDir, 'images', 'manifest.json');
  const guidelinesPath = path.join(clientDir, 'guidelines.md');

  const charter = JSON.parse(fs.readFileSync(charterPath, 'utf-8'));
  const tokensCSS = fs.readFileSync(tokensPath, 'utf-8');

  let manifest = [];
  if (fs.existsSync(manifestPath)) {
    const raw = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    manifest = Array.isArray(raw) ? raw : (raw.library || []);
  }

  let guidelines = '';
  if (fs.existsSync(guidelinesPath)) {
    guidelines = fs.readFileSync(guidelinesPath, 'utf-8');
  }

  // Resolve logo paths (charter paths are relative to clientDir, e.g. "logos/logo.svg")
  const logos = {
    primary: charter.logo && charter.logo.primary
      ? path.join(clientDir, charter.logo.primary)
      : null,
    white: charter.logo && charter.logo.white
      ? path.join(clientDir, charter.logo.white)
      : null,
    mono: charter.logo && charter.logo.mono
      ? path.join(clientDir, charter.logo.mono)
      : null,
    icon: charter.logo && charter.logo.icon
      ? path.join(clientDir, charter.logo.icon)
      : null,
    symbol: charter.logo && charter.logo.symbol
      ? path.join(clientDir, charter.logo.symbol)
      : null,
  };

  // Determine which logo variant to use on image slides
  const logoVariantKey = (charter.images && charter.images.logoVariantOnImage) || 'white';
  logos.onImage = logos[logoVariantKey] || logos.white || logos.primary;

  return {
    charter,
    tokensCSS,
    manifest,
    guidelines,
    logos,
    clientDir,
    imagesDir: path.join(clientDir, 'images'),
    heroesDir: path.join(clientDir, 'images', 'heroes'),
    processedDir: path.join(clientDir, 'images', 'processed'),
  };
}

/**
 * Select an image from the manifest matching a role, avoiding repeats.
 * Uses manifest metadata for intelligent selection.
 *
 * @param {Object} brand - Brand system from loadBrandSystem()
 * @param {string} role - Image role: "cover", "divider", "background", "closing"
 * @param {Set<string>} usedImages - Set of already-used image IDs (mutated)
 * @param {Object} [options] - Selection options
 * @param {string} [options.theme] - Preferred theme (e.g., "dark-geometry")
 * @param {string} [options.motifAffinity] - Preferred motif affinity
 * @param {boolean} [options.preferHero] - Prefer hero images (default: true for cover/closing)
 * @returns {Object|null} Selected image entry with resolved paths, or null
 */
function pickImage(brand, role, usedImages, options = {}) {
  const { manifest, imagesDir, heroesDir } = brand;
  if (!manifest || manifest.length === 0) return null;

  const preferHero = options.preferHero !== undefined
    ? options.preferHero
    : (role === 'cover' || role === 'closing');

  // Filter by role
  let candidates = manifest.filter(img => img.roles && img.roles.includes(role));
  if (candidates.length === 0) return null;

  // Prefer hero images if requested
  if (preferHero) {
    const heroes = candidates.filter(img => img.hero);
    if (heroes.length > 0) candidates = heroes;
  }

  // Filter by theme if specified
  if (options.theme) {
    const themed = candidates.filter(img => img.theme === options.theme);
    if (themed.length > 0) candidates = themed;
  }

  // Filter by motif affinity if specified
  if (options.motifAffinity) {
    const affine = candidates.filter(img =>
      img.motifAffinity && img.motifAffinity.includes(options.motifAffinity)
    );
    if (affine.length > 0) candidates = affine;
  }

  // Prefer unused images
  const unused = candidates.filter(img => !usedImages.has(img.id));
  let pick;
  if (unused.length > 0) {
    pick = unused[0];
  } else {
    // Reset tracking for this role's candidates and pick first
    candidates.forEach(img => usedImages.delete(img.id));
    pick = candidates[0];
  }

  usedImages.add(pick.id);

  // Resolve paths — prefer hero crop for slides
  // Manifest paths are relative to clientDir (e.g., "images/heroes/foo.jpg")
  const { clientDir } = brand;
  let imagePath;
  if (pick.crops && pick.crops['hero-16x9']) {
    imagePath = path.join(clientDir, pick.crops['hero-16x9']);
  } else if (pick.processed) {
    imagePath = path.join(clientDir, pick.processed);
  } else if (pick.source) {
    imagePath = path.join(clientDir, pick.source);
  } else {
    imagePath = path.join(imagesDir, pick.id + '.jpg');
  }

  return {
    ...pick,
    resolvedPath: imagePath,
    overlayCSS: getOverlayCSS(brand, pick),
    textSafeZone: pick.textSafeZone || 'lower-third',
  };
}

/**
 * Generate CSS for image overlay based on manifest overlayPolicy.
 *
 * @param {Object} brand - Brand system from loadBrandSystem()
 * @param {Object} imageEntry - Image entry from manifest
 * @returns {string} CSS background property value with overlay compositing
 */
function getOverlayCSS(brand, imageEntry) {
  const { charter } = brand;
  const policy = imageEntry.overlayPolicy || 'dark-52';

  // Parse overlay policy: "dark-52" → dark variant at 52% opacity
  const match = policy.match(/^(dark|light|brand)-(\d+)$/);
  if (!match) return '';

  const [, variant, opacityStr] = match;
  const opacity = parseInt(opacityStr) / 100;

  let overlayColor;
  if (variant === 'dark') {
    overlayColor = charter.colors && charter.colors.primary
      ? charter.colors.primary
      : '#1D342B';
  } else if (variant === 'light') {
    overlayColor = charter.colors && charter.colors.background
      ? charter.colors.background
      : '#ECE6DA';
  } else {
    // brand variant — use accent
    overlayColor = charter.colors && charter.colors.accent
      ? charter.colors.accent
      : '#B96034';
  }

  // Convert hex to rgba
  const r = parseInt(overlayColor.slice(1, 3), 16);
  const g = parseInt(overlayColor.slice(3, 5), 16);
  const b = parseInt(overlayColor.slice(5, 7), 16);

  return `linear-gradient(rgba(${r},${g},${b},${opacity}), rgba(${r},${g},${b},${opacity}))`;
}

/**
 * Generate CSS positioning rules for text based on textSafeZone.
 *
 * @param {string} zone - Text safe zone from manifest (e.g., "lower-third", "center-safe", "bottom-left")
 * @returns {Object} CSS properties for text container positioning
 */
function getTextSafeZoneCSS(zone) {
  const zones = {
    'lower-third': {
      position: 'absolute', bottom: '60px', left: '60px', right: '60px',
      maxHeight: '240px'
    },
    'center-safe': {
      position: 'absolute', top: '50%', left: '60px', right: '60px',
      transform: 'translateY(-50%)', maxHeight: '400px'
    },
    'bottom-left': {
      position: 'absolute', bottom: '60px', left: '60px',
      maxWidth: '600px', maxHeight: '300px'
    },
    'bottom-right': {
      position: 'absolute', bottom: '60px', right: '60px',
      maxWidth: '600px', maxHeight: '300px', textAlign: 'right'
    },
    'top-left': {
      position: 'absolute', top: '60px', left: '60px',
      maxWidth: '600px', maxHeight: '300px'
    },
    'full': {
      position: 'absolute', top: '60px', left: '60px', right: '60px', bottom: '60px'
    }
  };

  return zones[zone] || zones['lower-third'];
}

/**
 * Build @font-face declarations from @fontsource npm packages.
 * Reads CSS files from node_modules and rewrites relative url() paths to absolute file:// paths.
 * Falls back to Google Fonts CDN if packages are not installed.
 *
 * @returns {string} CSS @font-face declarations or @import fallback
 */
function getFontCSS() {
  // Font packages and the weights we need
  const fonts = [
    { pkg: '@fontsource/fraunces', weights: ['400', '500', '600', '700', '800', '900'] },
    { pkg: '@fontsource/plus-jakarta-sans', weights: ['400', '500', '600', '700', '800'] },
    { pkg: '@fontsource/ibm-plex-mono', weights: ['400', '500', '600'] },
  ];

  try {
    const cssBlocks = [];
    for (const font of fonts) {
      // Resolve package directory from node_modules
      const pkgDir = path.dirname(require.resolve(`${font.pkg}/package.json`));
      for (const weight of font.weights) {
        const cssFile = path.join(pkgDir, `${weight}.css`);
        if (fs.existsSync(cssFile)) {
          let css = fs.readFileSync(cssFile, 'utf-8');
          // Rewrite relative url(./files/...) to absolute file:// paths
          const filesDir = path.join(pkgDir, 'files');
          css = css.replace(/url\(\.\/files\//g, `url(file://${filesDir}/`);
          cssBlocks.push(css);
        }
      }
    }
    if (cssBlocks.length > 0) return cssBlocks.join('\n');
  } catch (_) {
    // Packages not installed — fall through to CDN
  }

  // Fallback: Google Fonts CDN
  return `@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,100..900;1,9..144,100..900&family=Plus+Jakarta+Sans:ital,wght@0,200..800;1,200..800&family=IBM+Plex+Mono:ital,wght@0,400;0,500;0,600;1,400&display=swap');`;
}

/**
 * Generate the full <style> block for an HD slide, including font declarations
 * and the client's tokens.css.
 *
 * @param {Object} brand - Brand system from loadBrandSystem()
 * @returns {string} Complete CSS for injection into slide HTML <head>
 */
function getSlideCSS(brand) {
  return `${getFontCSS()}

/* === Client tokens.css === */
${brand.tokensCSS}

/* === HD slide base === */
*, *::before, *::after { box-sizing: border-box; }

body {
  margin: 0;
  padding: 0;
  width: 1280px;
  height: 720px;
  overflow: hidden;
  font-family: var(--font-body, 'Plus Jakarta Sans', sans-serif);
  color: var(--stromy-neutral-900, #171611);
  background: var(--stromy-neutral-50, #ECE6DA);
  -webkit-font-smoothing: antialiased;
}

h1, h2, h3, h4, h5, h6 {
  font-family: var(--font-display, 'Fraunces', Georgia, serif);
  margin: 0;
}

p { margin: 0; }

ul, ol {
  margin: 0;
  padding-left: 24px;
}

/* Overline text style */
.overline {
  font-family: var(--font-body);
  font-size: var(--text-overline, 11px);
  font-weight: 600;
  letter-spacing: var(--letter-spacing-wide, 0.08em);
  text-transform: uppercase;
}
`;
}

/**
 * Wrap HTML body content in a complete HD slide document.
 *
 * @param {Object} brand - Brand system from loadBrandSystem()
 * @param {string} bodyContent - Raw HTML for slide body
 * @param {Object} [bodyStyle] - Additional inline styles for body
 * @returns {string} Complete HTML document
 */
function wrapSlide(brand, bodyContent, bodyStyle = {}) {
  const styleEntries = Object.entries(bodyStyle)
    .map(([k, v]) => `${k}: ${v}`)
    .join('; ');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
${getSlideCSS(brand)}
</style>
</head>
<body${styleEntries ? ` style="${styleEntries}"` : ''}>
${bodyContent}
</body>
</html>`;
}

/**
 * Create a slide with a brand photograph background + CSS overlay.
 * Uses manifest metadata for overlay compositing and text-safe zones.
 *
 * @param {Object} brand - Brand system from loadBrandSystem()
 * @param {string} role - Image role: "cover", "divider", "background", "closing"
 * @param {string} bodyContent - Raw HTML for slide body
 * @param {Set<string>} usedImages - Tracking set for image deduplication
 * @param {Object} [options] - Options passed to pickImage
 * @returns {string} Complete HTML document with image background
 */
function imageSlide(brand, role, bodyContent, usedImages, options = {}) {
  const image = pickImage(brand, role, usedImages, options);
  if (!image) return wrapSlide(brand, bodyContent);

  const overlayCSS = image.overlayCSS;
  const bgValue = overlayCSS
    ? `${overlayCSS}, url('${image.resolvedPath}')`
    : `url('${image.resolvedPath}')`;

  return wrapSlide(brand, bodyContent, {
    'background': bgValue,
    'background-size': 'cover',
    'background-position': 'center',
  });
}

module.exports = {
  loadBrandSystem,
  pickImage,
  getOverlayCSS,
  getTextSafeZoneCSS,
  getSlideCSS,
  wrapSlide,
  imageSlide,
};
