/**
 * Seed Sample Data Script
 * Adds sample patients, appointments, and other test data
 */

const { Client } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function seedSampleData() {
  const client = new Client({ connectionString: process.env.DIRECT_URL });

  try {
    console.log('🔌 Connecting to database...\n');
    await client.connect();
    console.log('✅ Connected successfully!\n');

    // Get tenant
    const tenantResult = await client.query('SELECT id, name FROM tenants LIMIT 1');
    if (tenantResult.rows.length === 0) {
      console.log('❌ No tenant found. Please run final-create-admin.js first.');
      process.exit(1);
    }

    const tenantId = tenantResult.rows[0].id;
    console.log(`📋 Using tenant: ${tenantResult.rows[0].name} (${tenantId})\n`);

    // Check if data already exists
    const patientCount = await client.query('SELECT COUNT(*) FROM patients WHERE "tenantId" = $1', [tenantId]);
    if (parseInt(patientCount.rows[0].count) > 0) {
      console.log(`⚠️  Database already has ${patientCount.rows[0].count} patient(s).`);
      console.log('   Skipping seed to avoid duplicates.\n');
      return;
    }

    console.log('═══════════════════════════════════════════════');
    console.log('👥 CREATING SAMPLE USERS');
    console.log('═══════════════════════════════════════════════\n');

    const password = await bcrypt.hash('Password@123', 12);

    // Create Doctor
    const doctorResult = await client.query(`
      INSERT INTO users (id, "tenantId", email, password, "firstName", "lastName", phone, role, status, "failedLoginAttempts", "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), $1, 'doctor@hospital.com', $2, 'Dr. John', 'Smith', '+2348012345001', 'DOCTOR', 'ACTIVE', 0, NOW(), NOW())
      RETURNING id, email, role
    `, [tenantId, password]);
    console.log(`  ✅ Created: ${doctorResult.rows[0].email} (${doctorResult.rows[0].role})`);
    const doctorId = doctorResult.rows[0].id;

    // Create Nurse
    const nurseResult = await client.query(`
      INSERT INTO users (id, "tenantId", email, password, "firstName", "lastName", phone, role, status, "failedLoginAttempts", "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), $1, 'nurse@hospital.com', $2, 'Mary', 'Johnson', '+2348012345002', 'NURSE', 'ACTIVE', 0, NOW(), NOW())
      RETURNING id, email, role
    `, [tenantId, password]);
    console.log(`  ✅ Created: ${nurseResult.rows[0].email} (${nurseResult.rows[0].role})`);

    // Create Lab Tech
    const labResult = await client.query(`
      INSERT INTO users (id, "tenantId", email, password, "firstName", "lastName", phone, role, status, "failedLoginAttempts", "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), $1, 'lab@hospital.com', $2, 'David', 'Lee', '+2348012345003', 'LAB_TECH', 'ACTIVE', 0, NOW(), NOW())
      RETURNING id, email, role
    `, [tenantId, password]);
    console.log(`  ✅ Created: ${labResult.rows[0].email} (${labResult.rows[0].role})`);

    // Create Cashier
    const cashierResult = await client.query(`
      INSERT INTO users (id, "tenantId", email, password, "firstName", "lastName", phone, role, status, "failedLoginAttempts", "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), $1, 'cashier@hospital.com', $2, 'Sarah', 'Williams', '+2348012345004', 'CASHIER', 'ACTIVE', 0, NOW(), NOW())
      RETURNING id, email, role
    `, [tenantId, password]);
    console.log(`  ✅ Created: ${cashierResult.rows[0].email} (${cashierResult.rows[0].role})`);
    const cashierId = cashierResult.rows[0].id;

    console.log('\n═══════════════════════════════════════════════');
    console.log('🏥 CREATING SAMPLE PATIENTS');
    console.log('═══════════════════════════════════════════════\n');

    const patients = [
      { firstName: 'James', lastName: 'Brown', dob: '1985-03-15', gender: 'MALE', phone: '+2348101234567', bloodGroup: 'O+', genotype: 'AA' },
      { firstName: 'Emily', lastName: 'Davis', dob: '1990-07-22', gender: 'FEMALE', phone: '+2348101234568', bloodGroup: 'A+', genotype: 'AS' },
      { firstName: 'Michael', lastName: 'Wilson', dob: '1978-11-30', gender: 'MALE', phone: '+2348101234569', bloodGroup: 'B+', genotype: 'AA' },
      { firstName: 'Sarah', lastName: 'Taylor', dob: '1995-05-18', gender: 'FEMALE', phone: '+2348101234570', bloodGroup: 'AB+', genotype: 'AA' },
      { firstName: 'Daniel', lastName: 'Anderson', dob: '1988-09-25', gender: 'MALE', phone: '+2348101234571', bloodGroup: 'O-', genotype: 'AS' }
    ];

    const patientIds = [];

    for (let i = 0; i < patients.length; i++) {
      const p = patients[i];
      const patientId = `PT${String(i + 1).padStart(6, '0')}`;

      const result = await client.query(`
        INSERT INTO patients (
          id, "tenantId", "patientId", "firstName", "lastName", "dateOfBirth",
          gender, phone, "bloodGroup", genotype, status, "createdAt", "updatedAt"
        )
        VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, 'ACTIVE', NOW(), NOW()
        )
        RETURNING id, "patientId", "firstName", "lastName"
      `, [tenantId, patientId, p.firstName, p.lastName, p.dob, p.gender, p.phone, p.bloodGroup, p.genotype]);

      patientIds.push(result.rows[0].id);
      console.log(`  ✅ Created: ${result.rows[0].patientId} - ${result.rows[0].firstName} ${result.rows[0].lastName}`);
    }

    console.log('\n═══════════════════════════════════════════════');
    console.log('📅 CREATING SAMPLE APPOINTMENTS');
    console.log('═══════════════════════════════════════════════\n');

    // Create appointments for the next few days
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const appointments = [
      { patientIdx: 0, date: new Date(tomorrow.getTime() + 0 * 86400000), time: '09:00', type: 'CONSULTATION', reason: 'Annual checkup' },
      { patientIdx: 1, date: new Date(tomorrow.getTime() + 0 * 86400000), time: '10:30', type: 'FOLLOW_UP', reason: 'Blood pressure monitoring' },
      { patientIdx: 2, date: new Date(tomorrow.getTime() + 1 * 86400000), time: '11:00', type: 'CONSULTATION', reason: 'Fever and headache' },
      { patientIdx: 3, date: new Date(tomorrow.getTime() + 1 * 86400000), time: '14:00', type: 'CONSULTATION', reason: 'Routine checkup' },
      { patientIdx: 4, date: new Date(tomorrow.getTime() + 2 * 86400000), time: '09:30', type: 'FOLLOW_UP', reason: 'Diabetes follow-up' }
    ];

    for (const apt of appointments) {
      await client.query(`
        INSERT INTO appointments (
          id, "tenantId", "patientId", "doctorId", "appointmentDate", "appointmentTime",
          duration, "appointmentType", status, reason, "createdAt", "updatedAt"
        )
        VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5, 30, $6, 'SCHEDULED', $7, NOW(), NOW()
        )
      `, [tenantId, patientIds[apt.patientIdx], doctorId, apt.date, apt.time, apt.type, apt.reason]);

      const dateStr = apt.date.toISOString().split('T')[0];
      console.log(`  ✅ ${dateStr} ${apt.time} - ${patients[apt.patientIdx].firstName} ${patients[apt.patientIdx].lastName}`);
    }

    console.log('\n═══════════════════════════════════════════════');
    console.log('💊 CREATING SAMPLE MEDICATIONS');
    console.log('═══════════════════════════════════════════════\n');

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
      `, [tenantId, med.name, med.generic, med.form, med.strength, med.price]);

      console.log(`  ✅ ${med.name} - ₦${med.price} per unit`);
    }

    console.log('\n═══════════════════════════════════════════════');
    console.log('🧪 CREATING SAMPLE LAB TESTS (Service Catalog)');
    console.log('═══════════════════════════════════════════════\n');

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
          "unitPrice", "isActive", "createdAt", "updatedAt"
        )
        VALUES (
          gen_random_uuid(), $1, $2, $3, 'LABORATORY', $4, true, NOW(), NOW()
        )
      `, [tenantId, test.name, test.code, test.price]);

      console.log(`  ✅ ${test.code} - ${test.name} - ₦${test.price}`);
    }

    // Add consultation service
    await client.query(`
      INSERT INTO service_catalog (
        id, "tenantId", "serviceName", "serviceCode", category,
        "unitPrice", "isActive", "createdAt", "updatedAt"
      )
      VALUES (
        gen_random_uuid(), $1, 'Doctor Consultation', 'CON-001', 'CONSULTATION', 5000, true, NOW(), NOW()
      )
    `, [tenantId]);
    console.log(`  ✅ CON-001 - Doctor Consultation - ₦5000`);

    console.log('\n═══════════════════════════════════════════════');
    console.log('📊 SEED DATA SUMMARY');
    console.log('═══════════════════════════════════════════════\n');

    console.log('✅ Created 4 sample users (Doctor, Nurse, Lab Tech, Cashier)');
    console.log('✅ Created 5 sample patients');
    console.log('✅ Created 5 sample appointments');
    console.log('✅ Created 5 sample medications');
    console.log('✅ Created 6 services in catalog (5 lab tests + 1 consultation)');

    console.log('\n📋 LOGIN CREDENTIALS FOR TEST USERS:\n');
    console.log('   All test users have the same password: Password@123\n');
    console.log('   🩺 Doctor:   doctor@hospital.com');
    console.log('   💉 Nurse:    nurse@hospital.com');
    console.log('   🧪 Lab Tech: lab@hospital.com');
    console.log('   💰 Cashier:  cashier@hospital.com');

    console.log('\n═══════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

seedSampleData()
  .then(() => {
    console.log('✅ Seed data created successfully!\n');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Seed failed:', error.message);
    process.exit(1);
  });
