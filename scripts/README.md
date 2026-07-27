# Scripts

This folder contains active utility scripts for database setup and management.

## Active Scripts

- **final-create-admin.js** - Creates initial tenant and admin user
- **final-setup.js** - Complete database setup script
- **backup-database.js** - Backs up the local PostgreSQL database via `pg_dump` (custom format) into `backups/`, pruning anything older than 14 days. See CLAUDE.md's "Database Backups" section for scheduled setup and the restore procedure.

## Usage

These scripts connect directly to the PostgreSQL database and should be run from the project root:

```bash
node scripts/final-create-admin.js
node scripts/final-setup.js
```

## Note

Old scripts that are no longer used have been moved to the `old-scripts` folder.
