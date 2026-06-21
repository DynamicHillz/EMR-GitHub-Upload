const { Client } = require('pg');
require('dotenv').config();

async function upgradeToSuperAdmin() {
  const client = new Client({ connectionString: process.env.DIRECT_URL });

  try {
    await client.connect();

    // Upgrade admin@hospital.com to SUPER_ADMIN
    const result = await client.query(`
      UPDATE users
      SET role = 'SUPER_ADMIN', "updatedAt" = NOW()
      WHERE email = 'admin@hospital.com'
      RETURNING id, email, role, "firstName", "lastName";
    `);

    if (result.rows.length > 0) {
      const user = result.rows[0];
      console.log('\n✅ User upgraded successfully!\n');
      console.log('='.repeat(60));
      console.log('\n📋 SUPER ADMIN CREDENTIALS:\n');
      console.log(`   👤 Name:       ${user.firstName} ${user.lastName}`);
      console.log(`   📧 Email:      ${user.email}`);
      console.log(`   🔑 Password:   Admin@123`);
      console.log(`   👑 Role:       ${user.role}\n`);
      console.log('🌐 Login at: http://localhost:5173\n');
      console.log('✨ You can now configure payment gateway API keys!\n');
      console.log('='.repeat(60));
    } else {
      console.log('❌ User not found. Please ensure admin@hospital.com exists.');
    }

  } catch (error) {
    console.error('❌ Error upgrading user:', error.message);
  } finally {
    await client.end();
  }
}

upgradeToSuperAdmin()
  .then(() => process.exit(0))
  .catch(e => {
    console.error(e.message);
    process.exit(1);
  });
