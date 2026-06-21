const { Client } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function createAdmin() {
  const client = new Client({ connectionString: process.env.DIRECT_URL });

  try {
    await client.connect();

    // Create tenant
    const tResult = await client.query(`
      INSERT INTO tenants (id, name, slug, "clinicName", status, "subscriptionTier", "subscriptionStart", "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), 'St. Stephen Hospital', 'st-stephen-hospital', 'St. Stephen Medical Center', 'ACTIVE', 'BASIC', NOW(), NOW(), NOW())
      ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name RETURNING id, name;
    `);

    const tenant = tResult.rows[0];
    console.log(`\n✅ Tenant: ${tenant.name}`);
    console.log(`   ID: ${tenant.id}\n`);

    // Create admin
    const pwd = await bcrypt.hash('Admin@123', 12);
    await client.query(`
      INSERT INTO users (id, "tenantId", email, password, "firstName", "lastName", phone, role, status, "failedLoginAttempts", "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), $1, 'admin@hospital.com', $2, 'System', 'Administrator', '+1234567890', 'ADMIN', 'ACTIVE', 0, NOW(), NOW())
      ON CONFLICT ("tenantId", email) DO UPDATE SET password = EXCLUDED.password;
    `, [tenant.id, pwd]);

    console.log('✅ Admin user created!\n');
    console.log('='.repeat(60));
    console.log('\n📋 LOGIN CREDENTIALS:\n');
    console.log(`   🏥 Tenant ID:  ${tenant.id}`);
    console.log(`   📧 Email:      admin@hospital.com`);
    console.log(`   🔑 Password:   Admin@123\n`);
    console.log('🌐 Login at: http://localhost:5173\n');
    console.log('='.repeat(60));

  } finally {
    await client.end();
  }
}

createAdmin().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
