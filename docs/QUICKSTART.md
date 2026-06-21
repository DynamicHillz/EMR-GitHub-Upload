# SSMC EMR - Quick Start Guide

This guide will help you set up and run the SSMC EMR system on your local machine.

---

## Prerequisites Installation

### 1. Install Node.js

**Windows:**
1. Download Node.js 18+ from https://nodejs.org/
2. Run the installer
3. Verify installation:
   ```bash
   node --version
   npm --version
   ```

**macOS:**
```bash
brew install node@18
```

**Linux:**
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 2. Install PostgreSQL

**Windows:**
1. Download from https://www.postgresql.org/download/windows/
2. Run installer (use default port 5432)
3. Remember your postgres password

**macOS:**
```bash
brew install postgresql@15
brew services start postgresql@15
```

**Linux:**
```bash
sudo apt-get install postgresql postgresql-contrib
sudo systemctl start postgresql
```

### 3. Install Git (if not already installed)

Download from https://git-scm.com/downloads

---

## Project Setup

### Step 1: Install Dependencies

```bash
cd "St.stephen EMR"
npm install
```

This will install all required packages (~500MB). It may take 5-10 minutes.

### Step 2: Set Up Database

1. **Create PostgreSQL database:**

   ```bash
   # Connect to PostgreSQL
   psql -U postgres

   # In PostgreSQL console:
   CREATE DATABASE medflow_emr;
   CREATE USER medflow_user WITH PASSWORD 'secure_password';
   GRANT ALL PRIVILEGES ON DATABASE medflow_emr TO medflow_user;
   \q
   ```

2. **Configure environment variables:**

   ```bash
   # Copy example env file
   cp .env.example .env

   # Edit .env file and update:
   # - DATABASE_URL (PostgreSQL connection)
   # - JWT_SECRET (generate a random string)
   # - SQLCIPHER_KEY (generate a random string)
   ```

3. **Run database migrations:**

   ```bash
   npm run prisma:generate
   npm run prisma:migrate
   ```

### Step 3: Run Development Servers

Open 2 terminal windows:

**Terminal 1 - Backend API:**
```bash
npm run dev:backend
```
Server will start on http://localhost:3000

**Terminal 2 - Frontend:**
```bash
npm run dev:frontend
```
Frontend will start on http://localhost:5173

### Step 4: Access the Application

Open your browser and navigate to:
- **Frontend:** http://localhost:5173
- **API Health Check:** http://localhost:3000/health

**Default Login (for testing):**
- Email: `doctor@clinic.com`
- Password: `password` (placeholder - will be implemented)

---

## Development Workflow

### Making Changes

1. **Backend Changes:**
   - Edit files in `src/backend/`
   - Server auto-restarts (nodemon)
   - Check terminal for errors

2. **Frontend Changes:**
   - Edit files in `src/frontend/`
   - Hot reload enabled (Vite)
   - Changes appear instantly

3. **Database Changes:**
   - Edit `prisma/schema.prisma`
   - Run: `npm run prisma:migrate`
   - Migration files created automatically

### Common Commands

```bash
# Development
npm run dev:backend          # Start backend server
npm run dev:frontend         # Start frontend server

# Database
npm run prisma:generate      # Generate Prisma Client
npm run prisma:migrate       # Run migrations
npm run prisma:studio        # Open Prisma Studio (DB GUI)

# Build
npm run build:backend        # Compile TypeScript
npm run build:frontend       # Build production bundle

# Code Quality
npm run lint                 # Run ESLint
npm run format               # Format code with Prettier
npm test                     # Run tests

# Prisma Tools
npm run prisma:studio        # Visual database editor
```

---

## Project Structure Overview

```
src/
├── backend/              # Node.js API
│   ├── server.ts        # Express server
│   ├── controllers/     # Business logic
│   ├── routes/          # API endpoints
│   ├── middleware/      # Auth, errors
│   └── utils/           # Helpers
│
├── frontend/            # React app
│   ├── App.tsx         # Main component
│   ├── pages/          # Page components
│   └── components/     # Reusable UI
│
└── shared/             # Shared code
    └── types/          # TypeScript types
```

---

## Troubleshooting

### Port Already in Use

**Backend (3000):**
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# macOS/Linux
lsof -ti:3000 | xargs kill -9
```

**Frontend (5173):**
```bash
# Windows
netstat -ano | findstr :5173
taskkill /PID <PID> /F

# macOS/Linux
lsof -ti:5173 | xargs kill -9
```

### Database Connection Error

1. Check PostgreSQL is running:
   ```bash
   # Windows
   sc query postgresql

   # macOS
   brew services list | grep postgresql

   # Linux
   sudo systemctl status postgresql
   ```

2. Verify `DATABASE_URL` in `.env` file

3. Test connection:
   ```bash
   psql -U postgres -d medflow_emr
   ```

### Prisma Errors

**"Prisma Client not generated":**
```bash
npm run prisma:generate
```

**"Migration failed":**
```bash
# Reset database (WARNING: deletes all data)
npx prisma migrate reset

# Or fix migration manually
npx prisma migrate resolve --rolled-back <migration_name>
```

### Module Not Found Errors

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### TypeScript Errors

```bash
# Check for type errors
npx tsc --noEmit

# Restart TypeScript server in VS Code
Cmd/Ctrl + Shift + P → "TypeScript: Restart TS Server"
```

---

## VS Code Setup (Recommended)

### Extensions

Install these VS Code extensions:
- ESLint
- Prettier - Code formatter
- Prisma
- TypeScript Vue Plugin (Volar)
- Tailwind CSS IntelliSense

### Settings

Add to `.vscode/settings.json`:
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  }
}
```

---

## Next Steps

1. **Explore the codebase:**
   - Check `doc/` folder for requirements
   - Review `prisma/schema.prisma` for data models
   - Read API route files in `src/backend/routes/`

2. **Implement your first feature:**
   - Pick a user story from `doc/Patient_SSMC_EMR_User_Stories.md`
   - Create necessary controllers and components
   - Test locally

3. **Learn the tech stack:**
   - React: https://react.dev/
   - Prisma: https://www.prisma.io/docs/
   - Express: https://expressjs.com/
   - Tailwind CSS: https://tailwindcss.com/

---

## Getting Help

- **Documentation:** See `README.md` for detailed info
- **Requirements:** Check `doc/Core_Requirements.md`
- **User Stories:** Read `doc/Patient_SSMC_EMR_User_Stories.md`

---

**Happy coding! 🚀**
