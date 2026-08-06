/**
 * Backup file encryption — shared between backup-database.js (encrypt) and
 * decrypt-backup.js (decrypt), so the on-disk format is only defined once.
 *
 * AES-256-GCM (authenticated — decryption fails loudly on any tampering or
 * corruption, unlike plain CBC) with a key derived from a passphrase via
 * scrypt. File layout: [16-byte salt][12-byte IV][16-byte auth tag][ciphertext].
 */
const crypto = require('crypto');
const fs = require('fs');

const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32; // AES-256

function deriveKey(passphrase, salt) {
  return crypto.scryptSync(passphrase, salt, KEY_LENGTH);
}

function encryptFile(inputPath, outputPath, passphrase) {
  const plaintext = fs.readFileSync(inputPath);
  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = deriveKey(passphrase, salt);

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();

  fs.writeFileSync(outputPath, Buffer.concat([salt, iv, authTag, ciphertext]));
}

function decryptFile(inputPath, outputPath, passphrase) {
  const data = fs.readFileSync(inputPath);

  const salt = data.subarray(0, SALT_LENGTH);
  const iv = data.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const authTag = data.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = data.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);
  const key = deriveKey(passphrase, salt);

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  // Throws (GCM tag mismatch) if the passphrase is wrong or the file was
  // corrupted/tampered with — never silently returns garbage plaintext.
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

  fs.writeFileSync(outputPath, plaintext);
}

module.exports = { encryptFile, decryptFile };
