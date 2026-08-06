/**
 * Decrypts a backup file produced by backup-database.js's off-site step
 * (AES-256-GCM, see lib/backup-crypto.js for the on-disk format) — the
 * counterpart used when restoring from the Backblaze B2 copy rather than a
 * local .dump. See CLAUDE.md "Database Backups" for the full restore
 * procedure this fits into.
 *
 * Usage: node scripts/decrypt-backup.js <input.dump.enc> [output.dump]
 * (output defaults to the input path with ".enc" stripped)
 */
require('dotenv').config();
const path = require('path');
const { decryptFile } = require('./lib/backup-crypto');

function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error('Usage: node scripts/decrypt-backup.js <input.dump.enc> [output.dump]');
    process.exit(1);
  }

  const outputPath = process.argv[3] || inputPath.replace(/\.enc$/, '');
  if (outputPath === inputPath) {
    console.error('FATAL: input and output paths resolve to the same file — pass an explicit output path.');
    process.exit(1);
  }

  const passphrase = process.env.BACKUP_ENCRYPTION_PASSPHRASE;
  if (!passphrase) {
    console.error('FATAL: BACKUP_ENCRYPTION_PASSPHRASE is not set in .env — cannot decrypt.');
    process.exit(1);
  }

  console.log(`Decrypting ${inputPath} -> ${outputPath}...`);

  try {
    decryptFile(path.resolve(inputPath), path.resolve(outputPath), passphrase);
  } catch (err) {
    console.error(
      'FATAL: Decryption failed — this usually means BACKUP_ENCRYPTION_PASSPHRASE is wrong, ' +
        'or the file is corrupted/was tampered with (AES-GCM auth tag mismatch).',
      err.message
    );
    process.exit(1);
  }

  console.log(`Decrypted successfully: ${outputPath}`);
  console.log('Next: pg_restore --list ' + outputPath + '  (sanity check before restoring)');
}

main();
