# Store Homepage Builder Feature Plan

## Overview
Implement a professional drag-and-drop homepage builder for CatShare store admins, similar to Shopify theme editors and Google Sites. Desktop-only editing with mobile-restricted view.

## Architecture

### Data Layer
- **New Supabase Table**: `store_homepage_configs`
  - `id` (uuid, pk)
  - `store_id` (uuid, fk to stores)
  - `layout` (jsonb) - Serialized layout state (sections array)
  - `theme_settings` (jsonb) - Global theme/colors/fonts
  - `created_at` (timestamp)
  - `updated_at` (timestamp)
  - `auto_saved_at` (timestamp)

- **Layout Structure** (stored in `layout` column):
```typescript
interface HomepageSection {
  id: string; // unique within layout
  type: 'carousel' | 'text' | 'image' | 'banner' | 'featured-products' | 'category-showcase' | 'product-grid' | 'announcement' | 'cta' | 'video' | 'testimonials' | 'footer';
  order: number;
  settings: Record<string, any>; // Component-specific settings
  content: Record<string, any>; // Component-specific content
}

interface HomepageLayout {
  sections: HomepageSection[];
  theme: ThemeSettings;
}

interface ThemeSettings {
  primaryColor?: string;
  backgroundColor?: string;
  fontFamily?: string;
  accentColor?: string;
}
```

### File Structure
```
src/
├── components/
│   ├── HomepageBuilder/
│   │   ├── HomepageBuilder.tsx (main container)
│   │   ├── BuilderCanvas.tsx (drag-drop area)
│   │   ├── ComponentPalette.tsx (left sidebar - available sections)
│   │   ├── PropertiesPanel.tsx (right sidebar - edit selected)
│   │   ├── Toolbar.tsx (top actions)
│   │   ├── Preview.tsx (live preview)
│   │   └── sections/
│   │       ├── CarouselSection.tsx
│   │       ├── TextSection.tsx
│   │       ├── ImageSection.tsx
│   │       ├── BannerSection.tsx
│   │       ├── FeaturedProductsSection.tsx
│   │       ├── CategoryShowcaseSection.tsx
│   │       ├── ProductGridSection.tsx
│   │       ├── AnnouncementSection.tsx
│   │       ├── CTASection.tsx
│   │       ├── VideoSection.tsx
│   │       ├── TestimonialsSection.tsx
│   │       └── FooterSection.tsx
│   └── HomepageViewer/
│       ├── HomepageViewer.tsx (public/preview rendering)
│       └── sections/
│           └── (same as above, but read-only)
├── config/
│   ├── homepageBuilderConfig.ts (component schemas, defaults)
│   └── homepageSectionDefaults.ts (default content per section)
├── services/
│   ├── homepageService.ts (CRUD + autosave)
│   └── homepageDataService.ts (fetch products/categories)
├── hooks/
│   ├── useHomepageBuilder.ts (editor state)
│   ├── useHomepageAutosave.ts (autosave logic)
│   └── useResponsiveBuilder.ts (mobile detection)
└── types/
    └── homepage.ts (TypeScript interfaces)
```

## Implementation Phases

### Phase 1: Foundation (Data + Service Layer)
- [x] Create Supabase table `store_homepage_configs`
- [ ] Create TypeScript interfaces in `src/types/homepage.ts`
- [ ] Implement `homepageService.ts` (CRUD operations)
- [ ] Implement `homepageDataService.ts` (fetch products, categories)
- [ ] Create `homepageBuilderConfig.ts` with component defaults

### Phase 2: Core UI Components
- [ ] Build `HomepageBuilder.tsx` (main container, state management)
- [ ] Implement `BuilderCanvas.tsx` (dnd-kit integration)
- [ ] Create `ComponentPalette.tsx` (section library)
- [ ] Build `PropertiesPanel.tsx` (settings panel)
- [ ] Implement `Toolbar.tsx` (save, preview, undo/redo)

### Phase 3: Section Components
- [ ] Create all 11 section types with:
  - Editable version (BuilderCanvas)
  - Read-only version (viewer)
  - Settings schema (colors, fonts, spacing, etc.)

### Phase 4: Advanced Features
- [ ] Autosave + debouncing
- [ ] Real-time preview pane
- [ ] Responsive mobile detection (disable editing)
- [ ] Product/category selector modal
- [ ] Undo/redo support
- [ ] Template presets

### Phase 5: Integration
- [ ] Add "Edit Homepage" button in Store.tsx settings panel
- [ ] Create modal/page route for builder
- [ ] Integrate HomepageViewer in public storefront (StoreView.tsx)
- [ ] Add responsive handling for mobile

## Component Schemas

Each section type has:
1. **Default Settings** - structure, defaults
2. **Editor UI** - how to edit in BuilderCanvas
3. **Validator** - validate before save
4. **Renderer** - render in preview/viewer

### Example: Carousel Section
```typescript
{
  type: 'carousel',
  settings: {
    height: 'medium' | 'large',
    aspectRatio: '16:9' | '4:3' | 'square',
    autoPlay: boolean,
    interval: number,
    navigation: 'dots' | 'arrows' | 'both' | 'none',
    animation: 'fade' | 'slide',
  },
  content: {
    images: Array<{
      id: string;
      url: string;
      title?: string;
      caption?: string;
      link?: string;
    }>
  }
}
```

## Key Features

### Editor (Desktop Only)
- ✅ Drag-drop sections from palette
- ✅ Reorder sections (drag within canvas)
- ✅ Delete/duplicate sections
- ✅ Edit section settings (right panel)
- ✅ Live preview (optional split-view)
- ✅ Autosave with debounce
- ✅ Undo/redo (localStorage or state-based)

### Mobile Behavior
- ❌ Editor disabled on mobile
- ✅ Preview-only mode available
- ✅ Shows "Editor not available on mobile" message
- ✅ Link to edit on desktop

### Responsive Rendering
- ✅ Sections stack on mobile
- ✅ Images scale properly
- ✅ Text readable on all sizes
- ✅ Touch-friendly in preview mode

## State Management
- React Context + useReducer for builder state
- Local state for UI interactions
- Supabase for persistence
- localStorage for unsaved changes (offline support)

## Testing Strategy
1. Unit tests for reducers
2. Integration tests for CRUD
3. Manual testing on desktop/mobile
4. Preview functionality verification

## Accessibility
- Keyboard navigation for builder
- ARIA labels for components
- Semantic HTML in rendered sections
- Focus management in modals

## Performance Considerations
- Lazy load product/category data
- Debounce autosave (2s delay)
- Memoize section renderers
- Pagination for product selectors
- Virtual scrolling for large lists

## Security
- RLS policy: only store owner can edit
- Validate section types on backend
- Sanitize user content (colors, text)
- Rate limit autosave API calls

## Success Criteria
- ✅ Editor works smoothly on desktop
- ✅ Mobile completely disables editing
- ✅ All 11 section types functional
- ✅ Autosave working without UI blocking
- ✅ Preview matches rendering
- ✅ Products/categories selectable and display correctly
- ✅ Responsive output on all screen sizes
