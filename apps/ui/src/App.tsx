import { useEffect, useState } from "react";
import { loadData } from "./services/native";
import { indexBomByParent, explodeBom } from "./domain/bomExplode";
import { computeMaxBuildable } from "./domain/limitingReagent";
import type { DataSnapshot, SKU } from "./domain/types";

const DATA_DIR = "/home/johed/Forgeable-data"; // your dev path

export default function App() {
  const [snap, setSnap] = useState<DataSnapshot | null>(null);
  const [log, setLog] = useState<string>("Loading...");

  useEffect(() => {
    (async () => {
      try {
        const ds = await loadData(DATA_DIR);
        setSnap(ds);

        const bomByParent = indexBomByParent(ds.bom_items);
        const isAssembly = (sku: SKU) =>
          ds.assemblies.some((a) => a.assemblySku === sku);

        // pick a panel to test
        const panelSku: SKU = "TS2_TYPE01";

        const req1 = explodeBom(panelSku, bomByParent, isAssembly, {
          includeScrap: true,
          minYield: 0.01,
        });

        const buildability = computeMaxBuildable(req1, ds.stock, true);

        const message =
          `Loaded ${ds.assemblies.length} panels, ${ds.parts.length} parts.\n` +
          `Panel tested: ${panelSku}\n` +
          `Requirements per unit: ${JSON.stringify(req1, null, 2)}\n` +
          `Max buildable: ${buildability.maxBuildable}\n` +
          `Limiting: ${buildability.limitingComponents
            .map((l) => l.sku)
            .join(", ")}`;

        console.log(message);
        setLog(message);
      } catch (e: any) {
        console.error(e);
        setLog(String(e));
      }
    })();
  }, []);

  return (
    <div style={{ padding: 16, fontFamily: "Inter, system-ui, sans-serif" }}>
      <h1>Forgeable — Dev Check</h1>
      <pre style={{ whiteSpace: "pre-wrap" }}>{log}</pre>
      <p style={{ opacity: 0.7 }}>
        If you see “Loaded … panels, … parts” and “Max buildable …”, the core
        path works.
      </p>
    </div>
  );
}
