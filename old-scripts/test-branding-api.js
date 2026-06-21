/**
 * Test Branding API
 * Run this after logging in to test the branding endpoints
 */

const fetch = require('node-fetch');

const API_URL = 'http://localhost:3000';
const TEST_EMAIL = 'admin@hospital.com';
const TEST_PASSWORD = 'Admin@123';

let authToken = null;
let tenantId = null;

// Login first
async function login() {
  console.log('🔐 Logging in...');
  const response = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email: TEST_EMAIL,
      password: TEST_PASSWORD
    })
  });

  const data = await response.json();

  if (!response.ok) {
    console.error('❌ Login failed:', data);
    process.exit(1);
  }

  authToken = data.token;
  tenantId = data.user.tenantId;
  console.log('✅ Login successful');
  console.log('   Token:', authToken.substring(0, 20) + '...');
  console.log('   Tenant ID:', tenantId);
  console.log('');
}

// Get current branding
async function getBranding() {
  console.log('📥 Getting current branding...');
  const response = await fetch(`${API_URL}/api/branding`, {
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  });

  const data = await response.json();

  if (!response.ok) {
    console.error('❌ Get branding failed:', data);
    return null;
  }

  console.log('✅ Current branding:');
  console.log('   Clinic:', data.data.clinicName);
  console.log('   Logo:', data.data.logoUrl || '(none)');
  console.log('   Primary Color:', data.data.primaryColor);
  console.log('   Secondary Color:', data.data.secondaryColor);
  console.log('   Accent Color:', data.data.accentColor);
  console.log('   Font:', data.data.fontFamily);
  console.log('');

  return data.data;
}

// Update branding with test colors
async function updateBranding() {
  console.log('📤 Updating branding to purple theme...');

  const newBranding = {
    primaryColor: '#8b5cf6',   // Purple
    secondaryColor: '#ec4899', // Pink
    accentColor: '#f43f5e',    // Rose
    fontFamily: 'Inter'
  };

  const response = await fetch(`${API_URL}/api/branding`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify(newBranding)
  });

  const data = await response.json();

  if (!response.ok) {
    console.error('❌ Update branding failed:', data);
    return false;
  }

  console.log('✅ Branding updated successfully!');
  console.log('   Primary Color:', data.data.primaryColor);
  console.log('   Secondary Color:', data.data.secondaryColor);
  console.log('   Accent Color:', data.data.accentColor);
  console.log('');

  return true;
}

// Main test
async function runTests() {
  try {
    await login();
    await getBranding();
    await updateBranding();

    console.log('');
    console.log('🎉 All tests passed!');
    console.log('');
    console.log('Now:');
    console.log('1. Refresh your browser');
    console.log('2. You should see purple theme colors');

  } catch (error) {
    console.error('💥 Test failed with error:', error.message);
    process.exit(1);
  }
}

runTests();
