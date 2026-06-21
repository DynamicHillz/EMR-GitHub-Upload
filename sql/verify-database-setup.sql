-- ============================================
-- Database Setup Verification Script
-- ============================================
-- Run this script after executing setup-complete-schema.sql
-- to verify all tables, enums, and objects were created correctly
-- ============================================

-- ============================================
-- 1. VERIFY ENUMS
-- ============================================

SELECT 'ENUMS VERIFICATION' AS verification_section;

SELECT
  typname AS enum_name,
  enumlabel AS enum_value
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE typname IN (
  'UserRole', 'Gender', 'MaritalStatus', 'BloodGroup',
  'ConsultationStatus', 'AppointmentStatus', 'PrescriptionStatus',
  'InvoiceStatus', 'PaymentStatus',
  'PaymentMethod', 'PaymentProcessStatus',
  'RefundStatus', 'ServiceCategory', 'PaymentGateway'
)
ORDER BY typname, enumlabel;

-- Count enums
SELECT
  COUNT(DISTINCT typname) AS total_enums,
  CASE
    WHEN COUNT(DISTINCT typname) = 14 THEN '✓ All enums created'
    ELSE '✗ Missing enums - Expected 14, Found ' || COUNT(DISTINCT typname)
  END AS status
FROM pg_type
WHERE typname IN (
  'UserRole', 'Gender', 'MaritalStatus', 'BloodGroup',
  'ConsultationStatus', 'AppointmentStatus', 'PrescriptionStatus',
  'InvoiceStatus', 'PaymentStatus',
  'PaymentMethod', 'PaymentProcessStatus',
  'RefundStatus', 'ServiceCategory', 'PaymentGateway'
);

-- ============================================
-- 2. VERIFY TABLES
-- ============================================

SELECT 'TABLES VERIFICATION' AS verification_section;

SELECT
  tablename,
  schemaname
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'Tenant', 'User', 'Patient', 'Consultation',
    'Invoice', 'InvoiceLineItem',
    'ServiceCatalog', 'Payment', 'Refund'
  )
ORDER BY tablename;

-- Count tables
SELECT
  COUNT(*) AS total_tables,
  CASE
    WHEN COUNT(*) = 9 THEN '✓ All 9 tables created'
    ELSE '✗ Missing tables - Expected 9, Found ' || COUNT(*)
  END AS status
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'Tenant', 'User', 'Patient', 'Consultation',
    'Invoice', 'InvoiceLineItem',
    'ServiceCatalog', 'Payment', 'Refund'
  );

-- ============================================
-- 3. VERIFY INDEXES
-- ============================================

SELECT 'INDEXES VERIFICATION' AS verification_section;

SELECT
  tablename,
  indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
    'Tenant', 'User', 'Patient', 'Consultation',
    'Invoice', 'InvoiceLineItem',
    'ServiceCatalog', 'Payment', 'Refund'
  )
ORDER BY tablename, indexname;

-- Count indexes
SELECT
  tablename,
  COUNT(*) AS index_count
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
    'Tenant', 'User', 'Patient', 'Consultation',
    'Invoice', 'InvoiceLineItem',
    'ServiceCatalog', 'Payment', 'Refund'
  )
GROUP BY tablename
ORDER BY tablename;

-- ============================================
-- 4. VERIFY FOREIGN KEY CONSTRAINTS
-- ============================================

SELECT 'FOREIGN KEYS VERIFICATION' AS verification_section;

SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  tc.constraint_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name IN (
    'Tenant', 'User', 'Patient', 'Consultation',
    'Invoice', 'InvoiceLineItem',
    'ServiceCatalog', 'Payment', 'Refund'
  )
ORDER BY tc.table_name, kcu.column_name;

-- ============================================
-- 5. VERIFY TRIGGERS
-- ============================================

SELECT 'TRIGGERS VERIFICATION' AS verification_section;

SELECT
  event_object_table AS table_name,
  trigger_name,
  event_manipulation AS event,
  action_timing AS timing
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND event_object_table IN (
    'Tenant', 'User', 'Patient', 'Consultation',
    'Invoice', 'InvoiceLineItem',
    'ServiceCatalog', 'Payment', 'Refund'
  )
ORDER BY event_object_table, trigger_name;

-- Count triggers
SELECT
  COUNT(*) AS total_triggers,
  CASE
    WHEN COUNT(*) >= 9 THEN '✓ All updatedAt triggers created'
    ELSE '✗ Missing triggers - Expected at least 9, Found ' || COUNT(*)
  END AS status
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name LIKE '%updated_at%'
  AND event_object_table IN (
    'Tenant', 'User', 'Patient', 'Consultation',
    'Invoice', 'InvoiceLineItem',
    'ServiceCatalog', 'Payment', 'Refund'
  );

-- ============================================
-- 6. VERIFY VIEWS
-- ============================================

SELECT 'VIEWS VERIFICATION' AS verification_section;

SELECT
  table_name AS view_name,
  view_definition
FROM information_schema.views
WHERE table_schema = 'public'
  AND table_name = 'OutstandingInvoicesView';

-- ============================================
-- 7. TABLE DETAILS (Columns)
-- ============================================

SELECT 'TABLE COLUMNS DETAILS' AS verification_section;

SELECT
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'Tenant', 'User', 'Patient', 'Consultation',
    'Invoice', 'InvoiceLineItem',
    'ServiceCatalog', 'Payment', 'Refund'
  )
ORDER BY table_name, ordinal_position;

-- ============================================
-- 8. SUMMARY
-- ============================================

SELECT 'SETUP SUMMARY' AS verification_section;

WITH summary AS (
  SELECT
    (SELECT COUNT(DISTINCT typname) FROM pg_type WHERE typname IN (
      'UserRole', 'Gender', 'MaritalStatus', 'BloodGroup',
      'ConsultationStatus', 'AppointmentStatus', 'PrescriptionStatus',
      'InvoiceStatus', 'PaymentStatus',
      'PaymentMethod', 'PaymentProcessStatus',
      'RefundStatus', 'ServiceCategory', 'PaymentGateway'
    )) AS enum_count,
    (SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public' AND tablename IN (
      'Tenant', 'User', 'Patient', 'Consultation',
      'Invoice', 'InvoiceLineItem',
      'ServiceCatalog', 'Payment', 'Refund'
    )) AS table_count,
    (SELECT COUNT(*) FROM information_schema.triggers
     WHERE trigger_schema = 'public'
     AND trigger_name LIKE '%updated_at%'
     AND event_object_table IN (
       'Tenant', 'User', 'Patient', 'Consultation',
       'Invoice', 'InvoiceLineItem',
       'ServiceCatalog', 'Payment', 'Refund'
     )) AS trigger_count,
    (SELECT COUNT(*) FROM information_schema.views
     WHERE table_schema = 'public'
     AND table_name = 'OutstandingInvoicesView') AS view_count
)
SELECT
  enum_count || ' / 14 Enums' AS enums,
  table_count || ' / 9 Tables' AS tables,
  trigger_count || ' / 9 Triggers' AS triggers,
  view_count || ' / 1 Views' AS views,
  CASE
    WHEN enum_count = 14 AND table_count = 9 AND trigger_count >= 9 AND view_count = 1
    THEN '✓✓✓ DATABASE SETUP COMPLETE ✓✓✓'
    ELSE '✗ SETUP INCOMPLETE - Check details above'
  END AS status
FROM summary;

-- ============================================
-- 9. NEXT STEPS
-- ============================================

DO $$
DECLARE
  table_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO table_count
  FROM pg_tables
  WHERE schemaname = 'public'
    AND tablename IN (
      'Tenant', 'User', 'Patient', 'Consultation',
      'Invoice', 'InvoiceLineItem',
      'ServiceCatalog', 'Payment', 'Refund'
    );

  IF table_count = 9 THEN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✓ DATABASE SETUP VERIFICATION COMPLETE';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Next Steps:';
    RAISE NOTICE '1. Run: npx prisma generate';
    RAISE NOTICE '2. Restart backend server: npm run dev:backend';
    RAISE NOTICE '3. Configure payment gateway environment variables in .env';
    RAISE NOTICE '4. Test API endpoints using doc/BILLING_API_QUICK_START.md';
    RAISE NOTICE '';
  ELSE
    RAISE WARNING 'Only % of 9 tables were created. Please check the setup script.', table_count;
  END IF;
END
$$;
