/**
 * PostgreSQL Portable Setup Script
 * Downloads and configures PostgreSQL for bundling with the Electron app
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const POSTGRES_VERSION = '16.2';
const DOWNLOAD_URL = `https://get.enterprisedb.com/postgresql/postgresql-${POSTGRES_VERSION}-1-windows-x64-binaries.zip`;
const POSTGRES_DIR = path.join(__dirname, 'postgresql');
const ZIP_FILE = path.join(__dirname, 'postgresql.zip');

console.log('[PostgreSQL Setup] Starting PostgreSQL portable setup...');

// Create postgresql directory if it doesn't exist
if (!fs.existsSync(POSTGRES_DIR)) {
  fs.mkdirSync(POSTGRES_DIR, { recursive: true });
}

// Download PostgreSQL binaries
console.log('[PostgreSQL Setup] Downloading PostgreSQL binaries...');
console.log('[PostgreSQL Setup] This may take a few minutes (file size: ~200MB)');

const file = fs.createWriteStream(ZIP_FILE);

https.get(DOWNLOAD_URL, (response) => {
  const totalSize = parseInt(response.headers['content-length'], 10);
  let downloadedSize = 0;

  response.on('data', (chunk) => {
    downloadedSize += chunk.length;
    const progress = ((downloadedSize / totalSize) * 100).toFixed(1);
    process.stdout.write(`\r[PostgreSQL Setup] Downloaded: ${progress}%`);
  });

  response.pipe(file);

  file.on('finish', () => {
    file.close();
    console.log('\n[PostgreSQL Setup] Download complete!');
    console.log('[PostgreSQL Setup] Extracting files...');

    try {
      // Extract using PowerShell (built into Windows)
      execSync(`powershell -command "Expand-Archive -Path '${ZIP_FILE}' -DestinationPath '${POSTGRES_DIR}' -Force"`, {
        stdio: 'inherit'
      });

      console.log('[PostgreSQL Setup] Extraction complete!');
      console.log('[PostgreSQL Setup] Cleaning up...');

      // Delete zip file
      fs.unlinkSync(ZIP_FILE);

      console.log('[PostgreSQL Setup] PostgreSQL portable setup complete!');
      console.log('[PostgreSQL Setup] Location:', POSTGRES_DIR);
    } catch (error) {
      console.error('[PostgreSQL Setup] Error extracting files:', error.message);
      process.exit(1);
    }
  });
}).on('error', (error) => {
  fs.unlinkSync(ZIP_FILE);
  console.error('[PostgreSQL Setup] Error downloading PostgreSQL:', error.message);
  process.exit(1);
});
