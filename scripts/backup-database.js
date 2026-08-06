/**
 * Backs up the local PostgreSQL database via pg_dump (custom format, compressed),
 * then encrypts it and pushes a copy off-site — to Backblaze B2, Google
 * Drive, both, or neither, whichever a clinic has actually configured.
 *
 * Manual run:   node scripts/backup-database.js
 * Scheduled:    registered as a daily Windows Task Scheduler job — see CLAUDE.md
 *               "Database Backups" section for setup + restore instructions.
 *
 * Writes timestamped .dump files to backups/ (gitignored) and prunes anything
 * older than RETENTION_DAYS on every run.
 *
 * The off-site step (encrypt + upload) only attempts a given provider if
 * that provider's env vars are set — B2_BUCKET/B2_APPLICATION_KEY_ID/
 * B2_APPLICATION_KEY for Backblaze, GDRIVE_RCLONE_TOKEN for Google Drive —
 * plus BACKUP_ENCRYPTION_PASSPHRASE either way. Neither configured is fine:
 * the local backup still completes normally with a clear warning. This is
 * deliberate: the off-site step is additive, not a new hard dependency of
 * the nightly job that's already running in production.
 */
require('dotenv').config();
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { encryptFile } = require('./lib/backup-crypto');

const RETENTION_DAYS = 14;
const OFFSITE_RETENTION_DAYS = 90;
const BACKUP_DIR = path.join(__dirname, '..', 'backups');
const B2_REMOTE_NAME = 'ssmcb2';
const GDRIVE_REMOTE_NAME = 'ssmcgdrive';

function parseConnectionString(url) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parsed.port || '5432',
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: parsed.pathname.replace(/^\//, ''),
  };
}

function pruneOldBackups() {
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  // Also cleans up ssmc_emr_*.dump.enc — a staging file only ever left
  // behind when backupOffsite() encrypted successfully but the upload then
  // failed (e.g. rclone misconfigured). Without this, a persistently
  // broken off-site step would silently accumulate one orphaned .enc file
  // per run forever, since it's not the primary .dump backup this loop
  // already prunes.
  const files = fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => f.startsWith('ssmc_emr_') && (f.endsWith('.dump') || f.endsWith('.dump.enc')));

  let pruned = 0;
  for (const file of files) {
    const filePath = path.join(BACKUP_DIR, file);
    if (fs.statSync(filePath).mtimeMs < cutoff) {
      fs.unlinkSync(filePath);
      pruned++;
    }
  }

  if (pruned > 0) {
    console.log(`Pruned ${pruned} backup(s) older than ${RETENTION_DAYS} days.`);
  }
}

/**
 * Copies localPath to remoteDir via rclone, then verifies the upload by
 * checking the remote object's size matches — never trusts rclone's exit
 * code alone, since a local backup succeeding says nothing about whether
 * the off-site copy actually landed. Shared by every provider below so
 * they can't silently drift in how "success" is defined.
 *
 * @returns {boolean} true if the upload was verified successful
 */
function uploadToRemote(localPath, rcloneEnv, remoteDir, label) {
  const remotePath = `${remoteDir}${path.basename(localPath)}`;

  console.log(`Uploading encrypted backup to ${label} (${remotePath})...`);

  const copyResult = spawnSync('rclone', ['copy', localPath, remoteDir], {
    env: rcloneEnv,
    stdio: 'inherit',
  });

  if (copyResult.error) {
    console.error(
      `OFF-SITE BACKUP FAILED (${label}): could not run rclone. Is it installed and on PATH?`,
      copyResult.error.message
    );
    return false;
  }
  if (copyResult.status !== 0) {
    console.error(`OFF-SITE BACKUP FAILED (${label}): rclone copy exited with code ${copyResult.status}`);
    return false;
  }

  const localSize = fs.statSync(localPath).size;
  const lsResult = spawnSync(
    'rclone',
    ['lsf', '--format', 'sp', '--separator', ';', remotePath],
    { env: rcloneEnv, encoding: 'utf8' }
  );
  const listedLine = (lsResult.stdout || '').trim();
  const remoteSize = parseInt(listedLine.split(';')[0], 10);

  if (lsResult.status !== 0 || !listedLine || remoteSize !== localSize) {
    console.error(
      `OFF-SITE BACKUP FAILED (${label}): upload could not be verified (local ${localSize} bytes, ` +
        `remote reported "${listedLine || 'nothing'}"). The local backup is still safe, but this ` +
        'off-site copy for this run cannot be trusted.'
    );
    return false;
  }

  console.log(`Off-site backup verified (${label}): ${remotePath} (${(remoteSize / 1024 / 1024).toFixed(2)} MB)`);
  return true;
}

/** Backblaze B2 — a static, script-usable Application Key. Off-site retention
 * (90 days, longer than the 14-day local window) is configured as a
 * Backblaze Lifecycle Rule on the bucket itself, not here. */
function backupToB2(encryptedPath) {
  const bucket = process.env.B2_BUCKET;
  const keyId = process.env.B2_APPLICATION_KEY_ID;
  const appKey = process.env.B2_APPLICATION_KEY;
  if (!bucket || !keyId || !appKey) return;

  const configPrefix = `RCLONE_CONFIG_${B2_REMOTE_NAME.toUpperCase()}`;
  const rcloneEnv = {
    ...process.env,
    [`${configPrefix}_TYPE`]: 'b2',
    [`${configPrefix}_ACCOUNT`]: keyId,
    [`${configPrefix}_KEY`]: appKey,
  };

  uploadToRemote(encryptedPath, rcloneEnv, `${B2_REMOTE_NAME}:${bucket}/`, 'Backblaze B2');
}

/** Google Drive — OAuth2, not a static key. GDRIVE_RCLONE_TOKEN is the JSON
 * blob from a one-time `rclone authorize "drive"` (a human has to do this
 * once; a script cannot produce it) — see CLAUDE.md "Database Backups".
 * Unlike B2, plain Google Drive has no server-side "delete after N days"
 * setting, so off-site retention is enforced here instead, after a
 * successful upload. */
function backupToGoogleDrive(encryptedPath) {
  const token = process.env.GDRIVE_RCLONE_TOKEN;
  if (!token) return;
  const folderId = process.env.GDRIVE_FOLDER_ID;
  const clientId = process.env.GDRIVE_CLIENT_ID;
  const clientSecret = process.env.GDRIVE_CLIENT_SECRET;

  const configPrefix = `RCLONE_CONFIG_${GDRIVE_REMOTE_NAME.toUpperCase()}`;
  const rcloneEnv = {
    ...process.env,
    [`${configPrefix}_TYPE`]: 'drive',
    [`${configPrefix}_TOKEN`]: token,
    // A dedicated OAuth client, not rclone's shared default one. Confirmed
    // during initial setup here that this isn't just a theoretical
    // rate-limit concern — rclone's shared client_id prints an explicit
    // retirement warning ("being retired and will stop working during
    // 2026"), so a dedicated client (Google Cloud Console → APIs &
    // Services → Credentials → OAuth client ID, type "Desktop app" — see
    // CLAUDE.md) is the real requirement now, not an optional upgrade.
    // Both must be set together (a token obtained under one client can't
    // be refreshed under a different one) — omitted together falls back
    // to the shared client, which still works today but is on borrowed time.
    ...(clientId && clientSecret
      ? { [`${configPrefix}_CLIENT_ID`]: clientId, [`${configPrefix}_CLIENT_SECRET`]: clientSecret }
      : {}),
    // Scopes the remote's root to this folder, so every rclone call below
    // can just address `ssmcgdrive:` — no manual path composition. Omitted
    // entirely (uploads to actual Drive root) if GDRIVE_FOLDER_ID is unset.
    ...(folderId ? { [`${configPrefix}_ROOT_FOLDER_ID`]: folderId } : {}),
  };

  const success = uploadToRemote(encryptedPath, rcloneEnv, `${GDRIVE_REMOTE_NAME}:`, 'Google Drive');

  if (success) {
    const pruneResult = spawnSync(
      'rclone',
      ['delete', '--min-age', `${OFFSITE_RETENTION_DAYS}d`, `${GDRIVE_REMOTE_NAME}:`],
      { env: rcloneEnv, stdio: 'inherit' }
    );
    if (pruneResult.status !== 0) {
      console.warn(
        `Warning: could not prune old Google Drive backups (rclone exited ${pruneResult.status}). ` +
          'Not treating this as a backup failure — will retry next run.'
      );
    }
  }
}

/**
 * Tries each off-site provider that's actually configured — B2, Google
 * Drive, both, or (if neither is set up) neither, in which case this is a
 * clean no-op with a warning, not an error. See the file header comment.
 */
function backupOffsite(dumpFilePath) {
  const b2Configured = !!(process.env.B2_BUCKET && process.env.B2_APPLICATION_KEY_ID && process.env.B2_APPLICATION_KEY);
  const gdriveConfigured = !!process.env.GDRIVE_RCLONE_TOKEN;

  if (!b2Configured && !gdriveConfigured) {
    console.warn(
      'Off-site backup skipped: no provider configured — set either the B2_* vars or ' +
        'GDRIVE_RCLONE_TOKEN in .env (plus BACKUP_ENCRYPTION_PASSPHRASE either way). Local ' +
        'backup above is unaffected — see CLAUDE.md "Database Backups" to set one up.'
    );
    return;
  }

  const passphrase = process.env.BACKUP_ENCRYPTION_PASSPHRASE;
  if (!passphrase) {
    console.error(
      'OFF-SITE BACKUP FAILED: a provider is configured but BACKUP_ENCRYPTION_PASSPHRASE is not set in .env.'
    );
    return;
  }

  const encryptedPath = `${dumpFilePath}.enc`;
  try {
    encryptFile(dumpFilePath, encryptedPath, passphrase);
  } catch (err) {
    console.error('OFF-SITE BACKUP FAILED: could not encrypt the dump file.', err.message);
    return;
  }

  if (b2Configured) backupToB2(encryptedPath);
  if (gdriveConfigured) backupToGoogleDrive(encryptedPath);

  // The encrypted file was only ever a staging copy for whichever
  // provider(s) were just attempted — the real local backup is the
  // unencrypted .dump (covered by pruneOldBackups below). Deleted
  // regardless of per-provider success/failure: if something failed, the
  // fix is to look at the log above and correct the underlying issue, not
  // to hoard a stale .enc file — a retry re-encrypts from the .dump for
  // free, and keeping it around would reintroduce the orphaned-file
  // accumulation this script already had to be fixed for once.
  fs.unlinkSync(encryptedPath);
}

function main() {
  // DIRECT_URL, not DATABASE_URL — a one-shot dump shouldn't compete with the
  // pooled app connection_limit, and pg_dump needs a direct connection anyway.
  const connectionUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!connectionUrl) {
    console.error('FATAL: Neither DIRECT_URL nor DATABASE_URL is set in .env');
    process.exit(1);
  }

  const { host, port, user, password, database } = parseConnectionString(connectionUrl);

  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outFile = path.join(BACKUP_DIR, `ssmc_emr_${timestamp}.dump`);

  console.log(`Backing up database "${database}" from ${host}:${port} to ${outFile}...`);

  const result = spawnSync(
    'pg_dump',
    ['-h', host, '-p', port, '-U', user, '-d', database, '-F', 'c', '-f', outFile],
    {
      env: { ...process.env, PGPASSWORD: password },
      stdio: 'inherit',
    }
  );

  if (result.error) {
    console.error(
      'FATAL: Failed to run pg_dump. Is the PostgreSQL "bin" directory on PATH?',
      result.error.message
    );
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error(`FATAL: pg_dump exited with code ${result.status}`);
    process.exit(1);
  }

  const stats = fs.statSync(outFile);
  if (stats.size === 0) {
    console.error('FATAL: Backup file is empty — treating as a failed backup.');
    fs.unlinkSync(outFile);
    process.exit(1);
  }

  console.log(`Backup complete: ${outFile} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);

  backupOffsite(outFile);

  pruneOldBackups();
}

main();
