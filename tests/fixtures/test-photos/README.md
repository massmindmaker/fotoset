# Test Photo Fixtures

This directory contains sample photos for automated E2E testing.

## Required Photos

For comprehensive testing, add 10-20 sample portrait photos:

- `photo-1.jpg` through `photo-20.jpg`
- Resolution: 1024x1024 or similar
- Format: JPEG or PNG
- Content: Portrait-style photos (faces visible for realistic testing)

## Generating Test Photos

You can:

1. **Use AI-generated placeholder images:**
   ```bash
   # Using placeholder services
   curl https://picsum.photos/1024/1024 > photo-1.jpg
   curl https://thispersondoesnotexist.com > photo-2.jpg
   ```

2. **Use stock photos:**
   - Download from Unsplash, Pexels (free license)
   - Ensure they're portrait-oriented

3. **Create synthetic test data:**
   - Canvas-generated images with test patterns
   - Color blocks with metadata

## Usage in Tests

```typescript
import path from 'path';

const testPhotos = [
  path.join(__dirname, '../fixtures/test-photos/photo-1.jpg'),
  path.join(__dirname, '../fixtures/test-photos/photo-2.jpg'),
  // ... up to photo-10.jpg (minimum)
];

await personaPage.uploadPhotos(testPhotos);
```

## Important Notes

- **Do NOT commit actual personal photos** to the repository
- Use only royalty-free or AI-generated images
- Keep file sizes reasonable (<5MB each) for fast test execution
- Ensure photos meet PinGlass requirements (portrait orientation, clear faces)
