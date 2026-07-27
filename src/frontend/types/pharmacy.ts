export interface Consumable {
  id: string;
  name: string;
  category?: string;
  unit: string;
  description?: string;
  unitPrice: number;
  reorderPoint: number;
  stockLevel: number;
}

export interface ConsumableBatch {
  id: string;
  batchNumber: string;
  expiryDate: string | null;
  quantity: number;
  status: string;
  daysUntilExpiry: number | null;
}

export interface ConsumableInventoryItem {
  consumableId: string;
  consumableName: string;
  totalStock: number;
  reorderLevel: number;
  batches: ConsumableBatch[];
  lowStock: boolean;
  nearExpiry: boolean;
}

export interface ConsumableUsageRecord {
  id: string;
  consumableId: string;
  consumableName: string;
  unit: string;
  batchNumber: string;
  unitPrice: number;
  quantityUsed: number;
  total: number;
  patientId: string;
  admissionId?: string;
  consultationId?: string;
  billingStatus: 'UNBILLED' | 'BILLED';
  notes?: string;
  // Oxygen-therapy detail — only populated when the consumable's category is
  // "Oxygen"; undefined for ordinary consumables.
  flowRateLpm?: number;
  deliveryMethod?: string;
  spO2Before?: number;
  spO2After?: number;
  usedAt: string;
  recordedByName: string;
}
