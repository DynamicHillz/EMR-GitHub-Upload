# Database Setup Instructions

## Current Status

Your database is currently **empty** (no tables created yet). The complete schema SQL script has been created to set up all required tables.

## Step-by-Step Instructions

### Step 1: Open Supabase SQL Editor

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Click on **SQL Editor** in the left sidebar
4. Click **New Query**

### Step 2: Execute the Complete Schema

1. Open the file: `setup-complete-schema.sql` in your project directory
2. Copy the **entire contents** of the file
3. Paste it into the Supabase SQL Editor
4. Click **Run** button (or press Ctrl+Enter)

### Step 3: Verify Success

You should see output messages like:
```
NOTICE:  All prerequisite enums created successfully
NOTICE:  ✓ All 9 tables created successfully
NOTICE:  Table verification complete
```

If you see these messages, the schema was created successfully!

### Step 4: Verify Tables Were Created

Run this query in Supabase SQL Editor:

```sql
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

You should see 9 tables:
- Consultation
- Invoice
- InvoiceLineItem
- Patient
- Payment
- Refund
- ServiceCatalog
- Tenant
- User

### Step 5: Generate Prisma Client

After the database schema is created, run this command in your terminal:

```bash
npx prisma generate
```

This will update the Prisma client with all the new models.

### Step 6: Restart Backend Server

After Prisma client is generated, restart your backend:

```bash
npm run dev:backend
```

---

## What This Schema Creates

### Base Tables (6)
1. **Tenant** - Multi-tenant organization data
2. **User** - System users (doctors, nurses, admin, etc.)
3. **Patient** - Patient demographic and contact information
4. **Consultation** - Medical consultations/visits
5. **Invoice** - Billing invoices for services
6. **InvoiceLineItem** - Individual line items on invoices

### Billing Tables (3)
7. **ServiceCatalog** - Medical services pricing catalog
8. **Payment** - Payment records with gateway support
9. **Refund** - Refund requests and processing

### Enums (13)
- UserRole, Gender, MaritalStatus, BloodGroup
- ConsultationStatus, AppointmentStatus, PrescriptionStatus
- InvoiceStatus, PaymentStatus
- PaymentMethod, PaymentProcessStatus
- RefundStatus, ServiceCategory, PaymentGateway

### Additional Features
- **Indexes** - For optimal query performance
- **Triggers** - Automatic `updatedAt` timestamp updates
- **Views** - `OutstandingInvoicesView` for aging analysis
- **Foreign Keys** - Data integrity constraints

---

## Troubleshooting

### If you get "permission denied" error:
- Make sure you're logged into Supabase as the project owner
- Check that you have the correct project selected

### If you get "already exists" errors:
- Some objects may already exist in your database
- The script uses `CREATE IF NOT EXISTS` to handle this safely
- Check which tables already exist with the verification query above

### If you get connection timeout:
- Check your internet connection
- Try refreshing the Supabase dashboard
- Wait a few minutes and try again

---

## Next Steps After Setup

1. **Configure Payment Gateways** - Add environment variables to `.env`:
   ```env
   FLUTTERWAVE_PUBLIC_KEY=your_public_key
   FLUTTERWAVE_SECRET_KEY=your_secret_key
   FLUTTERWAVE_WEBHOOK_SECRET=your_webhook_secret

   PAYSTACK_PUBLIC_KEY=your_public_key
   PAYSTACK_SECRET_KEY=your_secret_key
   PAYSTACK_WEBHOOK_SECRET=your_webhook_secret

   MONIEPOINT_PUBLIC_KEY=your_public_key
   MONIEPOINT_SECRET_KEY=your_secret_key
   MONIEPOINT_WEBHOOK_SECRET=your_webhook_secret
   ```

2. **Test API Endpoints** - Use the guide in `doc/BILLING_API_QUICK_START.md`

3. **Create Initial Data**:
   - Create a tenant
   - Create users
   - Add services to the catalog
   - Register patients

4. **Start Frontend Development** - Build UI for billing features

---

## Files Reference

- `setup-complete-schema.sql` - Complete database schema (USE THIS ONE)
- `setup-billing-schema.sql` - Billing tables only (requires base tables)
- `setup-billing-schema-safe.sql` - Billing tables with checks
- `doc/BILLING_MODULE_FINAL_SUMMARY.md` - Complete implementation guide
- `doc/BILLING_API_QUICK_START.md` - API endpoint reference

---

**Ready to proceed?** Follow the steps above to set up your database schema!
