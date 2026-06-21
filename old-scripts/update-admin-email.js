/**
 * Update Admin Email
 * Changes the admin user's email address
 */

const { Client } = require('pg');
const readline = require('readline');
require('dotenv').config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function updateAdminEmail() {
  const client = new Client({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  });

  try {
    console.log('\n📧 Update Admin Email\n');

    const newEmail = await question('Enter new email address: ');

    if (!newEmail || !newEmail.includes('@')) {
      console.log('❌ Invalid email address');
      process.exit(1);
    }

    await client.connect();

    // Get current admin
    const currentResult = await client.query(`
      SELECT id, email, "tenantId"
      FROM users
      WHERE email = 'admin@hospital.com'
      LIMIT 1;
    `);

    if (currentResult.rows.length === 0) {
      console.log('❌ Admin user not found');
      process.exit(1);
    }

    const admin = currentResult.rows[0];
    console.log(`\nCurrent email: ${admin.email}`);

    // Update email
    await client.query(`
      UPDATE users
      SET email = $1
      WHERE id = $2;
    `, [newEmail, admin.id]);

    console.log(`✅ Email updated to: ${newEmail}\n`);
    console.log('='.repeat(60));
    console.log('📋 NEW LOGIN CREDENTIALS:\n');
    console.log(`   🏥 Tenant ID:  ${admin.tenantId}`);
    console.log(`   📧 Email:      ${newEmail}`);
    console.log(`   🔑 Password:   Admin@123`);
    console.log('\n💡 Use these credentials to login at http://localhost:5173\n');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    throw error;
  } finally {
    await client.end();
    rl.close();
  }
}

updateAdminEmail()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
