import { invoke } from "@tauri-apps/api/core";
import type { DataSnapshot } from "../domain/types";

export async function loadData(dataDir: string): Promise<DataSnapshot> {
  return await invoke<DataSnapshot>("load_data", { dataDir });
}
