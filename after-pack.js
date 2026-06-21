/**
 * electron-builder afterPack hook
 * Copies node_modules/.prisma into the packaged app directory.
 * electron-builder's glob filters skip dot-directories, so this is the
 * only reliable way to include the Prisma query-engine binary.
 */
const fs   = require('fs');
const path = require('path');

module.exports = async function afterPack(context) {
  var src = path.join(__dirname, 'node_modules', '.prisma');

  if (!fs.existsSync(src)) {
    console.log('[afterPack] .prisma source not found — skipping');
    return;
  }

  // Resolve the packed app directory.  electron-builder v24 passes the
  // unpacked-app path as context.appDir on some versions; fall back to the
  // well-known layout used by this project's config (asar=false, win target).
  var appDir = context.appDir;
  if (!appDir) {
    // Try common electron-builder v24 context shapes
    appDir = (context.packager && context.packager.appDir);
  }
  if (!appDir) {
    // Hard fallback: we know our directories.output is dist-electron
    appDir = path.join(__dirname, 'dist-electron', 'win-unpacked', 'resources', 'app');
  }

  var dst = path.join(appDir, 'node_modules', '.prisma');
  console.log('[afterPack] copying .prisma from', src, 'to', dst);

  try {
    fs.cpSync(src, dst, { recursive: true, force: true });
    console.log('[afterPack] Copied .prisma successfully');
  } catch (e) {
    console.error('[afterPack] Failed to copy .prisma:', e.message);
  }
};
