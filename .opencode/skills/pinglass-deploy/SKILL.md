---
name: pinglass-deploy
description: PinGlass deployment workflow for Vercel with pre-deployment checks
---

# PinGlass Deployment Skill

Automated deployment workflow for PinGlass (розовые очки) with comprehensive pre-deployment validation.

## When to Use This Skill

- Deploying to Vercel (preview or production)
- Running pre-deployment checks
- Validating build before deployment
- Checking environment variables

## Prerequisites

- Vercel CLI installed and authenticated
- Neon CLI installed (for database checks)
- Git repository clean or committed changes
- Environment variables configured

## Deployment Workflow

### 1. Pre-Deployment Checks

```bash
# Check git status
git status

# Verify no uncommitted changes for production
# (preview deployments can have uncommitted changes)

# Check Vercel status
vercel list --prod

# Check Neon database
neonctl branches list --project-id cool-grass-27858957

# Verify environment variables
vercel env pull .env.local
```

### 2. Build Validation

```bash
# Run TypeScript check
npm run type-check

# Run linter
npm run lint

# Run tests (if available)
npm test

# Build locally to catch errors early
npm run build
```

### 3. Deployment

**Preview Deployment:**
```bash
vercel
```

**Production Deployment:**
```bash
# Final confirmation check
vercel list --prod

# Deploy to production
vercel --prod

# Monitor logs
vercel logs --follow
```

### 4. Post-Deployment Verification

```bash
# Check deployment status
vercel list --prod

# Verify critical endpoints
curl https://www.pinglass.ru/api/health || echo "Health check failed"

# Check database connectivity
neonctl sql --project-id cool-grass-27858957 "SELECT COUNT(*) FROM users"
```

## Common Issues

### Build Failures

**TypeScript errors:**
```bash
npm run type-check
# Fix type errors before deployment
```

**Missing environment variables:**
```bash
vercel env pull .env.local
# Check .env.example for required vars
```

**Build timeout:**
```
# Check build output size
# Optimize large dependencies
# Consider increasing Vercel timeout
```

### Database Issues

**Connection failures:**
```bash
# Check Neon branch status
neonctl branches list --project-id cool-grass-27858957

# Verify DATABASE_URL in Vercel
vercel env ls
```

**Migration needed:**
```bash
# Run migrations locally first
npm run db:migrate

# Then deploy with migrations
vercel --prod
```

### Rollback

**If deployment fails:**
```bash
# List recent deployments
vercel list --prod

# Rollback to previous
vercel rollback <previous-deployment-url>

# Check logs
vercel logs <deployment-id>
```

## Environment-Specific Notes

### Preview Deployments
- Use for testing new features
- Safe to deploy with uncommitted changes
- Uses preview database branch (if configured)
- Accessible via unique URL

### Production Deployments
- Require clean git state
- Run full test suite
- Verify critical paths manually
- Monitor logs after deployment

## Anti-Patterns to Avoid

❌ **Don't:**
- Deploy without running build locally
- Skip TypeScript/linter checks
- Deploy with untracked critical files
- Forget to sync environment variables
- Deploy during high traffic (production)

✅ **Do:**
- Always test preview deployment first
- Run pre-deployment checks
- Verify database connectivity
- Monitor logs after deployment
- Keep deployment scripts updated

## Related Skills

- `webapp-testing` - E2E testing before deployment
- `changelog-generator` - Generate changelog for releases
- See `.claude/skills/` for more project skills

## References

- Vercel CLI: https://vercel.com/docs/cli
- Neon CLI: https://neon.tech/docs/reference/cli
- Project CLAUDE.md: `CLAUDE.md`
