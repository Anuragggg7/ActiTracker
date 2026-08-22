<<<<<<< HEAD
# ActiTracker
ActivityTracker RCPIT : A secure institutional activity management platform for activity workflows, RBAC, attendance, documentation, reporting, official PDF generation, notifications, and advanced analytics.
=======
# ActivityTracker RCPIT

Centralized Institutional Activity, Event & Record Management System for R. C. Patel Institute of Technology (RCPIT).

## Architecture

- **Frontend**: React + Vite
- **Backend**: Node.js + Express
- **Database**: MongoDB
- **Authentication**: JWT + bcrypt
- **PDF Generation**: PDFKit

## Repository Structure

```text
ActivityTracker-RCPIT/
├── frontend/
│   ├── src/
│   ├── public/
│   ├── package.json
│   ├── vite.config.js
│   └── .env.example
├── backend/
│   ├── src/
│   ├── server.js
│   ├── public/uploads/
│   ├── package.json
│   └── .env.example
├── README.md
└── .gitignore
```

## Local Setup

### Backend Setup

```bash
cd backend
npm install
```

Create `.env` using `.env.example`:
```bash
# Copy example environment variables
cp .env.example .env
```

Start the backend server:
```bash
npm run dev
```

### Frontend Setup

```bash
cd frontend
npm install
```

Create `.env` using `.env.example`:
```bash
# Copy example environment variables
cp .env.example .env
```

Start the frontend development server:
```bash
npm run dev
```

### Root Convenience Command

To start both backend (Port `5000`) and frontend (Port `3000`) concurrently from the project root:

```bash
npm install
npm run dev
```

### Database Seeding & Testing Scripts

```bash
# Seed development/test demo accounts and departments (Optional)
npm run seed

# Clear sample data & reset database to 100% clean state
npm run clear-data

# Run full 25-step real database UAT test suite
cd backend && npm run uat
```

## Production Deployment Readiness

- **Backend (Render / Railway / AWS)**: Set environment variables (`PORT`, `MONGODB_URI`, `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `EMAIL_USER`, `EMAIL_PASSWORD`). Entry point is `backend/server.js`.
- **Frontend (Vercel / Netlify)**: Set `VITE_API_URL=https://YOUR-BACKEND.onrender.com/api`. Build command is `npm run build`.

## Important Security Notice

Do not commit `.env` files or uploaded institutional files to Git repositories.
>>>>>>> 25edf6d (Initial commit - ActivityTracker RCPIT)
