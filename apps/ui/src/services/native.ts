import { invoke } from "@tauri-apps/api/core";
import type {
  DataSnapshot,
  BuildHistoryRecord,
  InventoryItem,
} from "../domain/types";

export async function loadData(dataDir: string): Promise<DataSnapshot> {
  return await invoke<DataSnapshot>("load_data", { dataDir });
}

export async function loadMainInventory(
  dataDir: string
): Promise<InventoryItem[]> {
  return await invoke<InventoryItem[]>("load_main_inventory", { dataDir });
}

export async function recordBuild(
  dataDir: string,
  buildRecord: Omit<BuildHistoryRecord, "id" | "timestamp">
): Promise<DataSnapshot> {
  return await invoke<DataSnapshot>("record_build", {
    dataDir,
    workOrder: buildRecord.work_order,
    salesOrder: buildRecord.sales_order,
    customer: buildRecord.customer,
    assemblySku: buildRecord.assembly_sku,
    quantityBuilt: buildRecord.quantity_built,
    operator: buildRecord.operator || null,
    notes: buildRecord.notes || null,
  });
}

export async function loadPanelHistory(
  dataDir: string
): Promise<BuildHistoryRecord[]> {
  return await invoke<BuildHistoryRecord[]>("load_panel_history", {
    dataDir,
  });
}
