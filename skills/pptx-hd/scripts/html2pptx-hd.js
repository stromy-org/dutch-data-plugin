/**
 * html2pptx-hd.js — Enhanced HTML-to-PPTX conversion for HD slides
 *
 * Extends the standard html2pptx.js with:
 * - 1280×720px HD canvas (not 720pt × 405pt)
 * - CSS gradient → native PptxGenJS gradient fill conversion
 * - Per-element fallback rasterization (not full-slide screenshots)
 * - Google Fonts support (font names preserved in PPTX)
 * - Enhanced shadow conversion
 * - Border-radius preservation
 *
 * USAGE:
 *   const pptx = new pptxgen();
 *   pptx.defineLayout({ name: 'HD', width: 13.333, height: 7.5 });
 *   pptx.layout = 'HD';
 *
 *   const { slide } = await html2pptxHD('slide.html', pptx);
 *   await pptx.writeFile('output.pptx');
 *
 * The HD layout maps 1280px × 720px at 96 DPI to 13.333" × 7.5" in PowerPoint.
 */

const { chromium } = require('playwright');
const path = require('path');
const sharp = require('sharp');
const fs = require('fs');

const PX_PER_IN = 96;
const PT_PER_PX = 0.75;

// HD slide dimensions
const HD_WIDTH_PX = 1280;
const HD_HEIGHT_PX = 720;
const HD_WIDTH_IN = HD_WIDTH_PX / PX_PER_IN;  // 13.333"
const HD_HEIGHT_IN = HD_HEIGHT_PX / PX_PER_IN; // 7.5"

/**
 * Parse a CSS linear-gradient into PptxGenJS gradient fill options.
 * Returns null if the gradient can't be parsed.
 *
 * @param {string} gradientCSS - CSS linear-gradient string
 * @returns {Object|null} PptxGenJS-compatible gradient fill, or null
 */
function parseCSSGradient(gradientCSS) {
  if (!gradientCSS || !gradientCSS.includes('linear-gradient')) return null;

  // Extract the gradient function content
  const match = gradientCSS.match(/linear-gradient\(([^)]+(?:\([^)]*\)[^)]*)*)\)/);
  if (!match) return null;

  const content = match[1];

  // Parse direction/angle
  let angle = 180; // default: top to bottom
  let colorsPart = content;

  // Check for angle like "135deg" or direction like "to right"
  const angleMatch = content.match(/^(\d+(?:\.\d+)?)deg\s*,\s*/);
  const dirMatch = content.match(/^to\s+(top|bottom|left|right|top left|top right|bottom left|bottom right)\s*,\s*/);

  if (angleMatch) {
    angle = parseFloat(angleMatch[1]);
    colorsPart = content.slice(angleMatch[0].length);
  } else if (dirMatch) {
    const dirMap = {
      'top': 0, 'right': 90, 'bottom': 180, 'left': 270,
      'top right': 45, 'bottom right': 135,
      'bottom left': 225, 'top left': 315
    };
    angle = dirMap[dirMatch[1]] || 180;
    colorsPart = content.slice(dirMatch[0].length);
  }

  // Parse color stops — handle rgba(...) and hex colors
  const stops = [];
  const colorRegex = /(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\))\s*(\d+%)?/g;
  let colorMatch;
  while ((colorMatch = colorRegex.exec(colorsPart)) !== null) {
    const color = colorMatch[1];
    const position = colorMatch[2] ? parseInt(colorMatch[2]) : null;

    // Convert to hex without #
    let hex;
    if (color.startsWith('#')) {
      hex = color.slice(1);
      if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    } else {
      const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (rgbMatch) {
        hex = [rgbMatch[1], rgbMatch[2], rgbMatch[3]]
          .map(n => parseInt(n).toString(16).padStart(2, '0'))
          .join('');
      } else {
        continue;
      }
    }

    stops.push({ color: hex.toUpperCase(), position });
  }

  if (stops.length < 2) return null;

  // Assign positions if not specified
  stops.forEach((stop, i) => {
    if (stop.position === null) {
      stop.position = Math.round((i / (stops.length - 1)) * 100);
    }
  });

  // Map CSS angle to PptxGenJS rotation (they use different conventions)
  // CSS: 0deg = to top, 90deg = to right, 180deg = to bottom
  // PptxGenJS: 0 = left-to-right, 90 = top-to-bottom
  const pptxAngle = (angle + 270) % 360;

  return {
    fill: {
      type: 'gradient',
      gradientType: 'linear',
      rotate: pptxAngle,
      stops: stops.map(s => ({
        color: s.color,
        position: s.position
      }))
    }
  };
}

/**
 * Rasterize a single DOM element as a high-resolution PNG.
 * Used as fallback for elements that can't be converted natively.
 *
 * @param {Page} page - Playwright page
 * @param {string} selector - CSS selector for the element
 * @param {string} outputPath - Where to save the PNG
 * @param {number} [scale=2] - Resolution scale factor
 * @returns {Object} Element bounding box in inches { x, y, w, h }
 */
async function rasterizeElement(page, selector, outputPath, scale = 2) {
  const element = await page.$(selector);
  if (!element) throw new Error(`Element not found: ${selector}`);

  const box = await element.boundingBox();
  if (!box) throw new Error(`Element has no bounding box: ${selector}`);

  await element.screenshot({
    path: outputPath,
    scale: 'device',
    omitBackground: true,
  });

  // Scale up for higher resolution
  if (scale > 1) {
    const buffer = await sharp(outputPath)
      .resize(Math.round(box.width * scale), Math.round(box.height * scale), {
        fit: 'fill',
        kernel: 'lanczos3'
      })
      .png()
      .toBuffer();
    fs.writeFileSync(outputPath, buffer);
  }

  return {
    x: box.x / PX_PER_IN,
    y: box.y / PX_PER_IN,
    w: box.width / PX_PER_IN,
    h: box.height / PX_PER_IN,
  };
}

/**
 * Extract slide data from an HD HTML page.
 * Enhanced version that handles gradients and complex CSS.
 */
async function extractSlideDataHD(page) {
  return await page.evaluate(() => {
    const PX_PER_IN = 96;
    const PT_PER_PX = 0.75;

    const pxToInch = (px) => px / PX_PER_IN;
    const pxToPoints = (pxStr) => parseFloat(pxStr) * PT_PER_PX;

    const rgbToHex = (rgbStr) => {
      if (rgbStr === 'rgba(0, 0, 0, 0)' || rgbStr === 'transparent') return 'FFFFFF';
      const match = rgbStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (!match) return 'FFFFFF';
      return match.slice(1).map(n => parseInt(n).toString(16).padStart(2, '0')).join('');
    };

    const extractAlpha = (rgbStr) => {
      const match = rgbStr.match(/rgba\(\d+,\s*\d+,\s*\d+,\s*([\d.]+)\)/);
      if (!match) return null;
      return Math.round((1 - parseFloat(match[1])) * 100);
    };

    const applyTextTransform = (text, textTransform) => {
      if (textTransform === 'uppercase') return text.toUpperCase();
      if (textTransform === 'lowercase') return text.toLowerCase();
      if (textTransform === 'capitalize') return text.replace(/\b\w/g, c => c.toUpperCase());
      return text;
    };

    const getRotation = (transform, writingMode) => {
      let angle = 0;
      if (writingMode === 'vertical-rl') angle = 90;
      else if (writingMode === 'vertical-lr') angle = 270;

      if (transform && transform !== 'none') {
        const rotateMatch = transform.match(/rotate\((-?\d+(?:\.\d+)?)deg\)/);
        if (rotateMatch) {
          angle += parseFloat(rotateMatch[1]);
        } else {
          const matrixMatch = transform.match(/matrix\(([^)]+)\)/);
          if (matrixMatch) {
            const values = matrixMatch[1].split(',').map(parseFloat);
            angle += Math.round(Math.atan2(values[1], values[0]) * (180 / Math.PI));
          }
        }
      }

      angle = angle % 360;
      if (angle < 0) angle += 360;
      return angle === 0 ? null : angle;
    };

    const getPositionAndSize = (el, rect, rotation) => {
      if (rotation === null) {
        return { x: rect.left, y: rect.top, w: rect.width, h: rect.height };
      }
      const isVertical = rotation === 90 || rotation === 270;
      if (isVertical) {
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        return {
          x: centerX - rect.height / 2, y: centerY - rect.width / 2,
          w: rect.height, h: rect.width
        };
      }
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      return {
        x: centerX - el.offsetWidth / 2, y: centerY - el.offsetHeight / 2,
        w: el.offsetWidth, h: el.offsetHeight
      };
    };

    const parseBoxShadow = (boxShadow) => {
      if (!boxShadow || boxShadow === 'none') return null;
      if (boxShadow.match(/inset/)) return null;

      const colorMatch = boxShadow.match(/rgba?\([^)]+\)/);
      const parts = boxShadow.match(/([-\d.]+)(px|pt)/g);
      if (!parts || parts.length < 2) return null;

      const offsetX = parseFloat(parts[0]);
      const offsetY = parseFloat(parts[1]);
      const blur = parts.length > 2 ? parseFloat(parts[2]) : 0;

      let angle = 0;
      if (offsetX !== 0 || offsetY !== 0) {
        angle = Math.atan2(offsetY, offsetX) * (180 / Math.PI);
        if (angle < 0) angle += 360;
      }

      const offset = Math.sqrt(offsetX * offsetX + offsetY * offsetY) * PT_PER_PX;

      let opacity = 0.5;
      if (colorMatch) {
        const opacityMatch = colorMatch[0].match(/[\d.]+\)$/);
        if (opacityMatch) opacity = parseFloat(opacityMatch[0].replace(')', ''));
      }

      return {
        type: 'outer', angle: Math.round(angle),
        blur: blur * 0.75, color: colorMatch ? rgbToHex(colorMatch[0]) : '000000',
        offset, opacity
      };
    };

    const parseInlineFormatting = (element, baseOptions = {}, runs = [], baseTextTransform = (x) => x) => {
      let prevNodeIsText = false;

      element.childNodes.forEach((node) => {
        let textTransform = baseTextTransform;
        const isText = node.nodeType === Node.TEXT_NODE || node.tagName === 'BR';

        if (isText) {
          const text = node.tagName === 'BR' ? '\n' : textTransform(node.textContent.replace(/\s+/g, ' '));
          const prevRun = runs[runs.length - 1];
          if (prevNodeIsText && prevRun) {
            prevRun.text += text;
          } else {
            runs.push({ text, options: { ...baseOptions } });
          }
        } else if (node.nodeType === Node.ELEMENT_NODE && node.textContent.trim()) {
          const options = { ...baseOptions };
          const computed = window.getComputedStyle(node);

          if (['SPAN', 'B', 'STRONG', 'I', 'EM', 'U'].includes(node.tagName)) {
            const isBold = computed.fontWeight === 'bold' || parseInt(computed.fontWeight) >= 600;
            if (isBold) options.bold = true;
            if (computed.fontStyle === 'italic') options.italic = true;
            if (computed.textDecoration && computed.textDecoration.includes('underline')) options.underline = true;
            if (computed.color && computed.color !== 'rgb(0, 0, 0)') {
              options.color = rgbToHex(computed.color);
              const t = extractAlpha(computed.color);
              if (t !== null) options.transparency = t;
            }
            if (computed.fontSize) options.fontSize = pxToPoints(computed.fontSize);
            if (computed.fontFamily) {
              options.fontFace = computed.fontFamily.split(',')[0].replace(/['"]/g, '').trim();
            }

            if (computed.textTransform && computed.textTransform !== 'none') {
              const ts = computed.textTransform;
              textTransform = (text) => applyTextTransform(text, ts);
            }

            parseInlineFormatting(node, options, runs, textTransform);
          }
        }

        prevNodeIsText = isText;
      });

      if (runs.length > 0) {
        runs[0].text = runs[0].text.replace(/^\s+/, '');
        runs[runs.length - 1].text = runs[runs.length - 1].text.replace(/\s+$/, '');
      }

      return runs.filter(r => r.text.length > 0);
    };

    // --- Extract background ---
    const body = document.body;
    const bodyStyle = window.getComputedStyle(body);
    const bgImage = bodyStyle.backgroundImage;
    const bgColor = bodyStyle.backgroundColor;
    const errors = [];

    let background;
    let backgroundGradient = null;

    if (bgImage && bgImage !== 'none') {
      if (bgImage.includes('linear-gradient') && bgImage.includes('url(')) {
        // Overlay gradient + image: extract image URL, gradient handled by rasterization
        const urlMatch = bgImage.match(/url\(["']?([^"')]+)["']?\)/);
        background = {
          type: 'composited-image',
          path: urlMatch ? urlMatch[1] : null,
          gradient: bgImage
        };
      } else if (bgImage.includes('linear-gradient')) {
        // Pure gradient — pass through for native conversion
        background = { type: 'gradient', value: bgImage };
        backgroundGradient = bgImage;
      } else {
        const urlMatch = bgImage.match(/url\(["']?([^"')]+)["']?\)/);
        background = urlMatch
          ? { type: 'image', path: urlMatch[1] }
          : { type: 'color', value: rgbToHex(bgColor) };
      }
    } else {
      background = { type: 'color', value: rgbToHex(bgColor) };
    }

    // --- Process elements ---
    const elements = [];
    const placeholders = [];
    const rasterizeCandidates = []; // Elements that need per-element rasterization
    const textTags = ['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'LI'];
    const processed = new Set();

    document.querySelectorAll('*').forEach((el) => {
      if (processed.has(el)) return;

      // Placeholders
      if (el.className && typeof el.className === 'string' && el.className.includes('placeholder')) {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          placeholders.push({
            id: el.id || `placeholder-${placeholders.length}`,
            x: pxToInch(rect.left), y: pxToInch(rect.top),
            w: pxToInch(rect.width), h: pxToInch(rect.height)
          });
        }
        processed.add(el);
        return;
      }

      // Images
      if (el.tagName === 'IMG') {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          elements.push({
            type: 'image', src: el.src,
            position: { x: pxToInch(rect.left), y: pxToInch(rect.top), w: pxToInch(rect.width), h: pxToInch(rect.height) }
          });
          processed.add(el);
        }
        return;
      }

      // SVG elements — mark for rasterization
      if (el.tagName === 'SVG' || el.tagName === 'svg') {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          rasterizeCandidates.push({
            selector: el.id ? `#${el.id}` : `svg:nth-of-type(${Array.from(document.querySelectorAll('svg')).indexOf(el) + 1})`,
            position: { x: pxToInch(rect.left), y: pxToInch(rect.top), w: pxToInch(rect.width), h: pxToInch(rect.height) },
            reason: 'svg'
          });
          processed.add(el);
        }
        return;
      }

      // DIVs — check for backgrounds, gradients, borders
      const isContainer = el.tagName === 'DIV' && !textTags.includes(el.tagName);
      if (isContainer) {
        const computed = window.getComputedStyle(el);
        const hasBg = computed.backgroundColor && computed.backgroundColor !== 'rgba(0, 0, 0, 0)';
        const hasBgImage = computed.backgroundImage && computed.backgroundImage !== 'none';
        const hasGradient = hasBgImage && computed.backgroundImage.includes('gradient');

        // Check for unwrapped text
        for (const node of el.childNodes) {
          if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
            errors.push(
              `DIV contains unwrapped text "${node.textContent.trim().substring(0, 50)}". ` +
              'Wrap in <p>, <h1>-<h6>, <ul>, or <ol>.'
            );
          }
        }

        // Check for borders
        const borders = ['borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth']
          .map(p => parseFloat(computed[p]) || 0);
        const hasBorder = borders.some(b => b > 0);
        const hasUniformBorder = hasBorder && borders.every(b => b === borders[0]);

        const borderLines = [];
        if (hasBorder && !hasUniformBorder) {
          const rect = el.getBoundingClientRect();
          const x = pxToInch(rect.left), y = pxToInch(rect.top);
          const w = pxToInch(rect.width), h = pxToInch(rect.height);

          if (borders[0] > 0) {
            const wp = pxToPoints(computed.borderTopWidth);
            const inset = (wp / 72) / 2;
            borderLines.push({ type: 'line', x1: x, y1: y + inset, x2: x + w, y2: y + inset, width: wp, color: rgbToHex(computed.borderTopColor) });
          }
          if (borders[1] > 0) {
            const wp = pxToPoints(computed.borderRightWidth);
            const inset = (wp / 72) / 2;
            borderLines.push({ type: 'line', x1: x + w - inset, y1: y, x2: x + w - inset, y2: y + h, width: wp, color: rgbToHex(computed.borderRightColor) });
          }
          if (borders[2] > 0) {
            const wp = pxToPoints(computed.borderBottomWidth);
            const inset = (wp / 72) / 2;
            borderLines.push({ type: 'line', x1: x, y1: y + h - inset, x2: x + w, y2: y + h - inset, width: wp, color: rgbToHex(computed.borderBottomColor) });
          }
          if (borders[3] > 0) {
            const wp = pxToPoints(computed.borderLeftWidth);
            const inset = (wp / 72) / 2;
            borderLines.push({ type: 'line', x1: x + inset, y1: y, x2: x + inset, y2: y + h, width: wp, color: rgbToHex(computed.borderLeftColor) });
          }
        }

        if (hasGradient || hasBg || hasBorder) {
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            const shadow = parseBoxShadow(computed.boxShadow);
            const rectRadius = (() => {
              const radius = computed.borderRadius;
              const radiusValue = parseFloat(radius);
              if (radiusValue === 0) return 0;
              if (radius.includes('%')) {
                if (radiusValue >= 50) return 1;
                return (radiusValue / 100) * pxToInch(Math.min(rect.width, rect.height));
              }
              if (radius.includes('pt')) return radiusValue / 72;
              return radiusValue / PX_PER_IN;
            })();

            if (hasGradient) {
              // Mark gradient DIVs — we'll try native conversion first, rasterize as fallback
              elements.push({
                type: 'shape',
                text: '',
                position: { x: pxToInch(rect.left), y: pxToInch(rect.top), w: pxToInch(rect.width), h: pxToInch(rect.height) },
                shape: {
                  fill: null,
                  gradient: computed.backgroundImage,
                  line: hasUniformBorder ? { color: rgbToHex(computed.borderColor), width: pxToPoints(computed.borderWidth) } : null,
                  rectRadius, shadow
                }
              });
            } else if (hasBg || hasUniformBorder) {
              elements.push({
                type: 'shape',
                text: '',
                position: { x: pxToInch(rect.left), y: pxToInch(rect.top), w: pxToInch(rect.width), h: pxToInch(rect.height) },
                shape: {
                  fill: hasBg ? rgbToHex(computed.backgroundColor) : null,
                  transparency: hasBg ? extractAlpha(computed.backgroundColor) : null,
                  line: hasUniformBorder ? { color: rgbToHex(computed.borderColor), width: pxToPoints(computed.borderWidth) } : null,
                  rectRadius, shadow
                }
              });
            }

            elements.push(...borderLines);
            processed.add(el);
            return;
          }
        }
      }

      // Text elements — same as standard html2pptx
      if (el.tagName === 'UL' || el.tagName === 'OL') {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;

        const liElements = Array.from(el.querySelectorAll('li'));
        const items = [];
        const ulComputed = window.getComputedStyle(el);
        const ulPaddingLeftPt = pxToPoints(ulComputed.paddingLeft);
        const marginLeft = ulPaddingLeftPt * 0.5;
        const textIndent = ulPaddingLeftPt * 0.5;

        liElements.forEach((li, idx) => {
          const isLast = idx === liElements.length - 1;
          const liComputed = window.getComputedStyle(li);
          const liBaseOptions = {
            breakLine: false,
            fontSize: pxToPoints(liComputed.fontSize),
            fontFace: liComputed.fontFamily.split(',')[0].replace(/['"]/g, '').trim(),
            color: rgbToHex(liComputed.color),
          };
          const isBold = liComputed.fontWeight === 'bold' || parseInt(liComputed.fontWeight) >= 600;
          if (isBold) liBaseOptions.bold = true;
          const runs = parseInlineFormatting(li, liBaseOptions);
          if (runs.length > 0) {
            runs[0].text = runs[0].text.replace(/^[•\-\*▪▸]\s*/, '');
            runs[0].options.bullet = { indent: textIndent };
          }
          if (runs.length > 0 && !isLast) {
            runs[runs.length - 1].options.breakLine = true;
          }
          items.push(...runs);
        });

        const computed = window.getComputedStyle(liElements[0] || el);
        elements.push({
          type: 'list', items,
          position: { x: pxToInch(rect.left), y: pxToInch(rect.top), w: pxToInch(rect.width), h: pxToInch(rect.height) },
          style: {
            fontSize: pxToPoints(computed.fontSize),
            fontFace: computed.fontFamily.split(',')[0].replace(/['"]/g, '').trim(),
            color: rgbToHex(computed.color),
            align: computed.textAlign === 'start' ? 'left' : computed.textAlign,
            lineSpacing: computed.lineHeight !== 'normal' ? pxToPoints(computed.lineHeight) : null,
            paraSpaceBefore: 0, paraSpaceAfter: pxToPoints(computed.marginBottom),
            margin: [marginLeft, 0, 0, 0]
          }
        });
        liElements.forEach(li => processed.add(li));
        processed.add(el);
        return;
      }

      if (!textTags.includes(el.tagName)) return;

      // Validate: text elements shouldn't have bg/border/shadow
      const textComputed = window.getComputedStyle(el);
      const textHasBg = textComputed.backgroundColor && textComputed.backgroundColor !== 'rgba(0, 0, 0, 0)';
      const textHasBorder = parseFloat(textComputed.borderWidth) > 0;
      const textHasShadow = textComputed.boxShadow && textComputed.boxShadow !== 'none';
      if (textHasBg || textHasBorder || textHasShadow) {
        errors.push(`Text <${el.tagName.toLowerCase()}> has ${textHasBg ? 'background' : textHasBorder ? 'border' : 'shadow'}. Use <div> for visual styling.`);
        return;
      }

      const rect = el.getBoundingClientRect();
      const text = el.textContent.trim();
      if (rect.width === 0 || rect.height === 0 || !text) return;

      const computed = window.getComputedStyle(el);
      const rotation = getRotation(computed.transform, computed.writingMode);
      const { x, y, w, h } = getPositionAndSize(el, rect, rotation);

      const baseStyle = {
        fontSize: pxToPoints(computed.fontSize),
        fontFace: computed.fontFamily.split(',')[0].replace(/['"]/g, '').trim(),
        color: rgbToHex(computed.color),
        align: computed.textAlign === 'start' ? 'left' : computed.textAlign,
        lineSpacing: pxToPoints(computed.lineHeight),
        paraSpaceBefore: pxToPoints(computed.marginTop),
        paraSpaceAfter: pxToPoints(computed.marginBottom),
        margin: [
          pxToPoints(computed.paddingLeft), pxToPoints(computed.paddingRight),
          pxToPoints(computed.paddingBottom), pxToPoints(computed.paddingTop)
        ]
      };

      const transparency = extractAlpha(computed.color);
      if (transparency !== null) baseStyle.transparency = transparency;
      if (rotation !== null) baseStyle.rotate = rotation;

      const hasFormatting = el.querySelector('b, i, u, strong, em, span, br');
      if (hasFormatting) {
        const transformStr = computed.textTransform;
        const isBold = computed.fontWeight === 'bold' || parseInt(computed.fontWeight) >= 600;
        const runBaseOptions = {
          fontSize: baseStyle.fontSize,
          fontFace: baseStyle.fontFace,
          color: baseStyle.color,
        };
        if (isBold) runBaseOptions.bold = true;
        if (computed.fontStyle === 'italic') runBaseOptions.italic = true;
        const runs = parseInlineFormatting(el, runBaseOptions, [], (str) => applyTextTransform(str, transformStr));
        elements.push({
          type: el.tagName.toLowerCase(), text: runs,
          position: { x: pxToInch(x), y: pxToInch(y), w: pxToInch(w), h: pxToInch(h) },
          style: baseStyle
        });
      } else {
        const transformedText = applyTextTransform(text, computed.textTransform);
        const isBold = computed.fontWeight === 'bold' || parseInt(computed.fontWeight) >= 600;
        elements.push({
          type: el.tagName.toLowerCase(), text: transformedText,
          position: { x: pxToInch(x), y: pxToInch(y), w: pxToInch(w), h: pxToInch(h) },
          style: {
            ...baseStyle,
            bold: isBold, italic: computed.fontStyle === 'italic',
            underline: computed.textDecoration.includes('underline')
          }
        });
      }
      processed.add(el);
    });

    return { background, backgroundGradient, elements, placeholders, rasterizeCandidates, errors };
  });
}

/**
 * Add background to slide, handling gradients and composited images.
 */
async function addBackgroundHD(slideData, targetSlide, page, tmpDir) {
  const bg = slideData.background;

  if (bg.type === 'composited-image') {
    // Full-bleed image with CSS overlay — rasterize the body background
    const bgScreenshot = path.join(tmpDir, `bg-composited-${Date.now()}.png`);
    await page.screenshot({
      path: bgScreenshot,
      clip: { x: 0, y: 0, width: HD_WIDTH_PX, height: HD_HEIGHT_PX },
      omitBackground: false,
    });

    // Strip all foreground elements to get just the background
    await page.evaluate(() => {
      document.querySelectorAll('body > *').forEach(el => { el.style.visibility = 'hidden'; });
    });
    await page.screenshot({
      path: bgScreenshot,
      clip: { x: 0, y: 0, width: HD_WIDTH_PX, height: HD_HEIGHT_PX },
    });
    await page.evaluate(() => {
      document.querySelectorAll('body > *').forEach(el => { el.style.visibility = ''; });
    });

    targetSlide.background = { path: bgScreenshot };
  } else if (bg.type === 'gradient') {
    // Try native gradient conversion
    const gradientFill = parseCSSGradient(bg.value);
    if (gradientFill) {
      // PptxGenJS doesn't support gradient backgrounds directly on slides,
      // so we add a full-slide shape with the gradient fill
      targetSlide.addShape('rect', {
        x: 0, y: 0, w: HD_WIDTH_IN, h: HD_HEIGHT_IN,
        ...gradientFill
      });
    } else {
      // Fallback: rasterize the gradient
      const bgScreenshot = path.join(tmpDir, `bg-gradient-${Date.now()}.png`);
      await page.evaluate(() => {
        document.querySelectorAll('body > *').forEach(el => { el.style.visibility = 'hidden'; });
      });
      await page.screenshot({
        path: bgScreenshot,
        clip: { x: 0, y: 0, width: HD_WIDTH_PX, height: HD_HEIGHT_PX },
      });
      await page.evaluate(() => {
        document.querySelectorAll('body > *').forEach(el => { el.style.visibility = ''; });
      });
      targetSlide.background = { path: bgScreenshot };
    }
  } else if (bg.type === 'image' && bg.path) {
    let imagePath = bg.path.startsWith('file://') ? bg.path.replace('file://', '') : bg.path;
    targetSlide.background = { path: imagePath };
  } else if (bg.type === 'color' && bg.value) {
    targetSlide.background = { color: bg.value };
  }
}

/**
 * Add elements to slide, with gradient-aware shape conversion.
 */
async function addElementsHD(slideData, targetSlide, pres, tmpDir) {
  for (const el of slideData.elements) {
    if (el.type === 'image') {
      let imagePath = el.src.startsWith('file://') ? el.src.replace('file://', '') : el.src;

      // Convert SVG to PNG — PowerPoint has unreliable SVG support
      if (imagePath.toLowerCase().endsWith('.svg')) {
        try {
          const pngPath = path.join(tmpDir, `svg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.png`);
          const scale = 3; // 3x for crisp rendering
          const widthPx = Math.round(el.position.w * PX_PER_IN * scale);
          const heightPx = Math.round(el.position.h * PX_PER_IN * scale);
          await sharp(imagePath)
            .resize(widthPx, heightPx, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .png()
            .toFile(pngPath);
          imagePath = pngPath;
        } catch (err) {
          console.warn(`SVG→PNG conversion failed for ${imagePath}: ${err.message}`);
        }
      }

      targetSlide.addImage({
        path: imagePath,
        x: el.position.x, y: el.position.y, w: el.position.w, h: el.position.h
      });

    } else if (el.type === 'line') {
      targetSlide.addShape(pres.ShapeType.line, {
        x: el.x1, y: el.y1, w: el.x2 - el.x1, h: el.y2 - el.y1,
        line: { color: el.color, width: el.width }
      });

    } else if (el.type === 'shape') {
      const shapeType = el.shape.rectRadius > 0 ? pres.ShapeType.roundRect : pres.ShapeType.rect;
      const shapeOptions = {
        x: el.position.x, y: el.position.y, w: el.position.w, h: el.position.h,
        shape: shapeType
      };

      // Handle gradient fills
      if (el.shape.gradient) {
        const gradientFill = parseCSSGradient(el.shape.gradient);
        if (gradientFill) {
          Object.assign(shapeOptions, gradientFill);
        } else {
          // Gradient couldn't be parsed — mark for rasterization
          shapeOptions.fill = { color: 'CCCCCC' }; // fallback solid
        }
      } else if (el.shape.fill) {
        shapeOptions.fill = { color: el.shape.fill };
        if (el.shape.transparency != null) shapeOptions.fill.transparency = el.shape.transparency;
      }

      if (el.shape.line) shapeOptions.line = el.shape.line;
      if (el.shape.rectRadius > 0) shapeOptions.rectRadius = el.shape.rectRadius;
      if (el.shape.shadow) shapeOptions.shadow = el.shape.shadow;

      targetSlide.addText(el.text || '', shapeOptions);

    } else if (el.type === 'list') {
      const listW = el.position.w + el.position.w * 0.05;
      const listH = el.position.h + el.position.h * 0.05;
      targetSlide.addText(el.items, {
        x: el.position.x, y: el.position.y, w: listW, h: listH,
        fontSize: el.style.fontSize, fontFace: el.style.fontFace,
        color: el.style.color, align: el.style.align, valign: 'top',
        lineSpacing: el.style.lineSpacing,
        paraSpaceBefore: el.style.paraSpaceBefore, paraSpaceAfter: el.style.paraSpaceAfter,
        margin: el.style.margin, inset: 0, autoFit: false, shrinkText: false, wrap: true
      });

    } else {
      // Text elements
      const lineHeight = el.style.lineSpacing || el.style.fontSize * 1.2;
      const isSingleLine = el.position.h <= lineHeight * 1.5;

      // PowerPoint text engine wraps differently from CSS — add width margin
      // to prevent premature wrapping. Larger margin for multi-line text.
      let adjustedX = el.position.x;
      let adjustedW = el.position.w;
      let adjustedH = el.position.h;
      const widthFactor = isSingleLine ? 0.03 : 0.05;
      const widthIncrease = el.position.w * widthFactor;
      const align = el.style.align;
      if (align === 'center') {
        adjustedX -= widthIncrease / 2;
        adjustedW += widthIncrease;
      } else if (align === 'right') {
        adjustedX -= widthIncrease;
        adjustedW += widthIncrease;
      } else {
        adjustedW += widthIncrease;
      }
      // Add height margin for multi-line text to prevent clipping
      if (!isSingleLine) {
        adjustedH += el.position.h * 0.05;
      }

      const textOptions = {
        x: adjustedX, y: el.position.y, w: adjustedW, h: adjustedH,
        fontSize: el.style.fontSize, fontFace: el.style.fontFace,
        color: el.style.color, bold: el.style.bold, italic: el.style.italic,
        underline: el.style.underline, valign: 'top',
        lineSpacing: el.style.lineSpacing,
        paraSpaceBefore: el.style.paraSpaceBefore, paraSpaceAfter: el.style.paraSpaceAfter,
        inset: 0, autoFit: false, shrinkText: false, wrap: true
      };

      if (el.style.align) textOptions.align = el.style.align;
      if (el.style.margin) textOptions.margin = el.style.margin;
      if (el.style.rotate !== undefined) textOptions.rotate = el.style.rotate;
      if (el.style.transparency != null) textOptions.transparency = el.style.transparency;

      targetSlide.addText(el.text, textOptions);
    }
  }
}

/**
 * Convert an HD HTML slide to a PPTX slide.
 *
 * @param {string} htmlFile - Path to HTML slide file
 * @param {Object} pres - PptxGenJS presentation instance (must have HD layout set)
 * @param {Object} [options] - Options
 * @param {string} [options.tmpDir] - Temporary directory for rasterized elements
 * @param {Object} [options.slide] - Existing slide to reuse
 * @returns {{ slide, placeholders }} Created slide and placeholder positions
 */
async function html2pptxHD(htmlFile, pres, options = {}) {
  const {
    tmpDir = process.env.TMPDIR || '/tmp',
    slide = null
  } = options;

  const launchOptions = { env: { TMPDIR: tmpDir } };
  if (process.platform === 'darwin') launchOptions.channel = 'chrome';

  const browser = await chromium.launch(launchOptions);

  try {
    const page = await browser.newPage();
    const filePath = path.isAbsolute(htmlFile) ? htmlFile : path.join(process.cwd(), htmlFile);

    await page.goto(`file://${filePath}`);

    // Wait for fonts to load
    await page.evaluate(() => document.fonts.ready);

    // Set viewport to HD dimensions
    await page.setViewportSize({ width: HD_WIDTH_PX, height: HD_HEIGHT_PX });

    // Validate body dimensions
    const bodyDims = await page.evaluate(() => {
      const body = document.body;
      const style = window.getComputedStyle(body);
      return {
        width: parseFloat(style.width),
        height: parseFloat(style.height),
        scrollWidth: body.scrollWidth,
        scrollHeight: body.scrollHeight
      };
    });

    const validationErrors = [];

    if (Math.abs(bodyDims.width - HD_WIDTH_PX) > 2 || Math.abs(bodyDims.height - HD_HEIGHT_PX) > 2) {
      validationErrors.push(
        `Body dimensions (${bodyDims.width}×${bodyDims.height}px) don't match HD canvas (${HD_WIDTH_PX}×${HD_HEIGHT_PX}px)`
      );
    }

    const widthOverflow = Math.max(0, bodyDims.scrollWidth - bodyDims.width - 1);
    const heightOverflow = Math.max(0, bodyDims.scrollHeight - bodyDims.height - 1);
    if (widthOverflow > 0 || heightOverflow > 0) {
      const dirs = [];
      if (widthOverflow > 0) dirs.push(`${widthOverflow}px horizontally`);
      if (heightOverflow > 0) dirs.push(`${heightOverflow}px vertically`);
      validationErrors.push(`Content overflows body by ${dirs.join(' and ')}`);
    }

    // Extract slide data
    const slideData = await extractSlideDataHD(page);

    if (slideData.errors && slideData.errors.length > 0) {
      validationErrors.push(...slideData.errors);
    }

    if (validationErrors.length > 0) {
      const msg = validationErrors.length === 1
        ? validationErrors[0]
        : `Multiple validation errors:\n${validationErrors.map((e, i) => `  ${i + 1}. ${e}`).join('\n')}`;
      throw new Error(`${htmlFile}: ${msg}`);
    }

    const targetSlide = slide || pres.addSlide();

    // Add background (gradient-aware)
    await addBackgroundHD(slideData, targetSlide, page, tmpDir);

    // Handle per-element rasterization for SVGs and complex elements
    if (slideData.rasterizeCandidates && slideData.rasterizeCandidates.length > 0) {
      for (let i = 0; i < slideData.rasterizeCandidates.length; i++) {
        const candidate = slideData.rasterizeCandidates[i];
        const imgPath = path.join(tmpDir, `raster-${Date.now()}-${i}.png`);
        try {
          await rasterizeElement(page, candidate.selector, imgPath, 2);
          targetSlide.addImage({
            path: imgPath,
            x: candidate.position.x, y: candidate.position.y,
            w: candidate.position.w, h: candidate.position.h
          });
        } catch (err) {
          console.warn(`Rasterization failed for ${candidate.selector}: ${err.message}`);
        }
      }
    }

    // Add native elements
    await addElementsHD(slideData, targetSlide, pres, tmpDir);

    return { slide: targetSlide, placeholders: slideData.placeholders };

  } finally {
    await browser.close();
  }
}

/**
 * Fix PptxGenJS Content_Types.xml bug: phantom slide master entries.
 *
 * PptxGenJS registers Content_Types overrides for slideMaster2..N even though
 * only slideMaster1.xml exists. PowerPoint detects the missing parts and
 * shows a repair warning. This function removes the phantom entries.
 *
 * Call after pptx.writeFile() completes.
 *
 * @param {string} pptxPath - Absolute path to the .pptx file
 */
async function repairPptx(pptxPath) {
  const JSZip = require('jszip');
  const data = fs.readFileSync(pptxPath);
  const zip = await JSZip.loadAsync(data);

  const ctFile = zip.file('[Content_Types].xml');
  if (!ctFile) return;

  let ct = await ctFile.async('string');

  // Collect actual slideMaster files in the archive
  const masterFiles = new Set();
  zip.folder('ppt/slideMasters').forEach((relativePath) => {
    if (relativePath.endsWith('.xml') && !relativePath.includes('_rels')) {
      masterFiles.add(relativePath); // e.g. "slideMaster1.xml"
    }
  });

  // Remove Override entries for non-existent slide masters
  const before = ct;
  ct = ct.replace(/<Override\s+PartName="\/ppt\/slideMasters\/(slideMaster\d+\.xml)"[^>]*\/>/g,
    (match, filename) => {
      if (masterFiles.has(filename)) return match;
      return ''; // Remove phantom entry
    }
  );

  if (ct !== before) {
    zip.file('[Content_Types].xml', ct);
    const fixed = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });
    fs.writeFileSync(pptxPath, fixed);
  }
}

// Export constants for external use
html2pptxHD.HD_WIDTH_PX = HD_WIDTH_PX;
html2pptxHD.HD_HEIGHT_PX = HD_HEIGHT_PX;
html2pptxHD.HD_WIDTH_IN = HD_WIDTH_IN;
html2pptxHD.HD_HEIGHT_IN = HD_HEIGHT_IN;
html2pptxHD.parseCSSGradient = parseCSSGradient;
html2pptxHD.rasterizeElement = rasterizeElement;
html2pptxHD.repairPptx = repairPptx;

module.exports = html2pptxHD;
