/**
 * Add Medications and Services to Catalog
 */

const { Client } = require('pg');
require('dotenv').config();

async function addMedicationsAndServices() {
  const client = new Client({ connectionString: process.env.DIRECT_URL });

  try {
    await client.connect();

    // Get tenant
    const tenantResult = await client.query('SELECT id FROM tenants LIMIT 1');
    const tenantId = tenantResult.rows[0].id;

    console.log('\n💊 Adding Medications...\n');

    const medications = [
      { name: 'Paracetamol 500mg', generic: 'Paracetamol', form: 'Tablet', strength: '500mg', price: 50 },
      { name: 'Amoxicillin 250mg', generic: 'Amoxicillin', form: 'Capsule', strength: '250mg', price: 150 },
      { name: 'Ibuprofen 400mg', generic: 'Ibuprofen', form: 'Tablet', strength: '400mg', price: 100 },
      { name: 'Omeprazole 20mg', generic: 'Omeprazole', form: 'Capsule', strength: '20mg', price: 200 },
      { name: 'Cough Syrup', generic: 'Dextromethorphan', form: 'Syrup', strength: '100ml', price: 500 }
    ];

    for (const med of medications) {
      await client.query(`
        INSERT INTO medications (
          id, "tenantId", name, "genericName", "dosageForm", strength,
          "unitPrice", "reorderPoint", "stockLevel", status, "createdAt", "updatedAt"
        )
        VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5, $6, 20, 100, 'AVAILABLE', NOW(), NOW()
        )
        ON CONFLICT DO NOTHING
      `, [tenantId, med.name, med.generic, med.form, med.strength, med.price]);

      console.log(`  ✅ ${med.name} - ₦${med.price}`);
    }

    console.log('\n🧪 Adding Lab Tests to Service Catalog...\n');

    const labTests = [
      { name: 'Complete Blood Count (CBC)', code: 'LAB-001', price: 3000 },
      { name: 'Malaria Test', code: 'LAB-002', price: 1500 },
      { name: 'Blood Sugar (Fasting)', code: 'LAB-003', price: 1000 },
      { name: 'Urinalysis', code: 'LAB-004', price: 1500 },
      { name: 'Pregnancy Test', code: 'LAB-005', price: 1000 }
    ];

    for (const test of labTests) {
      await client.query(`
        INSERT INTO service_catalog (
          id, "tenantId", "serviceName", "serviceCode", category,
          "basePrice", "isActive", "createdAt", "updatedAt"
        )
        VALUES (
          gen_random_uuid(), $1, $2, $3, 'LAB_TEST', $4, true, NOW(), NOW()
        )
        ON CONFLICT DO NOTHING
      `, [tenantId, test.name, test.code, test.price]);

      console.log(`  ✅ ${test.code} - ${test.name} - ₦${test.price}`);
    }

    // Add consultation service
    await client.query(`
      INSERT INTO service_catalog (
        id, "tenantId", "serviceName", "serviceCode", category,
        "basePrice", "isActive", "createdAt", "updatedAt"
      )
      VALUES (
        gen_random_uuid(), $1, 'Doctor Consultation', 'CON-001', 'CONSULTATION', 5000, true, NOW(), NOW()
      )
      ON CONFLICT DO NOTHING
    `, [tenantId]);
    console.log(`  ✅ CON-001 - Doctor Consultation - ₦5000`);

    console.log('\n✅ Done!\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

addMedicationsAndServices();
