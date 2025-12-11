# View Components

This directory contains the split view components for the PersonaApp.

## Structure

- **types.ts** - Shared TypeScript interfaces and types
- **index.ts** - Central export point for all views
- **onboarding-view.tsx** - First-time user onboarding with animated showcase
- **dashboard-view.tsx** - Avatar gallery and creation UI
- **upload-view.tsx** - Photo upload interface with validation
- **tier-select-view.tsx** - Pricing tier selection (7/15/23 photos)
- **results-view.tsx** - Generated photos gallery with download/share

## Component Architecture

Each view is a standalone React functional component with:

- **Props interface** - Explicit typing for all props
- **Callbacks** - Navigation and state management via callbacks
- **No direct state** - All state managed by parent PersonaApp

## Usage

Views are lazy-loaded using Next.js dynamic imports in `persona-app.tsx`:

```tsx
import dynamic from "next/dynamic"

const DashboardView = dynamic(() => import("./views/dashboard-view"), {
  loading: () => <ComponentLoader />,
})
```

## Props Pattern

All views follow a consistent callback pattern:

```tsx
interface ViewProps {
  // Data
  persona?: Persona
  personas?: Persona[]

  // Navigation callbacks
  onBack?: () => void
  onNext?: () => void
  onCreate?: () => void

  // Action callbacks
  onGenerate?: (tier: PricingTier) => void
  updatePersona?: (id: string, updates: Partial<Persona>) => void
}
```

## Performance Benefits

- **Code splitting** - Each view loaded only when needed
- **Reduced bundle size** - Main bundle ~70% smaller
- **Lazy hydration** - Views hydrate only when rendered
- **SSR disabled** - OnboardingView uses `ssr: false` for animations

## Accessibility

All views include:

- Semantic HTML elements
- ARIA labels and roles
- Keyboard navigation support
- Loading states with aria-busy
- Focus management

## Maintenance

When adding a new view:

1. Create `[view-name]-view.tsx` in this directory
2. Export component and props interface
3. Add export to `index.ts`
4. Import dynamically in `persona-app.tsx`
5. Add to `ViewState` union type in `types.ts`
