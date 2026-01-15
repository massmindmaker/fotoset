# UI Design Patterns

## Design System

### Color Space
- OKLCH color space for consistent colors
- Defined in `styles/globals.css`
- Dark mode support via `next-themes`

### Component Library
- Radix UI primitives
- shadcn/ui components
- Tailwind CSS 4 for styling

## Component Structure

### Main Component
`components/persona-app.tsx` manages all views:

1. **ONBOARDING** - 3-step tutorial carousel
2. **DASHBOARD** - Avatar gallery, creation UI
3. **CREATE_PERSONA_UPLOAD** - Multi-file upload with progress
4. **SELECT_STYLE** - 3 preset style selection
5. **GENERATING** - Progress indicator
6. **RESULTS** - Generated photos gallery

### State Machine
```typescript
type ViewState = 
  | 'ONBOARDING'
  | 'DASHBOARD'
  | 'CREATE_PERSONA_UPLOAD'
  | 'SELECT_STYLE'
  | 'GENERATING'
  | 'RESULTS';

const [currentView, setCurrentView] = useState<ViewState>('ONBOARDING');
```

## UI Components

### PaymentModal
- Shows offer with feature list
- Redirects to payment provider
- Polls status on callback

### Upload Component
- Drag-and-drop support
- 5-8 photos required
- Progress bar during upload
- Preview with delete option

### Results Gallery
- Grid layout for 23 photos
- Individual download buttons
- "Download All" as ZIP
- "Generate More" action

## Animation
- Motion library (Framer Motion)
- Smooth transitions between views
- Loading spinners during async ops

## Responsive Design
- Mobile-first approach
- Breakpoints via Tailwind
- Touch-friendly controls

## Relations
@code_style/patterns
@structure/architecture
