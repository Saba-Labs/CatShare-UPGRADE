export type InventoryMovementReason =
  | 'manual_adjust'
  | 'transfer_in'
  | 'transfer_out'
  | 'order_sale'
  | 'order_restore'
  | 'migration';

export interface Warehouse {
  id: string;
  userId: string;
  name: string;
  isDefault: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface InventoryRoom {
  id: string;
  warehouseId: string;
  userId: string;
  name: string;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface InventoryLevel {
  id: string;
  inventoryId: string;
  userId: string;
  productId: string;
  variantCombinationId: string | null;
  onHand: number;
  lowStockThreshold: number | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface InventoryMovement {
  id: string;
  userId: string;
  inventoryId: string;
  productId: string;
  variantCombinationId: string | null;
  delta: number;
  onHandAfter: number;
  reason: InventoryMovementReason;
  referenceType: 'order' | 'transfer' | null;
  referenceId: string | null;
  note: string | null;
  createdAt: string;
}

export interface StorefrontInventoryLine {
  productId: string;
  variantCombinationId: string | null;
  onHand: number;
  lowStockThreshold: number | null;
}

export interface StorefrontInventoryPayload {
  inventoryId: string | null;
  lines: StorefrontInventoryLine[];
}

export interface DefaultWarehouseResult {
  warehouseId: string;
  warehouseName: string;
  mainInventoryId: string;
  mainInventoryName: string;
}

export interface DeadStockLine {
  inventoryId: string;
  inventoryName: string;
  productId: string;
  variantCombinationId: string | null;
  onHand: number;
}
