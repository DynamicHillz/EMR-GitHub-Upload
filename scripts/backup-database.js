/**
 * Backs up the local PostgreSQL database via pg_dump (custom format, compressed).
 *
 * Manual run:   node scripts/backup-database.js
 * Scheduled:    registered as a daily Windows Task Scheduler job — see CLAUDE.md
 *               "Database Backups" section for setup + restore instructions.
 *
 * Writes timestamped .dump files to backups/ (gitignored) and prunes anything
 * older than RETENTION_DAYS on every run.
 */
require('dotenv').config();
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const RETENTION_DAYS = 14;
const BACKUP_DIR = path.join(__dirname, '..', 'backups');

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
  const files = fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => f.startsWith('ssmc_emr_') && f.endsWith('.dump'));

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

  pruneOldBackups();
}

main();
