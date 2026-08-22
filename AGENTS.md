# ActivityTracker RCPIT — Persistent Development & Git Guidelines

## 1. Core Architectural Principle
DATABASE → SERVICE → CONTROLLER → API → FRONTEND

- All business logic lives in backend services (`backend/src/services/`).
- Controllers handle HTTP req/res mapping.
- React components strictly consume backend APIs (`frontend/src/api/client.js`).
- MongoDB is the single source of truth.

## 2. GitHub & Commit Workflow
After completing each user feature/fix:
1. Test & Build (`npm run uat` in backend, `npm run build` in frontend).
2. Check `git status` and `git diff` for secrets/unwanted files.
3. Conventional commit (e.g. `feat: ...`, `fix: ...`).
4. Push commit to remote GitHub repository (`main`).

## 3. Strict Rules
- NEVER commit `.env`, secrets, or `backend/public/uploads/*`.
- NEVER use destructive git commands (`git reset --hard`, `git push --force`).
- NEVER push broken code.
- NEVER put fake/hardcoded data into production components.
