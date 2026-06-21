# SQL Files

This folder contains SQL schema files and setup scripts.

## Files

- **setup-supabase.sql** - Supabase-specific setup script
- **setup-billing-schema.sql** - Billing module schema
- **setup-complete-schema.sql** - Complete database schema
- **verify-database-setup.sql** - Verification script for database setup
- Other SQL files for specific setup scenarios

## Usage

These SQL files can be executed directly in a PostgreSQL database or via Prisma:

```bash
# Via psql
psql -U username -d database_name -f sql/setup-complete-schema.sql

# Via Prisma
npx prisma db push
```

## Note

The project primarily uses Prisma for schema management. These SQL files are for reference or manual setup scenarios.
