-- Create Initial Data for St. Stephen EMR
-- Run this SQL to create a default tenant and admin user

-- Create default tenant if it doesn't exist
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
ON CONFLICT (slug) DO NOTHING
RETURNING id, name, slug;

-- Get the tenant ID (you'll need to use this for creating the user)
-- Copy the ID from the output above and use it in the next INSERT

-- Create admin user (REPLACE 'YOUR-TENANT-ID-HERE' with the actual tenant ID from above)
-- Password is 'Admin@123' hashed with bcrypt cost factor 12
INSERT INTO "User" (id, "tenantId", email, password, "firstName", "lastName", phone, role, status, "failedLoginAttempts", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  (SELECT id FROM "Tenant" WHERE slug = 'st-stephen-hospital'),
  'admin@hospital.com',
  '$2a$12$LqGJxe7QE1/KO8aJ5ZxJ0OP1YvJ6Z3WqHHZwCdBU9L5vN1yH3Ks5K',
  'System',
  'Administrator',
  '+1234567890',
  'ADMIN',
  'ACTIVE',
  0,
  NOW(),
  NOW()
)
ON CONFLICT ("tenantId", email) DO NOTHING
RETURNING id, email, "firstName", "lastName", role;
