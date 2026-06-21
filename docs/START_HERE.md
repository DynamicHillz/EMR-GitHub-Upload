# 🚀 START HERE - SSMC EMR

**Welcome to SSMC EMR!** This guide will get you up and running in ~15 minutes.

---

## ✅ What's Already Done

Good news! Most of the setup is already complete:

- ✅ **Node.js v24.11.1** installed
- ✅ **npm v11.6.2** installed
- ✅ **879 packages** installed
- ✅ **Complete codebase** ready (26 TypeScript files)
- ✅ **Database schema** designed (20+ models)
- ✅ **Backend API** scaffolded (Express + Prisma)
- ✅ **Frontend app** ready (React + Tailwind CSS)

---

## 🎯 What You Need to Do

Just **ONE** thing: Set up a database!

### Option 1: Supabase (Recommended ⭐)
**Free, cloud-hosted PostgreSQL - No installation needed!**

**Time:** ~15 minutes
**Follow:** [SUPABASE_CHECKLIST.md](SUPABASE_CHECKLIST.md)

**Quick Steps:**
1. Create free account at https://supabase.com
2. Create new project (wait 2-3 min)
3. Copy database connection string
4. Update `.env` file
5. Run migrations
6. Done!

### Option 2: Local PostgreSQL
**Install PostgreSQL on your computer**

**Time:** ~30 minutes
**Follow:** [INSTALL_POSTGRESQL.md](INSTALL_POSTGRESQL.md)

**Note:** Requires administrator privileges

---

## 🏃 Quick Start (After Database Setup)

Once you've set up your database (Supabase recommended):

### 1. Create .env file
```bash
copy .env.example .env
```

Then edit `.env` with your database connection string.

### 2. Initialize Database
```bash
npm run prisma:generate
npm run prisma:migrate
```

When asked for migration name, type: `initial_setup`

### 3. Start Development Servers

**Terminal 1 - Backend:**
```bash
npm run dev:backend
```

**Terminal 2 - Frontend:**
```bash
npm run dev:frontend
```

### 4. Open Your Browser
Go to: **http://localhost:5173**

You should see the SSMC EMR login page! 🎉

---

## 📚 Documentation

| Guide | Purpose | Read Time |
|-------|---------|-----------|
| **[SUPABASE_CHECKLIST.md](SUPABASE_CHECKLIST.md)** | Step-by-step Supabase setup ⭐ | 5 min |
| [SETUP_SUPABASE.md](SETUP_SUPABASE.md) | Detailed Supabase guide | 10 min |
| [INSTALL_POSTGRESQL.md](INSTALL_POSTGRESQL.md) | Local PostgreSQL setup | 10 min |
| [README.md](README.md) | Complete project documentation | 20 min |
| [QUICKSTART.md](QUICKSTART.md) | Development guide | 15 min |
| [PROJECT_STATUS.md](PROJECT_STATUS.md) | Development roadmap | 10 min |

---

## 💡 Recommended Path

For the **fastest setup**, follow this order:

1. ⭐ **Read:** [SUPABASE_CHECKLIST.md](SUPABASE_CHECKLIST.md) (5 min)
2. ⭐ **Do:** Set up Supabase account & database (10 min)
3. ⭐ **Run:** Quick start commands above (2 min)
4. **Browse:** Your app at http://localhost:5173
5. **Explore:** [README.md](README.md) for project overview
6. **Learn:** [doc/Patient_SSMC_EMR_User_Stories.md](doc/Patient_SSMC_EMR_User_Stories.md)

**Total time:** ~17 minutes from zero to running application!

---

## 🎯 Development Workflow

### Daily Workflow

1. **Start servers** (2 terminals):
   ```bash
   npm run dev:backend    # Terminal 1
   npm run dev:frontend   # Terminal 2
   ```

2. **Open in browser:** http://localhost:5173

3. **Make changes:**
   - Backend: `src/backend/` (auto-restart)
   - Frontend: `src/frontend/` (hot reload)
   - Database: `prisma/schema.prisma` (run migration)

4. **View database:**
   ```bash
   npm run prisma:studio  # Opens http://localhost:5555
   ```

### Common Commands

```bash
# Development
npm run dev:backend          # Start backend (port 3000)
npm run dev:frontend         # Start frontend (port 5173)

# Database
npm run prisma:studio        # Visual DB editor
npm run prisma:generate      # Regenerate Prisma Client
npm run prisma:migrate       # Create/run migrations

# Code Quality
npm run lint                 # Check code quality
npm run format               # Format code with Prettier
```

---

## 🗺️ Project Structure

```
St.stephen EMR/
├── src/
│   ├── backend/              # Node.js API
│   │   ├── server.ts        # Express server
│   │   ├── routes/          # API endpoints
│   │   ├── controllers/     # Business logic
│   │   ├── middleware/      # Auth, errors
│   │   └── utils/           # Helpers
│   │
│   └── frontend/            # React app
│       ├── App.tsx          # Main component
│       ├── pages/           # Page components
│       └── components/      # Reusable UI
│
├── prisma/
│   └── schema.prisma        # Database models
│
├── doc/                     # Requirements & stories
│
└── Configuration files
    ├── .env                 # Your secrets (create this!)
    ├── package.json         # Dependencies
    ├── tsconfig.json        # TypeScript config
    └── tailwind.config.js   # Styling
```

---

## 🎓 What to Build First

Once your setup is complete, start with **Sprint 1** features:

### Week 1-2: User Authentication
- [ ] User login (US-USER-001)
- [ ] User registration (US-USER-002)
- [ ] Password reset (US-USER-003)
- [ ] Protected routes

### Week 3-4: Patient Management
- [ ] Patient registration form (US-PAT-001)
- [ ] Medical history capture (US-PAT-002)
- [ ] Patient search (US-PAT-003)
- [ ] Patient profile view (US-PAT-004)

**See:** [PROJECT_STATUS.md](PROJECT_STATUS.md) for complete roadmap

---

## 🆘 Need Help?

### Common Issues

**"Cannot connect to database"**
→ Check your `DATABASE_URL` in `.env` file

**"Module not found"**
→ Run `npm install` again

**"Port already in use"**
→ Close other terminals or change port in `.env`

**Tables not showing in Supabase**
→ Run `npm run prisma:migrate` again

### Resources

- **Supabase Dashboard:** https://app.supabase.com
- **Prisma Docs:** https://www.prisma.io/docs
- **React Docs:** https://react.dev
- **Tailwind CSS:** https://tailwindcss.com

---

## 🎉 You're Ready!

The project is fully set up and ready for development. Once you complete the database setup:

1. You can start building features
2. All code is organized and documented
3. Hot reload is enabled for fast development
4. Database tools are ready (Prisma Studio)

**Next:** Follow [SUPABASE_CHECKLIST.md](SUPABASE_CHECKLIST.md) to complete your setup!

---

## 📊 Project Stats

- **Total Files:** 26 TypeScript files
- **Dependencies:** 879 packages
- **Database Models:** 20+
- **User Stories:** 85
- **Requirements:** 110
- **Estimated MVP:** 6 months
- **Current Progress:** Setup complete (20%)

---

**Ready to build something amazing? Let's go! 🚀**
