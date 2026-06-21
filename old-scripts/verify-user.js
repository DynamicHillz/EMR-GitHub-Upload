/**
 * Verify the user we just created
 */

const { Client } = require('pg');
require('dotenv').config();

async function verifyUser() {
  const client = new Client({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  });

  try {
    await client.connect();

    const result = await client.query(`
      SELECT *
      FROM "User"
      WHERE email = 'admin@hospital.com'
      LIMIT 1;
    `);

    if (result.rows.length > 0) {
      console.log('User found:');
      console.log(JSON.stringify(result.rows[0], null, 2));
    } else {
      console.log('No user found with email admin@hospital.com');
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

verifyUser();
