# Supabase Database Sync Implementation Guide

## Overview

Your app now has complete Supabase integration with offline support, automatic syncing, and real-time capabilities. This guide explains how everything works and what you need to do.

## Quick Start (3 Steps)

### Step 1: Create Supabase Tables (Required)

1. Go to [Supabase Dashboard](https://app.supabase.com/)
2. Select your project: **qqlsmobjpcrfbumscpgc**
3. Go to **SQL Editor** → Click **New Query**
4. Copy and paste the entire contents of `SUPABASE_SETUP.sql`
5. Click **Run** to execute

This creates all necessary tables with Row Level Security (RLS) policies that ensure:
- Users can only access their own data
- All data is automatically encrypted at rest
- Proper indexes for fast querying

### Step 2: Update Component Props (Optional but Recommended)

To enable automatic background sync when products are saved, update components that call `setProducts`:

```typescript
// Old way (still works - local save only)
localStorage.setItem("products", JSON.stringify(products));
setProducts(products);

// New way (with automatic Supabase sync)
import { safeSetProductsWithSync } from "./utils/safeStorageWithSync";

safeSetProductsWithSync(products, { userId: user.uid });
setProducts(products);
```

The sync happens automatically in the background without blocking the UI.

### Step 3: Test the Integration

1. **Restart the app** (dev server)
2. **Log in** with your Firebase account
3. You'll see the sync indicators in the bottom-right:
   - ✓ Synced (green) - data is synced
   - ⟳ Syncing... (blue) - currently syncing
   - ⚠ Sync failed (red) - connection issue
4. **Create a product** and check:
   - Local save happens immediately (fast)
   - Supabase sync happens in background
   - Indicator shows sync status

## Architecture Overview

### Data Flow

```
User Action (Create/Edit/Delete Product)
         ↓
Update Local State (React state)
         ↓
Save to localStorage (for offline support)
         ↓
Background Sync to Supabase (non-blocking)
         ↓
Update Sync Status Indicator
```

### Key Components

#### 1. **AuthContext** (`src/context/AuthContext.tsx`)
- Manages user authentication with Firebase
- Fetches user's Supabase data when they log in
- Provides `supabaseData` and `supabaseDataLoading` to child components

#### 2. **Sync Service** (`src/services/supabaseSync.ts`)
- Core sync functions:
  - `syncProducts()` - sync products
  - `syncDeletedProducts()` - sync soft-deleted items
  - `syncCataloguesDefinition()` - sync catalogue settings
  - `syncFieldsDefinition()` - sync field configuration
  - `syncUserSettings()` - sync user preferences
  - `fetchAllUserData()` - fetch all data for initial load
  - `setupRealtimeSubscriptions()` - listen for real-time changes

#### 3. **Safe Storage Sync** (`src/utils/safeStorageWithSync.ts`)
- Wrapper around localStorage with automatic sync
- Functions:
  - `safeSetProductsWithSync()` - save products and sync
  - `safeSetDeletedProductsWithSync()` - save deleted products and sync
  - `safeSetCataloguesWithSync()` - save catalogues and sync
  - `safeSetFieldsWithSync()` - save fields and sync
  - `safeSetUserSettingsWithSync()` - save settings and sync
  - `batchSyncToSupabase()` - sync multiple data types at once

#### 4. **Sync Queue** (`src/services/syncQueue.ts`)
- Queues sync operations when offline
- Automatically retries when connection is restored
- Persistent storage in localStorage
- Features:
  - Automatic retry up to 5 times
  - Exponential backoff (30-second intervals)
  - Queue persists across app restarts

#### 5. **UI Indicators**
- **SyncStatusIndicator** (`src/components/SyncStatusIndicator.tsx`)
  - Shows sync status in bottom-right corner
  - Icons: ✓ (synced), ⟳ (syncing), ⚠ (error)
  
- **OfflineStatusIndicator** (`src/components/OfflineStatusIndicator.tsx`)
  - Shows offline banner at top
  - Displays queue statistics
  - Button to manually retry sync

## How Sync Works

### Optimistic Updates Pattern

1. **User creates a product**
2. **Local state updates immediately** (user sees it right away)
3. **Data saved to localStorage** (for offline support)
4. **Background sync to Supabase** (happens asynchronously)
5. **Sync status updates** (user sees confirmation)

If sync fails (no internet), the data stays in the queue and retries automatically when reconnected.

### Data Merge Strategy

When a user logs in with existing data in both localStorage and Supabase:
- Latest timestamp wins (auto-merge)
- No data loss
- Consistent across devices after sync

## Offline Support

### What Happens When Offline

1. **Product saves work normally** (stored locally)
2. **Sync to Supabase fails** (caught gracefully)
3. **Item added to sync queue** (automatically stored)
4. **User sees offline indicator** at top of screen

### When Connection Restored

1. **Offline banner disappears**
2. **Sync queue auto-processes** (within 30 seconds)
3. **User sees sync status** (syncing → synced)
4. **All queued items synced** to Supabase
5. **Multi-device sync** when other devices refresh

## Integration Examples

### Example 1: Syncing Product Changes

```typescript
import { safeSetProductsWithSync } from "./utils/safeStorageWithSync";
import { useAuth } from "./context/AuthContext";

function ProductComponent() {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);

  const handleSaveProduct = async (product) => {
    // Update local state first (instant feedback)
    const updated = [...products, product];
    setProducts(updated);

    // Save and sync in background
    safeSetProductsWithSync(updated, { 
      userId: user.uid 
    });
  };

  return <div>...</div>;
}
```

### Example 2: Manual Batch Sync

```typescript
import { batchSyncToSupabase } from "./utils/safeStorageWithSync";
import { useAuth } from "./context/AuthContext";

async function handleBulkRestore(restoredData) {
  const { user } = useAuth();

  // Save locally first
  setProducts(restoredData.products);
  localStorage.setItem("products", JSON.stringify(restoredData.products));

  // Sync to Supabase
  await batchSyncToSupabase(user.uid, {
    products: restoredData.products,
    deletedProducts: restoredData.deletedProducts,
    fieldsDefinition: restoredData.fieldsDefinition,
  });
}
```

### Example 3: Using Sync Queue for Offline

```typescript
import { useSyncQueue } from "./services/syncQueue";
import { useAuth } from "./context/AuthContext";

function OfflineAwareComponent() {
  const { user } = useAuth();
  const { addToQueue } = useSyncQueue();

  const handleSave = (products) => {
    setProducts(products);
    localStorage.setItem("products", JSON.stringify(products));

    // Add to queue (syncs when online)
    addToQueue('products', user.uid, products);
  };

  return <div>...</div>;
}
```

## File Structure

```
src/
├── services/
│   ├── supabaseSync.ts              # Core sync functions
│   ├── syncQueue.ts                 # Offline sync queue
│   └── backupRestoreSync.ts         # Backup/restore sync integration
├── utils/
│   ├── safeStorageWithSync.ts       # Storage + sync wrapper
│   └── safeStorage.ts               # Original storage utilities
├── hooks/
│   └── useSyncedProducts.ts         # Hook for synced product updates
├── components/
│   ├── SyncStatusIndicator.tsx      # Sync status UI
│   └── OfflineStatusIndicator.tsx   # Offline status UI
├── context/
│   └── AuthContext.tsx              # Auth + Supabase data
└── supabaseClient.js                # Supabase client config
```

## Testing Checklist

- [ ] Run SUPABASE_SETUP.sql in Supabase dashboard
- [ ] Log in to the app
- [ ] Create a product
  - [ ] Verify it saves locally (instant)
  - [ ] Verify sync indicator shows "Syncing..."
  - [ ] Verify it appears in Supabase SQL Editor
  - [ ] Check Supabase dashboard → tables → products
- [ ] Go offline (browser DevTools → Network → Offline)
  - [ ] Create another product (should save locally)
  - [ ] See offline banner at top
  - [ ] See sync queue with pending items
- [ ] Go back online
  - [ ] Offline banner disappears
  - [ ] Sync queue auto-processes
  - [ ] Products appear in Supabase
- [ ] Delete a product
  - [ ] Verify it's removed locally
  - [ ] Verify it syncs to Supabase deleted_products
- [ ] Test multi-device sync:
  - [ ] Create product on Device A
  - [ ] Switch to Device B
  - [ ] Refresh page on Device B
  - [ ] Product from Device A should appear
- [ ] Test restore backup:
  - [ ] Create backup
  - [ ] Restore on same device
  - [ ] Check if restore syncs to Supabase

## Common Issues & Solutions

### Products Not Syncing

**Problem**: Created products don't appear in Supabase

**Solutions**:
1. Check Supabase tables exist (run SUPABASE_SETUP.sql)
2. Check user is logged in (`supabaseDataLoading` should be false)
3. Check browser console for sync errors
4. Try manual retry: click offline indicator → "Retry Now"

### Offline Mode Not Working

**Problem**: Offline indicator doesn't appear

**Solutions**:
1. Use browser DevTools to simulate offline (Network → Offline)
2. Check localStorage for sync queue: `console.log(localStorage.getItem('supabase-sync-queue'))`
3. Verify OfflineStatusIndicator is rendered in App.tsx

### Data Conflicts

**Problem**: Different data on different devices

**Solutions**:
1. Latest timestamp always wins (auto-resolved)
2. Refresh to get latest from Supabase
3. Use backup/restore with merge option if needed

## Next Steps

1. **Customize Sync Frequency**: Modify `RETRY_INTERVAL` in `syncQueue.ts` if needed
2. **Add Realtime Features**: Use `setupRealtimeSubscriptions()` for live updates
3. **Analytics**: Add events when sync succeeds/fails
4. **Error Handling**: Add custom error recovery UI
5. **Image Sync**: Plan for Cloudflare Workers integration (future)

## Important Notes

- **Images are local only** for now (Cloudflare migration is planned)
- **Row Level Security** prevents users from accessing other users' data
- **Soft deletes** preserve history while allowing multi-device sync
- **localStorage** is always the source of truth during offline
- **Supabase** is the persistent, multi-device source of truth

## Support

For issues:
1. Check browser console for error messages
2. Check Supabase dashboard for RLS policy errors
3. Verify user.uid matches data in products table
4. Check network tab to see sync requests

---

**Setup is complete!** Your app now has enterprise-grade data sync with Supabase. 🎉
