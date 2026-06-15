import { getSupabaseClient, setSupabaseRlsUserId } from '../supabaseClient';
import type {
  DeadStockLine,
  DefaultWarehouseResult,
  InventoryLevel,
  InventoryMovement,
  InventoryRoom,
  StorefrontInventoryLine,
  StorefrontInventoryPayload,
  Warehouse,
} from '../types/inventory';

async function ensureRlsHeader(userId: string): Promise<void> {
  if (userId?.trim()) {
    setSupabaseRlsUserId(userId.trim());
    return;
  }
  const { data: { session } } = await getSupabaseClient().auth.getSession();
  if (session?.user?.id) setSupabaseRlsUserId(session.user.id);
}

function mapWarehouse(row: Record<string, unknown>): Warehouse {
  return {
    id: String(row.id),
    userId: String(row.user_id ?? row.userId ?? ''),
    name: String(row.name ?? ''),
    isDefault: Boolean(row.is_default ?? row.isDefault),
    createdAt: row.created_at != null ? String(row.created_at) : undefined,
    updatedAt: row.updated_at != null ? String(row.updated_at) : undefined,
  };
}

function mapRoom(row: Record<string, unknown>): InventoryRoom {
  return {
    id: String(row.id),
    warehouseId: String(row.warehouse_id ?? row.warehouseId ?? ''),
    userId: String(row.user_id ?? row.userId ?? ''),
    name: String(row.name ?? ''),
    sortOrder: Number(row.sort_order ?? row.sortOrder ?? 0),
    createdAt: row.created_at != null ? String(row.created_at) : undefined,
    updatedAt: row.updated_at != null ? String(row.updated_at) : undefined,
  };
}

function mapLevel(row: Record<string, unknown>): InventoryLevel {
  return {
    id: String(row.id),
    inventoryId: String(row.inventory_id ?? row.inventoryId ?? ''),
    userId: String(row.user_id ?? row.userId ?? ''),
    productId: String(row.product_id ?? row.productId ?? ''),
    variantCombinationId:
      row.variant_combination_id != null
        ? String(row.variant_combination_id)
        : row.variantCombinationId != null
          ? String(row.variantCombinationId)
          : null,
    onHand: Number(row.on_hand ?? row.onHand ?? 0),
    lowStockThreshold:
      row.low_stock_threshold != null
        ? Number(row.low_stock_threshold)
        : row.lowStockThreshold != null
          ? Number(row.lowStockThreshold)
          : null,
    createdAt: row.created_at != null ? String(row.created_at) : undefined,
    updatedAt: row.updated_at != null ? String(row.updated_at) : undefined,
  };
}

function mapMovement(row: Record<string, unknown>): InventoryMovement {
  return {
    id: String(row.id),
    userId: String(row.user_id ?? row.userId ?? ''),
    inventoryId: String(row.inventory_id ?? row.inventoryId ?? ''),
    productId: String(row.product_id ?? row.productId ?? ''),
    variantCombinationId:
      row.variant_combination_id != null ? String(row.variant_combination_id) : null,
    delta: Number(row.delta ?? 0),
    onHandAfter: Number(row.on_hand_after ?? row.onHandAfter ?? 0),
    reason: row.reason as InventoryMovement['reason'],
    referenceType: (row.reference_type ?? row.referenceType ?? null) as InventoryMovement['referenceType'],
    referenceId: row.reference_id != null ? String(row.reference_id) : null,
    note: row.note != null ? String(row.note) : null,
    createdAt: String(row.created_at ?? ''),
  };
}

function mapStorefrontLine(raw: Record<string, unknown>): StorefrontInventoryLine {
  return {
    productId: String(raw.productId ?? raw.product_id ?? ''),
    variantCombinationId:
      raw.variantCombinationId != null
        ? String(raw.variantCombinationId)
        : raw.variant_combination_id != null
          ? String(raw.variant_combination_id)
          : null,
    onHand: Number(raw.onHand ?? raw.on_hand ?? 0),
    lowStockThreshold:
      raw.lowStockThreshold != null
        ? Number(raw.lowStockThreshold)
        : raw.low_stock_threshold != null
          ? Number(raw.low_stock_threshold)
          : null,
  };
}

function isMissingInventorySchemaError(error: unknown): boolean {
  const msg = String((error as { message?: string })?.message ?? error ?? '').toLowerCase();
  return (
    msg.includes('warehouses') ||
    msg.includes('inventories') ||
    msg.includes('inventory_levels') ||
    msg.includes('ensure_default_warehouse') ||
    msg.includes('does not exist')
  );
}

export async function ensureDefaultWarehouse(
  userId: string
): Promise<{ data: DefaultWarehouseResult | null; error: unknown }> {
  try {
    await ensureRlsHeader(userId);
    const { data, error } = await getSupabaseClient().rpc('ensure_default_warehouse', {
      p_user_id: userId.trim(),
    });
    if (error) return { data: null, error };
    const row = (data ?? {}) as Record<string, unknown>;
    return {
      data: {
        warehouseId: String(row.warehouseId ?? ''),
        warehouseName: String(row.warehouseName ?? ''),
        mainInventoryId: String(row.mainInventoryId ?? ''),
        mainInventoryName: String(row.mainInventoryName ?? ''),
      },
      error: null,
    };
  } catch (err) {
    return { data: null, error: err };
  }
}

export async function fetchWarehouses(
  userId: string
): Promise<{ data: Warehouse[] | null; error: unknown }> {
  try {
    await ensureRlsHeader(userId);
    const { data, error } = await getSupabaseClient()
      .from('warehouses')
      .select('*')
      .eq('user_id', userId.trim())
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true });
    if (error) {
      if (isMissingInventorySchemaError(error)) return { data: [], error: null };
      return { data: null, error };
    }
    return { data: (data ?? []).map((r) => mapWarehouse(r as Record<string, unknown>)), error: null };
  } catch (err) {
    return { data: null, error: err };
  }
}

export async function fetchInventoryRooms(
  userId: string,
  warehouseId?: string
): Promise<{ data: InventoryRoom[] | null; error: unknown }> {
  try {
    await ensureRlsHeader(userId);
    let query = getSupabaseClient()
      .from('inventories')
      .select('*')
      .eq('user_id', userId.trim())
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });
    if (warehouseId) query = query.eq('warehouse_id', warehouseId);
    const { data, error } = await query;
    if (error) {
      if (isMissingInventorySchemaError(error)) return { data: [], error: null };
      return { data: null, error };
    }
    return { data: (data ?? []).map((r) => mapRoom(r as Record<string, unknown>)), error: null };
  } catch (err) {
    return { data: null, error: err };
  }
}

export async function createInventoryRoom(
  userId: string,
  warehouseId: string,
  name: string,
  sortOrder = 0
): Promise<{ data: InventoryRoom | null; error: unknown }> {
  try {
    await ensureRlsHeader(userId);
    const { data, error } = await getSupabaseClient()
      .from('inventories')
      .insert({
        warehouse_id: warehouseId,
        user_id: userId.trim(),
        name: name.trim(),
        sort_order: sortOrder,
      })
      .select()
      .maybeSingle();
    if (error) return { data: null, error };
    return { data: data ? mapRoom(data as Record<string, unknown>) : null, error: null };
  } catch (err) {
    return { data: null, error: err };
  }
}

export async function updateInventoryRoom(
  userId: string,
  roomId: string,
  updates: { name?: string; sortOrder?: number }
): Promise<{ data: InventoryRoom | null; error: unknown }> {
  try {
    await ensureRlsHeader(userId);
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (updates.name != null) patch.name = updates.name.trim();
    if (updates.sortOrder != null) patch.sort_order = updates.sortOrder;
    const { data, error } = await getSupabaseClient()
      .from('inventories')
      .update(patch)
      .eq('id', roomId)
      .eq('user_id', userId.trim())
      .select()
      .maybeSingle();
    if (error) return { data: null, error };
    return { data: data ? mapRoom(data as Record<string, unknown>) : null, error: null };
  } catch (err) {
    return { data: null, error: err };
  }
}

export async function fetchInventoryLevels(
  userId: string,
  inventoryId: string
): Promise<{ data: InventoryLevel[] | null; error: unknown }> {
  try {
    await ensureRlsHeader(userId);
    const { data, error } = await getSupabaseClient()
      .from('inventory_levels')
      .select('*')
      .eq('inventory_id', inventoryId)
      .eq('user_id', userId.trim())
      .order('product_id', { ascending: true });
    if (error) {
      if (isMissingInventorySchemaError(error)) return { data: [], error: null };
      return { data: null, error };
    }
    return { data: (data ?? []).map((r) => mapLevel(r as Record<string, unknown>)), error: null };
  } catch (err) {
    return { data: null, error: err };
  }
}

export async function adjustInventoryLevel(
  userId: string,
  inventoryId: string,
  productId: string,
  newOnHand: number,
  variantCombinationId?: string | null,
  lowStockThreshold?: number | null,
  note?: string
): Promise<{ data: InventoryLevel | null; error: unknown }> {
  try {
    await ensureRlsHeader(userId);
    const { data, error } = await getSupabaseClient().rpc('adjust_inventory_level', {
      p_inventory_id: inventoryId,
      p_product_id: productId,
      p_variant_combination_id: variantCombinationId ?? '',
      p_new_on_hand: newOnHand,
      p_low_stock_threshold: lowStockThreshold ?? null,
      p_note: note ?? null,
    });
    if (error) return { data: null, error };
    return { data: data ? mapLevel(data as Record<string, unknown>) : null, error: null };
  } catch (err) {
    return { data: null, error: err };
  }
}

export async function transferInventory(
  userId: string,
  fromInventoryId: string,
  toInventoryId: string,
  productId: string,
  qty: number,
  variantCombinationId?: string | null,
  note?: string
): Promise<{ data: unknown; error: unknown }> {
  try {
    await ensureRlsHeader(userId);
    const { data, error } = await getSupabaseClient().rpc('transfer_inventory', {
      p_from_inventory_id: fromInventoryId,
      p_to_inventory_id: toInventoryId,
      p_product_id: productId,
      p_variant_combination_id: variantCombinationId ?? '',
      p_qty: qty,
      p_note: note ?? null,
    });
    return { data, error };
  } catch (err) {
    return { data: null, error: err };
  }
}

export async function fetchInventoryMovements(
  userId: string,
  options?: { inventoryId?: string; limit?: number }
): Promise<{ data: InventoryMovement[] | null; error: unknown }> {
  try {
    await ensureRlsHeader(userId);
    let query = getSupabaseClient()
      .from('inventory_movements')
      .select('*')
      .eq('user_id', userId.trim())
      .order('created_at', { ascending: false })
      .limit(options?.limit ?? 100);
    if (options?.inventoryId) query = query.eq('inventory_id', options.inventoryId);
    const { data, error } = await query;
    if (error) {
      if (isMissingInventorySchemaError(error)) return { data: [], error: null };
      return { data: null, error };
    }
    return { data: (data ?? []).map((r) => mapMovement(r as Record<string, unknown>)), error: null };
  } catch (err) {
    return { data: null, error: err };
  }
}

export async function getStorefrontInventory(
  sellerId: string,
  catalogueId: string
): Promise<{ data: StorefrontInventoryPayload; error: unknown }> {
  try {
    const { data, error } = await getSupabaseClient().rpc('get_storefront_inventory', {
      p_seller_id: sellerId.trim(),
      p_catalogue_id: catalogueId.trim(),
    });
    if (error) {
      if (isMissingInventorySchemaError(error)) {
        return { data: { inventoryId: null, lines: [] }, error: null };
      }
      return { data: { inventoryId: null, lines: [] }, error };
    }
    return { data: parseStorefrontInventoryRpcPayload(data), error: null };
  } catch (err) {
    return { data: { inventoryId: null, lines: [] }, error: err };
  }
}

function parseStorefrontInventoryRpcPayload(raw: unknown): StorefrontInventoryPayload {
  if (raw == null) {
    return { inventoryId: null, lines: [] };
  }
  if (Array.isArray(raw)) {
    return {
      inventoryId: null,
      lines: raw.map((r) => mapStorefrontLine(r as Record<string, unknown>)),
    };
  }
  if (typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    const invRaw = o.inventoryId ?? o.inventory_id;
    const inventoryId =
      invRaw != null && String(invRaw).trim() !== '' ? String(invRaw).trim() : null;
    const linesRaw = o.lines ?? o.items;
    const lines = Array.isArray(linesRaw)
      ? linesRaw.map((r) => mapStorefrontLine(r as Record<string, unknown>))
      : [];
    return { inventoryId, lines };
  }
  return { inventoryId: null, lines: [] };
}

export async function applyOrderInventory(
  orderId: string
): Promise<{ data: unknown; error: unknown }> {
  try {
    const { data, error } = await getSupabaseClient().rpc('apply_order_inventory', {
      p_order_id: orderId,
    });
    return { data, error };
  } catch (err) {
    return { data: null, error: err };
  }
}

export async function restoreOrderInventory(
  orderId: string
): Promise<{ data: unknown; error: unknown }> {
  try {
    const { data, error } = await getSupabaseClient().rpc('restore_order_inventory', {
      p_order_id: orderId,
    });
    return { data, error };
  } catch (err) {
    return { data: null, error: err };
  }
}

export async function fetchDeadStock(
  userId: string,
  linkedInventoryIds: string[]
): Promise<{ data: DeadStockLine[]; error: unknown }> {
  try {
    await ensureRlsHeader(userId);
    const { data: rooms, error: roomsErr } = await fetchInventoryRooms(userId);
    if (roomsErr || !rooms) return { data: [], error: roomsErr };

    const linked = new Set(linkedInventoryIds.filter(Boolean));
    const unlinkedRoomIds = rooms.filter((r) => !linked.has(r.id)).map((r) => r.id);
    if (unlinkedRoomIds.length === 0) return { data: [], error: null };

    const { data: levels, error } = await getSupabaseClient()
      .from('inventory_levels')
      .select('*')
      .eq('user_id', userId.trim())
      .in('inventory_id', unlinkedRoomIds)
      .gt('on_hand', 0);
    if (error) {
      if (isMissingInventorySchemaError(error)) return { data: [], error: null };
      return { data: [], error };
    }

    const roomNameById = new Map(rooms.map((r) => [r.id, r.name]));
    const dead: DeadStockLine[] = (levels ?? []).map((row) => {
      const lvl = mapLevel(row as Record<string, unknown>);
      return {
        inventoryId: lvl.inventoryId,
        inventoryName: roomNameById.get(lvl.inventoryId) ?? 'Inventory',
        productId: lvl.productId,
        variantCombinationId: lvl.variantCombinationId,
        onHand: lvl.onHand,
      };
    });
    return { data: dead, error: null };
  } catch (err) {
    return { data: [], error: err };
  }
}

export async function fetchLowStockLevels(
  userId: string
): Promise<{ data: InventoryLevel[]; error: unknown }> {
  try {
    await ensureRlsHeader(userId);
    const { data, error } = await getSupabaseClient()
      .from('inventory_levels')
      .select('*')
      .eq('user_id', userId.trim())
      .not('low_stock_threshold', 'is', null);
    if (error) {
      if (isMissingInventorySchemaError(error)) return { data: [], error: null };
      return { data: [], error };
    }
    const low = (data ?? [])
      .map((r) => mapLevel(r as Record<string, unknown>))
      .filter((l) => l.lowStockThreshold != null && l.onHand <= (l.lowStockThreshold as number));
    return { data: low, error: null };
  } catch (err) {
    return { data: [], error: err };
  }
}
