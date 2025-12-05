# PinGlass Documentation Index

## Project Documentation

This folder contains comprehensive documentation for the PinGlass (розовые очки) project.

### Documentation Structure

| File | Description |
|------|-------------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System architecture, data flow, component relationships |
| [API_REFERENCE.md](./API_REFERENCE.md) | Complete API endpoints documentation |
| [DATABASE.md](./DATABASE.md) | Database schema, tables, and queries |
| [COMPONENTS.md](./COMPONENTS.md) | React components and their props |
| [WORKFLOWS.md](./WORKFLOWS.md) | User flows and business logic |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Deployment guide and environment variables |

### Quick Reference

**Main Entry Points:**
- `app/page.tsx` - Home page (renders PersonaApp)
- `components/persona-app.tsx` - Main application component
- `app/api/` - All API routes

**Key Libraries:**
- `lib/db.ts` - Database client
- `lib/tbank.ts` - Payment integration
- `lib/imagen.ts` - AI image generation
- `lib/prompts.ts` - Generation prompts

### Development Commands

```bash
pnpm dev     # Development server (Turbopack)
pnpm build   # Production build
pnpm start   # Start production server
pnpm lint    # Lint code
```
