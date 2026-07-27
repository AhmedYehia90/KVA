# Kalabsha Airlines

Starter repository for **Kalabsha Virtual Airlines**.

**Brand:** Kalabsha Airlines  
**Tagline:** Fly To Dreams  
**Arabic spelling:** كلابشة للطيران

## Included
- Next.js 15 website
- Initial fleet pages
- Express API starter
- PostgreSQL + Prisma foundation
- IVAO integration plan
- GitHub Actions CI
- Docker Compose

## Start
```bash
cp .env.example .env
pnpm install
docker compose up -d
pnpm db:generate
pnpm dev
```

Open `http://localhost:3000`.

## Brand rule
Replace `apps/web/public/brand/logo-reference.png` with the official transparent PNG/SVG. Never redraw the approved logo.
