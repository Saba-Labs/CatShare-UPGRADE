# Variant Details Upgrade - Completion Plan

## Current Status (as of May 21, 2026)
The variant combination editor framework has been implemented with basic CRUD operations. Core infrastructure is in place:
- ✅ Variant group management (create/edit/delete)
- ✅ Automatic variant combination generation (Cartesian product)
- ✅ Variant combination editor component with inline form
- ✅ Price override per variant
- ✅ Image override per variant
- ✅ Custom fields JSON support (SKU, stock, etc.)
- ✅ Persistence to Supabase

## Architecture Overview

### Files Structure
```
src/
├── components/
│   └── VariantCombinationEditor.tsx (200 lines)
│       └── Editable variant combination list with inline editing
├── CreateProduct/
│   ├── CreateProduct_Classic.tsx (integrated editor)
│   └── CreateProduct_Glass.tsx (integrated editor)
├── utils/
│   └── productVariants.ts (utility functions)
│       ├── Variant group management
│       ├── Combination generation
│       └── Data normalization/serialization
└── pages/
    └── StoreView.tsx (integration point)
```

### Data Model
```typescript
ProductVariantsConfig {
  groups: ProductVariantGroup[]
  combinations?: VariantCombination[]
}

ProductVariantGroup {
  id: string
  name: string
  options: string[]
}

VariantCombination {
  id: string // stable hash from selections
  selections: Record<string, string>
  image?: string
  price?: number
  customFields?: Record<string, unknown>
}
```

## Remaining Work Items

### Phase 1: UI Refinements (High Priority)
- [ ] **Modal/Sheet Styling**
  - Current: Basic inline editor
  - Needed: Match dark theme properly (check dark:bg-gray-900, dark:text-gray-100 classes)
  - Location: `VariantCombinationEditor.tsx` (lines 70-140)
  
- [ ] **Combination List Improvements**
  - Add visual indicators for combinations with custom data
  - Improve grid layout responsiveness (currently 1 col mobile, 2 col desktop)
  - Add combination count display with formatting
  - Location: `VariantCombinationEditor.tsx` (lines 170-210)

- [ ] **Form Validation**
  - Validate image URLs (basic URL format check)
  - Validate price input (non-negative numbers only)
  - Prevent invalid custom field JSON
  - Location: `VariantCombinationEditor.tsx` (lines 100-140)

### Phase 2: Feature Completeness (Medium Priority)
- [ ] **Bulk Operations**
  - Apply price adjustment to all variants at once
  - Copy price from one variant to another
  - Bulk delete variants with data
  - Suggested location: Add context menu to combination list

- [ ] **Import/Export**
  - CSV import for variant data (price, SKU, stock)
  - CSV export for variant combinations with data
  - Suggested location: New utility module `src/utils/variantImportExport.ts`

- [ ] **Stock Management**
  - Add stock field to variant combination (integrate with inventory)
  - Stock status indicator (in stock, low stock, out of stock)
  - Location: Update `VariantCombination` type and editor form

- [ ] **Variant-Specific Product Rules**
  - Enabled/disabled status per variant
  - Availability date ranges
  - Regional restrictions
  - Location: Extend `VariantCombination` type

### Phase 3: Integration & Optimization (Lower Priority)
- [ ] **Performance**
  - Memoize combination generation for large variant sets (>1000 combos)
  - Lazy load variant data on demand instead of all at once
  - Location: `VariantCombinationEditor.tsx` and `productVariants.ts`

- [ ] **Order Integration**
  - Ensure variant selections properly flow to orders
  - Display variant details in order summary
  - Use `formatVariantSelectionSummary()` consistently
  - Location: `src/pages/OrderForm.tsx` and order components

- [ ] **Mobile Optimization**
  - Test sheet dragging behavior on mobile (ensure variant list is accessible)
  - Optimize form inputs for touch (larger tap targets)
  - Location: `CreateProduct_Classic.tsx` (lines 1820-1850)

- [ ] **Export to Shopify/WooCommerce**
  - Map variant data to platform-specific formats
  - Handle variant SKU synchronization
  - Location: New module `src/utils/variantPlatformSync.ts`

## Implementation Guidelines

### Code Standards
- Use `PascalCase` for component files
- Keep components focused: 1 component = 1 responsibility
- Use React hooks (useState, useCallback, useMemo)
- Memoize expensive computations with `useMemo`
- Use TypeScript strict mode

### Testing Checklist
For each feature added:
- [ ] Unit test variant utility functions
- [ ] Component renders without errors
- [ ] CRUD operations work (Create, Read, Update, Delete)
- [ ] Variant data persists to Supabase
- [ ] Works with both Classic and Glass themes
- [ ] Mobile responsive on 375px-1024px viewports
- [ ] Dark mode support verified

### Database Schema (Supabase)
Already integrated into `products` table:
```sql
variants: jsonb -- stores ProductVariantsConfig
```

No schema migrations needed; all variant data stored as JSON in existing column.

## Known Limitations
1. Max 6 variant groups (configurable via `MAX_VARIANT_GROUPS`)
2. Max 24 options per group (configurable via `MAX_VARIANT_OPTIONS_PER_GROUP`)
3. Max ~1800 combinations for 6 groups × 24 options (Cartesian product)
4. Custom fields limited by JSON serialization (no file uploads)
5. No real-time sync with other users editing same product

## Success Metrics
- Variant details form loads without lag for products with 1000+ combinations
- All variant data properly saves/loads from Supabase
- Variant information displays correctly in orders
- Mobile users can edit variants on 5-inch screens
- Dark mode contrast meets WCAG AA standards

## Related Files to Review
- `src/CreateProduct/CreateProduct_Classic.tsx` - Main product form (updated)
- `src/CreateProduct/CreateProduct_Glass.tsx` - Glass theme variant (updated)
- `src/pages/StoreView.tsx` - Store integration point
- `src/utils/orderUtils.ts` - Order processing with variant info
- `src/components/ProductCard.tsx` - Product display with variant indicators
