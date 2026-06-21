-- ============================================================
-- St. Stephen EMR - Initial Setup for Supabase
-- ============================================================
-- Run this SQL in your Supabase SQL Editor
-- This will create a tenant and admin user for first login
-- ============================================================

-- Step 1: Create tenant
DO $$
DECLARE
  v_tenant_id UUID;
BEGIN
  -- Check if tenant exists
  SELECT id INTO v_tenant_id
  FROM "Tenant"
  WHERE slug = 'st-stephen-hospital';

  -- Create tenant if it doesn't exist
  IF v_tenant_id IS NULL THEN
    INSERT INTO "Tenant" (id, name, slug, status, settings, "createdAt", "updatedAt")
    VALUES (
      gen_random_uuid(),
      'St. Stephen Hospital',
      'st-stephen-hospital',
      'ACTIVE',
      '{"timezone":"UTC","currency":"USD"}',
      NOW(),
      NOW()
    )
    RETURNING id INTO v_tenant_id;

    RAISE NOTICE '✅ Tenant created with ID: %', v_tenant_id;
  ELSE
    RAISE NOTICE '✅ Tenant already exists with ID: %', v_tenant_id;
  END IF;

  -- Step 2: Create admin user
  INSERT INTO "User" (
    id,
    "tenantId",
    email,
    password,
    "firstName",
    "lastName",
    phone,
    role,
    status,
    "failedLoginAttempts",
    "createdAt",
    "updatedAt"
  )
  VALUES (
    gen_random_uuid(),
    v_tenant_id,
    'admin@hospital.com',
    '$2a$12$LqGJxe7QE1/KO8aJ5ZxJ0OP1YvJ6Z3WqHHZwCdBU9L5vN1yH3Ks5K', -- Password: Admin@123
    'System',
    'Administrator',
    '+1234567890',
    'ADMIN',
    'ACTIVE',
    0,
    NOW(),
    NOW()
  )
  ON CONFLICT ("tenantId", email) DO NOTHING;

  -- Display the results
  RAISE NOTICE '';
  RAISE NOTICE '============================================================';
  RAISE NOTICE '✨ SETUP COMPLETE! ✨';
  RAISE NOTICE '============================================================';
  RAISE NOTICE '';
  RAISE NOTICE '📋 LOGIN CREDENTIALS:';
  RAISE NOTICE '';
  RAISE NOTICE '   🏥 Tenant ID:  %', v_tenant_id;
  RAISE NOTICE '   📧 Email:      admin@hospital.com';
  RAISE NOTICE '   🔑 Password:   Admin@123';
  RAISE NOTICE '';
  RAISE NOTICE '💡 IMPORTANT: Copy the Tenant ID above!';
  RAISE NOTICE '';
  RAISE NOTICE '🌐 Login at: http://localhost:5173';
  RAISE NOTICE '';
  RAISE NOTICE '============================================================';

END $$;

-- Query to verify and show the tenant ID
SELECT
  id as "Tenant ID",
  name as "Tenant Name",
  slug as "Tenant Slug"
FROM "Tenant"
WHERE slug = 'st-stephen-hospital';

-- Query to verify admin user exists
SELECT
  id as "User ID",
  email as "Email",
  "firstName" as "First Name",
  "lastName" as "Last Name",
  role as "Role"
FROM "User"
WHERE email = 'admin@hospital.com';
