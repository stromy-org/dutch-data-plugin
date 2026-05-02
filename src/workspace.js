/**
 * Workspace output path resolution for ClaudeCowork build scripts.
 *
 * Usage (from workspace/<client>/build/<deliverable>/build.js):
 *   const { ensureOutputDir, resolveOutputPath } = require('../../../../src/workspace');
 *   const outputDir = ensureOutputDir(__dirname);
 *   // → workspace/<client>/output/<deliverable>/
 */

const path = require('path');
const fs = require('fs');

/**
 * Walk up from a build script directory to find the project root.
 * Expects: workspace/<client>/build/<deliverable>/ → returns workspace/<client>/
 * Falls back to the build script's own directory if structure doesn't match.
 */
function resolveProjectRoot(buildDir) {
  const abs = path.resolve(buildDir);
  const parentName = path.basename(path.dirname(abs));
  if (parentName === 'build') {
    return path.dirname(path.dirname(abs)); // up two levels: build/<name>/ → <client>/
  }
  // Legacy flat structure: workspace/<project>/build.js → workspace/<project>/
  return abs;
}

/**
 * Resolve the output directory for a build script.
 *
 * Precedence:
 *   1. options.outputDir (explicit — for external agents)
 *   2. OUTPUT_DIR env var
 *   3. .remotion-project marker → <projectRoot>/out/
 *   4. Convention → <projectRoot>/output/<deliverable>/
 */
function resolveOutputDir(buildDir, options) {
  if (options && options.outputDir) return path.resolve(options.outputDir);
  if (process.env.OUTPUT_DIR) return path.resolve(process.env.OUTPUT_DIR);

  const projectRoot = resolveProjectRoot(buildDir);

  // Remotion exception
  if (fs.existsSync(path.join(projectRoot, '.remotion-project'))) {
    return path.join(projectRoot, 'out');
  }

  // New convention: workspace/<client>/output/<deliverable>/
  const abs = path.resolve(buildDir);
  const parentName = path.basename(path.dirname(abs));
  if (parentName === 'build') {
    const deliverable = path.basename(abs);
    return path.join(projectRoot, 'output', deliverable);
  }

  // Legacy flat: workspace/<project>/output/
  return path.join(projectRoot, 'output');
}

/** Resolve output dir and create it if it doesn't exist. */
function ensureOutputDir(buildDir, options) {
  const dir = resolveOutputDir(buildDir, options);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Resolve full path to an output file. */
function resolveOutputPath(buildDir, filename, options) {
  return path.join(resolveOutputDir(buildDir, options), filename);
}

module.exports = { resolveProjectRoot, resolveOutputDir, ensureOutputDir, resolveOutputPath };
