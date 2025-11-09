import { useState } from "react";
import { loadData } from "./services/native";
import type { SKU, DataSnapshot } from "./domain/types";
import { indexBomByParent, explodeBom } from "./domain/bomExplode";

export default function App() {
  const [testStatus, setTestStatus] = useState<string>(
    "Ready to test BOM explosion!"
  );

  console.log("🚀 App component rendered - BOM FUNCTIONS IMPORTED");
  console.log("Functions available:", {
    loadData: typeof loadData,
    indexBomByParent: typeof indexBomByParent,
    explodeBom: typeof explodeBom,
  });

  const testDataLoad = async () => {
    setTestStatus("Testing data loading and BOM explosion...");
    try {
      const DATA_DIR = "/home/johed/Documents/CsvFiles/Forgeable/data";
      const result = await loadData(DATA_DIR);

      console.log("Data loaded successfully:", result);

      // Test BOM explosion functions
      const indexed = indexBomByParent(result.bom_items);
      console.log("BOM indexed:", indexed);

      if (result.assemblies.length > 0) {
        const firstAssembly = result.assemblies[0];
        console.log("First assembly object:", firstAssembly);
        console.log("Assembly keys:", Object.keys(firstAssembly));

        setTestStatus(
          `First assembly data: ${JSON.stringify(firstAssembly, null, 2)}`
        );

        // Check if assembly_sku is defined
        if (!firstAssembly.assembly_sku) {
          setTestStatus(
            `❌ ERROR: First assembly has undefined assembly_sku! Object: ${JSON.stringify(
              firstAssembly
            )}`
          );
          return;
        }

        const assemblySkus = new Set(
          result.assemblies.map((a) => a.assembly_sku)
        );
        const isAssembly = (sku: SKU) => assemblySkus.has(sku);

        setTestStatus(
          `About to explode BOM for: ${firstAssembly.assembly_sku}`
        );

        const exploded = explodeBom(
          firstAssembly.assembly_sku,
          indexed,
          isAssembly
        );
        console.log("BOM exploded:", exploded);

        setTestStatus(
          `✅ SUCCESS! Loaded ${result.assemblies.length} assemblies, BOM explosion works!`
        );
      } else {
        setTestStatus("✅ Data loaded, but no assemblies found");
      }
    } catch (error) {
      console.error("Error:", error);
      setTestStatus(`❌ ERROR: ${String(error)}`);
    }
  };

  return (
    <div style={{ padding: 16, fontFamily: "Inter, system-ui, sans-serif" }}>
      <h1>🔧 Forgeable — Debugging Blank Screen</h1>
      <div
        style={{
          background: "#f0f8ff",
          padding: 16,
          borderRadius: 4,
          marginBottom: 16,
        }}
      >
        <h3 style={{ margin: 0, marginBottom: 8, color: "#0066cc" }}>Status</h3>
        <p style={{ margin: 0 }}>✅ React App is rendering</p>
        <p style={{ margin: 0 }}>✅ React hooks working</p>
        <p style={{ margin: 0 }}>
          Status: <strong>{testStatus}</strong>
        </p>
      </div>
      <button
        onClick={testDataLoad}
        style={{
          background: "#007bff",
          color: "white",
          border: "none",
          padding: "8px 16px",
          borderRadius: 4,
          cursor: "pointer",
        }}
      >
        Test BOM Explosion
      </button>
      <p style={{ opacity: 0.7 }}>
        Testing complete BOM explosion functionality with CSV data...
      </p>
    </div>
  );
}
