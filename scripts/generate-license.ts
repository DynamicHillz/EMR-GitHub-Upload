/**
 * License Generator — VENDOR-SIDE TOOL, not part of the deployed app.
 *
 * Signs a license token (RS256 JWT) for a clinic install, using the private
 * key half of the keypair whose public half is committed at
 * config/license-public-key.pem. Run this locally, on the vendor's own
 * machine, never on a clinic's server — see LICENSING.md.
 *
 * Usage:
 *   npx ts-node scripts/generate-license.ts --clinic "St. Stephen Medical Centre" --expires 2027-08-01 [--key ./license-private-key.pem] [--issued 2026-08-01]
 */

import fs from 'fs';
import jwt from 'jsonwebtoken';

function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i];
    if (!flag?.startsWith('--')) continue;
    args[flag.slice(2)] = argv[i + 1];
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  const clinicName = args.clinic;
  const maintenanceExpiresAt = args.expires;
  const keyPath = args.key || 'license-private-key.pem';
  const licenseIssuedAt = args.issued || new Date().toISOString().split('T')[0];

  if (!clinicName || !maintenanceExpiresAt) {
    console.error('Usage: npx ts-node scripts/generate-license.ts --clinic "Clinic Name" --expires YYYY-MM-DD [--key path/to/private-key.pem] [--issued YYYY-MM-DD]');
    process.exit(1);
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(maintenanceExpiresAt) || !/^\d{4}-\d{2}-\d{2}$/.test(licenseIssuedAt)) {
    console.error('Dates must be in YYYY-MM-DD format.');
    process.exit(1);
  }

  if (!fs.existsSync(keyPath)) {
    console.error(
      `Private key not found at "${keyPath}". Generate one once with:\n` +
      `  openssl genrsa -out license-private-key.pem 2048\n` +
      `  openssl rsa -in license-private-key.pem -pubout -out config/license-public-key.pem\n` +
      `Keep the private key OFFLINE — never commit it, never copy it to a clinic's server.`
    );
    process.exit(1);
  }

  const privateKey = fs.readFileSync(keyPath, 'utf8');

  const token = jwt.sign(
    { clinicName, licenseIssuedAt, maintenanceExpiresAt },
    privateKey,
    { algorithm: 'RS256' }
  );

  console.log(`\nLicense token for "${clinicName}" (maintenance valid until ${maintenanceExpiresAt}):\n`);
  console.log(token);
  console.log('\nPaste this into Settings > License on that clinic\'s installation.\n');
}

main();
