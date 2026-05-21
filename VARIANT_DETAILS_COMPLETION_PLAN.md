# Variant Details Completion Plan

## Current Status
✅ **Variant Creation** - Done
- Variant groups created and managed
- Variant combinations auto-generated

❌ **Variant Details** - Incomplete
- Variant-specific data (price, image, SKU, stock) is **editable** but **not used**
- Customer purchases use base product price, never the variant override
- Variant images not displayed to customers
- Order system doesn't capture variant-specific data

## The Gap
The `VariantCombinationEditor` allows editing variant data:
- `image`: per-variant image URL
- `price`: per-variant price override
- `customFields`: SKU, stock, description, etc.

But **the rest of the app doesn't use this data**. When a customer:
1. ✅ Selects a variant (Size: M, Color: Red)
2. ❌ Still sees base product price, not variant price
3. ❌ Still sees base product image, not variant image
4. ❌ Order doesn't record variant-specific SKU or stock

## Work Breakdown

### 1. **Core: Use Variant Data in Product Display** (CRITICAL)
**File:** `src/pages/StoreView.tsx`

When a customer selects a variant combination:
- [ ] Fetch variant-specific data using `getVariantCombinationData(product, selections)`
- [ ] Display variant price override if available
- [ ] Display variant image if available
- [ ] Show custom fields (SKU, stock status) if present

**Code locations to update:**
- Line ~1016: Where product price is calculated
- Line ~1045: Where product is displayed in cart
- Line ~1560: Variant summary display
- Line ~1855-1885: Product drawer/details view

**Specific changes:**
```typescript
// BEFORE: Always use base price
const price = product.price;

// AFTER: Use variant price if available
const variantData = getVariantCombinationData(
  product, 
  variantSelections[product.id]
);
const price = variantData?.price ?? product.price;

// BEFORE: Always use base image
const imageUrl = product.image;

// AFTER: Use variant image if available
const imageUrl = variantData?.image ?? product.image;
```

### 2. **Gallery: Show Variant-Specific Images** (HIGH)
**File:** `src/pages/StoreView.tsx` - ProductImageGallery component

- [ ] When variant selected, update gallery to show variant image if available
- [ ] Fall back to base product images if no variant image
- [ ] Ensure gallery updates reactively when variant selection changes

**Code location:**
- Line ~1450-1500 (estimate): Product detail image gallery

### 3. **Order: Capture Variant Details** (HIGH)
**File:** `src/pages/StoreView.tsx` - Order submission

When creating order (line ~1085-1100):
- [ ] Attach variant-specific price to order item
- [ ] Attach variant-specific image to order item  
- [ ] Attach custom fields (SKU) to order item
- [ ] Update OrderItem type to include variant data

**OrderItem type update:**
```typescript
type OrderItem = {
  productId: string;
  quantity: number;
  variantSelections?: Record<string, string>;
  
  // NEW: Variant-specific overrides
  variantPrice?: number;
  variantImage?: string;
  variantCustomFields?: Record<string, unknown>;
};
```

### 4. **Cart Display: Show Variant Prices** (MEDIUM)
**File:** `src/pages/StoreView.tsx` - Cart summary (line ~1020)

When building cart summary:
- [ ] Use variant price if available
- [ ] Show variant name in summary
- [ ] Recalculate totals with variant pricing

### 5. **UI/UX: Stock Status** (MEDIUM)
**Component:** `VariantCombinationEditor.tsx`

Add optional stock field to variant details:
- [ ] Add `stock?: number` field to VariantCombination type
- [ ] Add stock input to editor form
- [ ] Display stock status on variant combo button (in stock/low/out)
- [ ] Disable out-of-stock variants in customer view

**Code location:** `src/components/VariantCombinationEditor.tsx` lines 100-140

### 6. **Integration: Display Stock on StoreFront** (MEDIUM)
**File:** `src/pages/StoreView.tsx`

- [ ] Check variant stock before allowing order
- [ ] Show "Out of Stock" indicator if stock: 0
- [ ] Disable "Add to Cart" if out of stock

### 7. **Orders API: Preserve Variant Data** (CRITICAL)
**File:** `src/services/orderService.ts`

- [ ] Ensure variant data flows through to Supabase
- [ ] Update order schema to store variant details
- [ ] Preserve for order tracking and fulfillment

### 8. **Bug Fixes & Polish**
- [ ] Ensure dark mode works in variant editor (check `dark:` classes)
- [ ] Mobile responsive: make variant selection easy on small screens
- [ ] Form validation: validate price input (must be number >= 0)
- [ ] Form validation: validate image URL format
- [ ] Handle variant deletion: clean up custom data

---

## Implementation Order (Priority)
1. **First:** Update OrderItem type & capture variant data → orders work correctly
2. **Second:** Use variant price in product display → customer sees correct pricing
3. **Third:** Use variant image in gallery → visual feedback
4. **Fourth:** Add stock tracking & UI → prevent overselling
5. **Fifth:** Polish & dark mode → production ready

---

## Testing Checklist

For each feature:
- [ ] Create product with 2 variant groups (Size: S/M, Color: Red/Blue)
- [ ] Create 4 combinations (2×2)
- [ ] Edit variant #2: Set custom price ($99), custom image, SKU: "ABC-123"
- [ ] In storefront, select variant #2
  - [ ] See custom price displayed
  - [ ] See custom image in gallery
  - [ ] See SKU in details (if implemented)
- [ ] Add to cart → verify variant price in cart total
- [ ] Submit order → verify order saved with variant data
- [ ] Test on mobile (375px width)
- [ ] Test dark mode toggle

---

## Files to Modify

1. `src/pages/StoreView.tsx` - Main storefront logic (750+ lines)
   - Product price calculation
   - Image gallery
   - Order creation
   - Cart display

2. `src/utils/productVariants.ts` - Already has helpers, may need minor additions
   - Already has `getVariantCombinationData()` ✅

3. `src/components/VariantCombinationEditor.tsx` - Editor form
   - Add stock field option
   - Dark mode fixes

4. `src/services/orderService.ts` - Order persistence
   - Update to store variant data

5. `src/CreateProduct/CreateProduct_Classic.tsx` & `Glass.tsx` - Already integrated ✅

---

## Key Functions Already Available

```typescript
// Get variant-specific data by selections
getVariantCombinationData(product, variantSelections[productId])
// Returns: { id, selections, image?, price?, customFields? }

// Get variant selection summary for display
formatVariantSelectionSummary(groups, variantSelections[productId])
// Returns: "Size: M; Color: Red"

// Check if customer selected all required variants
isVariantSelectionComplete(groups, variantSelections[productId])
// Returns: boolean
```

Use these existing functions to implement variant details throughout the app.
