/**
 * brand.js — Branding utilities for charter-driven presentations
 *
 * Loads a charter.json, injects CSS variables via _base.css, and renders
 * gradient backgrounds as PNG. These utilities are shared by both the base
 * pptx skill (build-branded.js) and the branded-pptx skill (render-template.js).
 *
 * USAGE:
 *   const { loadCharter, loadBaseCSS, renderGradientPng } = require('./brand');
 *
 *   const charter = loadCharter('/path/to/charter.json');
 *   const css = loadBaseCSS(charter);
 *   await renderGradientPng(['#2C5F8D', '#1a3a5c'], 720, 405, 'gradient.png');
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const SKILL_DIR = path.resolve(__dirname, '..');

/**
 * Resolve a dotted path like "colors.primary" against an object
 */
function resolvePath(obj, dotPath) {
  return dotPath.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : ''), obj);
}

/**
 * Replace all {{variable}} placeholders in text with values from context.
 * Supports dotted paths: {{colors.primary}}, {{slide.title}}, {{company.logo}}
 * Leaves unresolved placeholders as empty strings.
 */
function replacePlaceholders(text, context) {
  return text.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, varPath) => {
    const value = resolvePath(context, varPath);
    return value !== undefined && value !== null ? String(value) : '';
  });
}

/**
 * Normalize charter to a common internal shape.
 * Detects new format (has `presentation` key) vs legacy (has `spacing` key)
 * and maps to the legacy internal shape used by templates.
 */
function normalizeCharter(raw) {
  // New format: has `presentation` key instead of `spacing`
  if (raw.presentation && !raw.spacing) {
    const normalized = { ...raw };
    normalized.spacing = {
      slideMargin: raw.presentation.slideMargin || '40pt',
      titleMargin: raw.presentation.titleMargin || '30pt',
      contentMargin: raw.presentation.contentMargin || '20pt'
    };
    // New format stores logo path in logo.primary instead of company.logo
    if (!normalized.company) {
      normalized.company = { name: '', logo: '' };
    }
    if (raw.logo && raw.logo.primary && !normalized.company.logo) {
      normalized.company.logo = raw.logo.primary;
    }
    return normalized;
  }
  // Legacy format: already has spacing and company.logo — return as-is
  return raw;
}

/**
 * Load charter.json and return parsed + normalized object.
 * @param {string} charterPath - Absolute path, or relative path from SKILL_DIR
 */
function loadCharter(charterPath) {
  const fullPath = path.isAbsolute(charterPath)
    ? charterPath
    : path.resolve(SKILL_DIR, charterPath);
  const raw = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
  return normalizeCharter(raw);
}

/**
 * Load and process _base.css with charter values injected.
 * @param {Object} charter - Normalized charter object
 * @param {string} [cssDir] - Optional directory containing _base.css (defaults to pptx/assets/)
 */
function loadBaseCSS(charter, cssDir) {
  const cssPath = cssDir
    ? path.join(cssDir, '_base.css')
    : path.join(SKILL_DIR, 'assets', '_base.css');
  const cssRaw = fs.readFileSync(cssPath, 'utf-8');
  return replacePlaceholders(cssRaw, charter);
}

/**
 * Pre-render a linear gradient as a PNG file using Sharp.
 * Returns the absolute path to the generated PNG.
 *
 * @param {string[]} colors - Array of hex colors for the gradient (top to bottom)
 * @param {number} width - Width in pt (will be converted to px)
 * @param {number} height - Height in pt (will be converted to px)
 * @param {string} outputPath - Where to save the PNG
 */
async function renderGradientPng(colors, width, height, outputPath) {
  const pxW = Math.round(width * 96 / 72);  // pt to px at 96 DPI
  const pxH = Math.round(height * 96 / 72);

  const stops = colors.map((c, i) => {
    const offset = colors.length === 1 ? 0 : (i / (colors.length - 1)) * 100;
    return `<stop offset="${offset}%" stop-color="${c}" />`;
  }).join('\n    ');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${pxW}" height="${pxH}">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
    ${stops}
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#g)" />
</svg>`;

  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  await sharp(Buffer.from(svg)).png().toFile(outputPath);
  return outputPath;
}

/**
 * Select a brand image from charter.images.catalog matching a role, avoiding repeats.
 *
 * @param {Object} charter - Normalized charter object (must have charter.images.catalog)
 * @param {string} role - Slide role: "cover", "divider", or "closing"
 * @param {Set<string>} usedImages - Set of already-used file paths (mutated: selected image is added)
 * @returns {{ file: string, description: string } | null} Selected image entry, or null if no catalog
 */
function pickBrandImage(charter, role, usedImages) {
  const catalog = charter.images && charter.images.catalog;
  if (!catalog || catalog.length === 0) return null;

  // Filter by role
  const candidates = catalog.filter(img => img.roles && img.roles.includes(role));
  if (candidates.length === 0) return null;

  // Prefer unused images
  const unused = candidates.filter(img => !usedImages.has(img.file));
  const pick = unused.length > 0 ? unused[0] : candidates[0];

  // If all were used, reset tracking for this role's candidates then pick first
  if (unused.length === 0) {
    candidates.forEach(img => usedImages.delete(img.file));
  }
  usedImages.add(pick.file);

  return { file: pick.file, description: pick.description };
}

/**
 * Resolve charter.images.overlay.color (a key like "primary") to hex + opacity.
 *
 * @param {Object} charter - Normalized charter object
 * @returns {{ color: string, opacity: number }} Resolved hex color and opacity
 */
function resolveOverlayColor(charter) {
  const overlay = charter.images && charter.images.overlay;
  if (!overlay) return { color: '#000000', opacity: 0.5 };

  const colorKey = overlay.color || 'primary';
  const hex = (charter.colors && charter.colors[colorKey]) || '#000000';
  const opacity = typeof overlay.opacity === 'number' ? overlay.opacity : 0.5;

  return { color: hex, opacity };
}

/**
 * Pre-render a photo with a semi-transparent color overlay as PNG.
 * Uses Sharp's composite() with an SVG overlay rect.
 *
 * @param {string} imagePath - Absolute path to source image
 * @param {string} hexColor - Hex color for overlay (e.g. "#FF7F66")
 * @param {number} opacity - Overlay opacity 0-1
 * @param {string} outputPath - Where to save the composited PNG
 * @returns {Promise<string>} Absolute path to the output PNG
 */
async function overlayPng(imagePath, hexColor, opacity, outputPath) {
  const metadata = await sharp(imagePath).metadata();
  const w = metadata.width;
  const h = metadata.height;

  // Convert opacity to 0-255 alpha
  const alpha = Math.round(opacity * 255);
  const alphaHex = alpha.toString(16).padStart(2, '0');

  const overlaySvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <rect width="100%" height="100%" fill="${hexColor}${alphaHex}" />
</svg>`;

  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  await sharp(imagePath)
    .composite([{ input: Buffer.from(overlaySvg), blend: 'over' }])
    .png()
    .toFile(outputPath);

  return outputPath;
}

module.exports = {
  resolvePath, replacePlaceholders, normalizeCharter,
  loadCharter, loadBaseCSS, renderGradientPng,
  pickBrandImage, resolveOverlayColor, overlayPng
};
