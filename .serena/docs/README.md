# PinGlass Documentation

## Project Overview

**PinGlass** is a Next.js 16 web application for generating AI photo portraits using Google Imagen 3.0.

Users upload 10-20 reference photos, select a pricing tier (7/15/23 photos), complete payment via T-Bank, and receive AI-generated portraits.

## Documentation Structure

| File | Description |
|------|-------------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System architecture, data flow, component relationships |
| [API_REFERENCE.md](./API_REFERENCE.md) | Complete API endpoints documentation |
| [DATABASE.md](./DATABASE.md) | Database schema, tables, and queries |
| [COMPONENTS.md](./COMPONENTS.md) | React components and their props |
| [WORKFLOWS.md](./WORKFLOWS.md) | User flows and business logic |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Deployment guide and environment variables |

## Quick Reference

### Main Entry Points
- `app/page.tsx` - Home page (renders PersonaApp)
- `components/persona-app.tsx` - Main application component (414 lines)
- `app/api/` - All API routes

### Key Libraries
- `lib/db.ts` - Database client (63 lines)
- `lib/tbank.ts` - Payment integration (240 lines)
- `lib/imagen.ts` - AI image generation (521 lines)
- `lib/prompts.ts` - 23 generation prompts (103 lines)

### Component Views
- **OnboardingView** - Animated welcome with orbiting photos
- **DashboardView** - Avatar gallery with pricing tiers
- **UploadView** - Multi-file upload (10-20 photos)
- **TierSelectView** - Select photo package (7/15/23)
- **GeneratingView** - Progress indicator
- **ResultsView** - Generated photos gallery

## Pricing Tiers

| Tier | Photos | Price |
|------|--------|-------|
| Starter | 7 | 499 RUB |
| Standard | 15 | 999 RUB |
| Premium | 23 | 1499 RUB |

## Tech Stack

- **Frontend:** React 19, Next.js 16, TypeScript
- **Styling:** Tailwind CSS 4, OKLCH colors
- **Database:** Neon PostgreSQL (serverless)
- **AI:** Google Imagen 3.0 (via YeScale)
- **Payments:** T-Bank API

## Development Commands

```bash
pnpm dev     # Development server (Turbopack)
pnpm build   # Production build
pnpm start   # Start production server
pnpm lint    # Lint code
```

## User Flow

```
1. Onboarding (animated intro)
       |
       v
2. Upload (10-20 photos)
       |
       v
3. Select tier (7/15/23 photos)
       |
       v
4. Payment (T-Bank)
       |
       v
5. Generation (AI photos)
       |
       v
6. Results gallery (download)
```

## File Statistics

| Category | Files | Lines |
|----------|-------|-------|
| Components | 3 | 748 |
| Libraries | 9 | 1,718 |
| API Routes | 5 | 549 |
| **Total** | **17** | **3,015** |

---

*Documentation generated for Serena semantic code analysis*
*Last updated: December 2024*
