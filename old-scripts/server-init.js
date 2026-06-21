/**
 * Server Initialization Script
 * Runs on first launch of the SERVER installation
 * - Initializes PostgreSQL data directory
 * - Starts PostgreSQL server
 * - Creates database
 * - Runs Prisma migrations
 * - Creates initial tenant and admin user
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Determine if running in packaged Electron app or development
const isPackaged = process.env.NODE_ENV === 'production';
const APP_ROOT = isPackaged
  ? path.join(process.resourcesPath, 'app')
  : __dirname;

const POSTGRES_DIR = path.join(APP_ROOT, 'postgresql', 'pgsql');
const DATA_DIR = path.join(APP_ROOT, 'data', 'postgres');
const BIN_DIR = path.join(POSTGRES_DIR, 'bin');
const LOG_FILE = path.join(APP_ROOT, 'data', 'postgres.log');

// Database configuration
const DB_USER = 'ssmc_user';
const DB_PASSWORD = 'ssmc_password';
const DB_NAME = 'ssmc_emr';
const DB_PORT = 5432;

console.log('='.repeat(60));
console.log('SSMC EMR - Server Initialization');
console.log('='.repeat(60));
console.log('');

// Create data directory if it doesn't exist
if (!fs.existsSync(path.join(APP_ROOT, 'data'))) {
  fs.mkdirSync(path.join(APP_ROOT, 'data'), { recursive: true });
}

/**
 * Initialize PostgreSQL data directory
 */
function initPostgres() {
  console.log('[1/6] Initializing PostgreSQL data directory...');

  if (fs.existsSync(DATA_DIR)) {
    console.log('      Data directory already exists - skipping initialization');
    return;
  }

  try {
    const initdbPath = path.join(BIN_DIR, 'initdb.exe');
    execSync(`"${initdbPath}" -D "${DATA_DIR}" -U postgres -E UTF8 --no-locale`, {
      stdio: 'inherit'
    });
    console.log('      PostgreSQL initialized successfully!');
  } catch (error) {
    console.error('      Error initializing PostgreSQL:', error.message);
    process.exit(1);
  }
}

/**
 * Start PostgreSQL server
 */
function startPostgres() {
  console.log('[2/6] Starting PostgreSQL server...');

  try {
    const pgCtlPath = path.join(BIN_DIR, 'pg_ctl.exe');
    execSync(`"${pgCtlPath}" -D "${DATA_DIR}" -l "${LOG_FILE}" -o "-p ${DB_PORT}" start`, {
      stdio: 'inherit'
    });

    // Wait for server to start
    console.log('      Waiting for PostgreSQL to start...');
    execSync('timeout /t 3 /nobreak', { stdio: 'inherit' });

    console.log('      PostgreSQL server started successfully!');
  } catch (error) {
    console.error('      Error starting PostgreSQL:', error.message);
    process.exit(1);
  }
}

/**
 * Create database user and database
 */
function createDatabase() {
  console.log('[3/6] Creating database and user...');

  try {
    const psqlPath = path.join(BIN_DIR, 'psql.exe');

    // Create user
    console.log('      Creating database user...');
    execSync(`"${psqlPath}" -U postgres -p ${DB_PORT} -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';"`, {
      stdio: 'inherit'
    });

    // Create database
    console.log('      Creating database...');
    execSync(`"${psqlPath}" -U postgres -p ${DB_PORT} -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"`, {
      stdio: 'inherit'
    });

    // Grant privileges
    execSync(`"${psqlPath}" -U postgres -p ${DB_PORT} -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};"`, {
      stdio: 'inherit'
    });

    console.log('      Database created successfully!');
  } catch (error) {
    // Ignore errors if user/database already exists
    console.log('      Database may already exist - continuing...');
  }
}

/**
 * Run Prisma migrations
 */
function runMigrations() {
  console.log('[4/6] Setting up database schema...');

  try {
    // Set environment variables for Prisma
    process.env.DATABASE_URL = `postgresql://${DB_USER}:${DB_PASSWORD}@localhost:${DB_PORT}/${DB_NAME}`;
    process.env.DIRECT_URL = process.env.DATABASE_URL;

    // Run Prisma db push to create all tables
    execSync('npx prisma db push --skip-generate --accept-data-loss', {
      cwd: APP_ROOT,
      stdio: 'inherit'
    });

    console.log('      Database schema created successfully!');
  } catch (error) {
    console.error('      Error creating schema:', error.message);
    process.exit(1);
  }
}

/**
 * Create initial tenant and admin user
 */
async function createInitialData() {
  console.log('[5/6] Creating initial tenant and admin user...');

  const { PrismaClient } = require('@prisma/client');
  const bcrypt = require('bcryptjs');

  const prisma = new PrismaClient({
    datasourceUrl: `postgresql://${DB_USER}:${DB_PASSWORD}@localhost:${DB_PORT}/${DB_NAME}`
  });

  try {
    // Check if tenant already exists
    const existingTenant = await prisma.tenant.findFirst();
    if (existingTenant) {
      console.log('      Tenant already exists - skipping...');
      await prisma.$disconnect();
      return;
    }

    // Get clinic information from user
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const clinicName = await new Promise((resolve) => {
      rl.question('      Enter clinic name (default: SSMC Clinic): ', (answer) => {
        resolve(answer.trim() || 'SSMC Clinic');
      });
    });

    const adminEmail = await new Promise((resolve) => {
      rl.question('      Enter admin email (default: admin@ssmc.com): ', (answer) => {
        resolve(answer.trim() || 'admin@ssmc.com');
      });
    });

    const adminPassword = await new Promise((resolve) => {
      rl.question('      Enter admin password (default: admin123): ', (answer) => {
        resolve(answer.trim() || 'admin123');
      });
    });

    rl.close();

    // Create tenant
    const tenant = await prisma.tenant.create({
      data: {
        id: 'clinic-001',
        name: clinicName,
        slug: 'clinic-001',
        clinicName: clinicName,
        status: 'ACTIVE',
        subscriptionTier: 'PREMIUM'
      }
    });

    // Hash password
    const hashedPassword = await bcrypt.hash(adminPassword, 12);

    // Create admin user
    const admin = await prisma.user.create({
      data: {
        email: adminEmail,
        password: hashedPassword,
        firstName: 'System',
        lastName: 'Administrator',
        role: 'ADMIN',
        status: 'ACTIVE',
        tenantId: tenant.id
      }
    });

    console.log('');
    console.log('      ✓ Tenant created successfully!');
    console.log('      ✓ Admin user created successfully!');
    console.log('');
    console.log('      LOGIN CREDENTIALS:');
    console.log('      ==================');
    console.log(`      Email   : ${admin.email}`);
    console.log(`      Password: ${adminPassword}`);
    console.log(`      Tenant  : ${tenant.id}`);
    console.log('');

    await prisma.$disconnect();
  } catch (error) {
    console.error('      Error creating initial data:', error.message);
    await prisma.$disconnect();
    process.exit(1);
  }
}

/**
 * Display server information
 */
function displayServerInfo() {
  console.log('[6/6] Server setup complete!');
  console.log('');
  console.log('='.repeat(60));
  console.log('SERVER INFORMATION');
  console.log('='.repeat(60));

  // Get local IP address
  const os = require('os');
  const interfaces = os.networkInterfaces();
  let localIP = '127.0.0.1';

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        localIP = iface.address;
        break;
      }
    }
  }

  console.log('');
  console.log(`Database Server: ${localIP}:${DB_PORT}`);
  console.log(`Database Name  : ${DB_NAME}`);
  console.log('');
  console.log('CLIENT CONFIGURATION:');
  console.log('---------------------');
  console.log('Install the SSMC EMR Client on other computers and configure:');
  console.log('');
  console.log(`  Server IP  : ${localIP}`);
  console.log(`  Port       : ${DB_PORT}`);
  console.log(`  Database   : ${DB_NAME}`);
  console.log(`  Username   : ${DB_USER}`);
  console.log(`  Password   : ${DB_PASSWORD}`);
  console.log('');
  console.log('='.repeat(60));
  console.log('');
  console.log('Press ENTER to start the application...');
}

/**
 * Main initialization sequence
 */
async function main() {
  try {
    initPostgres();
    startPostgres();
    createDatabase();
    runMigrations();
    await createInitialData();
    displayServerInfo();

    // Wait for user input before continuing
    process.stdin.once('data', () => {
      console.log('Starting SSMC EMR Server...');
      process.exit(0);
    });
  } catch (error) {
    console.error('Initialization failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { main };
