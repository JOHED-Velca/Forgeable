import { invoke } from "@tauri-apps/api/core";
import type { DataSnapshot, BuildHistoryRecord } from "../domain/types";

export async function loadData(dataDir: string): Promise<DataSnapshot> {
  return await invoke<DataSnapshot>("load_data", { dataDir });
}

export async function recordBuild(
  dataDir: string,
  buildRecord: Omit<BuildHistoryRecord, "id" | "timestamp">
): Promise<DataSnapshot> {
  return await invoke<DataSnapshot>("record_build", {
    data_dir: dataDir,
    work_order: buildRecord.work_order,
    sales_order: buildRecord.sales_order,
    customer: buildRecord.customer,
    assembly_sku: buildRecord.assembly_sku,
    quantity_built: buildRecord.quantity_built,
    operator: buildRecord.operator || null,
    notes: buildRecord.notes || null,
  });
}
