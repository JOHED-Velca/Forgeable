import { useState } from "react";
import { loadData } from "./services/native";
import type { SKU, DataSnapshot } from "./domain/types";
import { indexBomByParent, explodeBom } from "./domain/bomExplode";

export default function App() {
  const [testStatus, setTestStatus] = useState<string>("Ready to load data");
  const [data, setData] = useState<DataSnapshot | null>(null);
  const [selectedAssembly, setSelectedAssembly] = useState<string>("");
  const [bomResults, setBomResults] = useState<Record<string, number> | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);

  const loadDataFromCsv = async () => {
    setIsLoading(true);
    setTestStatus("Loading CSV data...");
    try {
      const DATA_DIR = "/home/johed/Documents/CsvFiles/Forgeable/data";
      const result = await loadData(DATA_DIR);

      setData(result);
      setTestStatus(
        `✅ Loaded ${result.assemblies.length} assemblies, ${result.parts.length} parts, ${result.bom_items.length} BOM items`
      );

      // Auto-select first assembly if available
      if (result.assemblies.length > 0) {
        setSelectedAssembly(result.assemblies[0].assembly_sku);
      }
    } catch (error) {
      console.error("Error loading data:", error);
      setTestStatus(`❌ ERROR: ${String(error)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const explodeBomForAssembly = async () => {
    if (!data || !selectedAssembly) {
      setTestStatus("❌ Please load data and select an assembly first");
      return;
    }

    setIsLoading(true);
    setTestStatus(`Exploding BOM for ${selectedAssembly}...`);
    try {
      const indexed = indexBomByParent(data.bom_items);
      const assemblySkus = new Set(data.assemblies.map((a) => a.assembly_sku));
      const isAssembly = (sku: SKU) => assemblySkus.has(sku);

      const results = explodeBom(selectedAssembly, indexed, isAssembly);
      setBomResults(results);

      const partCount = Object.keys(results).length;
      setTestStatus(`✅ BOM exploded! Found ${partCount} unique parts required`);
    } catch (error) {
      console.error("Error exploding BOM:", error);
      setTestStatus(`❌ BOM Explosion Error: ${String(error)}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        padding: 20,
        fontFamily: "Inter, system-ui, sans-serif",
        maxWidth: 1200,
      }}
    >
      <h1>🔧 Forgeable — Manufacturing BOM Analysis</h1>

      {/* Status Section */}
      <div
        style={{
          background: "#f0f8ff",
          padding: 16,
          borderRadius: 8,
          marginBottom: 20,
        }}
      >
        <h3 style={{ margin: 0, marginBottom: 8, color: "#0066cc" }}>Status</h3>
        <p style={{ margin: 0, fontSize: 14 }}>
          <strong>{testStatus}</strong>
        </p>
      </div>

      {/* Data Loading Section */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #ddd",
          padding: 16,
          borderRadius: 8,
          marginBottom: 20,
        }}
      >
        <h3 style={{ margin: 0, marginBottom: 12 }}>1. Load CSV Data</h3>
        <button
          onClick={loadDataFromCsv}
          disabled={isLoading}
          style={{
            background: data ? "#28a745" : "#007bff",
            color: "white",
            border: "none",
            padding: "10px 20px",
            borderRadius: 6,
            cursor: isLoading ? "not-allowed" : "pointer",
            opacity: isLoading ? 0.6 : 1,
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          {isLoading
            ? "Loading..."
            : data
            ? "✅ Data Loaded - Reload"
            : "Load CSV Data"}
        </button>
      </div>

      {/* Assembly Selection Section */}
      {data && (
        <div
          style={{
            background: "#fff",
            border: "1px solid #ddd",
            padding: 16,
            borderRadius: 8,
            marginBottom: 20,
          }}
        >
          <h3 style={{ margin: 0, marginBottom: 12 }}>2. Select Assembly</h3>
          <div
            style={{
              display: "flex",
              gap: 12,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <select
              value={selectedAssembly}
              onChange={(e) => setSelectedAssembly(e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: 4,
                border: "1px solid #ccc",
                fontSize: 14,
                minWidth: 200,
              }}
            >
              <option value="">Select an assembly...</option>
              {data.assemblies.map((assembly) => (
                <option
                  key={assembly.assembly_sku}
                  value={assembly.assembly_sku}
                >
                  {assembly.assembly_sku} - {assembly.name}
                </option>
              ))}
            </select>

            <button
              onClick={explodeBomForAssembly}
              disabled={!selectedAssembly || isLoading}
              style={{
                background: "#17a2b8",
                color: "white",
                border: "none",
                padding: "8px 16px",
                borderRadius: 4,
                cursor:
                  !selectedAssembly || isLoading ? "not-allowed" : "pointer",
                opacity: !selectedAssembly || isLoading ? 0.6 : 1,
                fontSize: 14,
              }}
            >
              {isLoading ? "Processing..." : "Explode BOM"}
            </button>
          </div>
        </div>
      )}

      {/* Results Section */}
      {bomResults && (
        <div
          style={{
            background: "#fff",
            border: "1px solid #ddd",
            padding: 16,
            borderRadius: 8,
            marginBottom: 20,
          }}
        >
          <h3 style={{ margin: 0, marginBottom: 12 }}>
            3. BOM Explosion Results
          </h3>
          <p style={{ margin: "0 0 12px 0", color: "#666", fontSize: 14 }}>
            Parts required to build 1x {selectedAssembly}:
          </p>

          <div
            style={{
              maxHeight: 400,
              overflowY: "auto",
              border: "1px solid #eee",
              borderRadius: 4,
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f8f9fa" }}>
                  <th
                    style={{
                      padding: "8px 12px",
                      textAlign: "left",
                      borderBottom: "1px solid #dee2e6",
                      fontSize: 14,
                    }}
                  >
                    Part SKU
                  </th>
                  <th
                    style={{
                      padding: "8px 12px",
                      textAlign: "right",
                      borderBottom: "1px solid #dee2e6",
                      fontSize: 14,
                    }}
                  >
                    Quantity Required
                  </th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(bomResults)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([sku, qty]) => (
                    <tr key={sku} style={{ borderBottom: "1px solid #f1f3f4" }}>
                      <td
                        style={{
                          padding: "6px 12px",
                          fontSize: 13,
                          fontFamily: "monospace",
                        }}
                      >
                        {sku}
                      </td>
                      <td
                        style={{
                          padding: "6px 12px",
                          textAlign: "right",
                          fontSize: 13,
                        }}
                      >
                        {qty.toFixed(4)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          <p style={{ margin: "12px 0 0 0", fontSize: 12, color: "#666" }}>
            Total unique parts: {Object.keys(bomResults).length}
          </p>
        </div>
      )}
    </div>
  );
}
