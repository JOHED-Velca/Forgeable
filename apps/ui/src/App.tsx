import { useState } from "react";
import { loadData, recordBuild, loadPanelHistory } from "./services/native";
import type {
  SKU,
  DataSnapshot,
  Buildability,
  BuildHistoryRecord,
} from "./domain/types";
import { indexBomByParent, explodeBom } from "./domain/bomExplode";

export default function App() {
  const [testStatus, setTestStatus] = useState<string>("Ready to load data");
  const [data, setData] = useState<DataSnapshot | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string>(
    "/home/johed/Documents/CsvFiles/Forgeable/data"
  );
  const [selectedAssembly, setSelectedAssembly] = useState<string>("");
  const [panelQuantity, setPanelQuantity] = useState<number>(1);
  const [bomResults, setBomResults] = useState<Record<string, number> | null>(
    null
  );
  const [buildability, setBuildability] = useState<Buildability | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Tab management
  const [activeTab, setActiveTab] = useState<
    "analysis" | "inventory" | "record" | "history"
  >("analysis");

  // Build tracking state
  const [buildAssembly, setBuildAssembly] = useState<string>(""); // Separate from selectedAssembly
  const [workOrder, setWorkOrder] = useState<string>("");
  const [salesOrder, setSalesOrder] = useState<string>("");
  const [customer, setCustomer] = useState<string>("");
  const [builtQuantity, setBuiltQuantity] = useState<number>(1);
  const [operator, setOperator] = useState<string>("");
  const [buildNotes, setBuildNotes] = useState<string>("");
  const [isRecordingBuild, setIsRecordingBuild] = useState(false);
  const [panelHistory, setPanelHistory] = useState<BuildHistoryRecord[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Keep existing validation function
  const validateCsvData = (
    data: DataSnapshot
  ): { isValid: boolean; errors: string[]; warnings: string[] } => {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!data.assemblies || data.assemblies.length === 0) {
      errors.push("No assemblies data found");
    }

    if (!data.parts || data.parts.length === 0) {
      errors.push("No parts data found");
    }

    if (!data.bom_items || data.bom_items.length === 0) {
      errors.push("No BOM items data found");
    }

    return { isValid: errors.length === 0, errors, warnings };
  };

  const selectDataFolder = async () => {
    try {
      const folderPath = window.prompt(
        "Please enter the path to your CSV data folder:",
        selectedFolder || "/home/johed/Documents/CsvFiles/Forgeable/data"
      );

      if (folderPath && folderPath.trim()) {
        setSelectedFolder(folderPath.trim());
        setTestStatus(`📁 Folder selected: ${folderPath.trim()}`);
      }
    } catch (error) {
      console.error("Error selecting folder:", error);
      setTestStatus("❌ Error selecting folder");
    }
  };

  const loadDataFromCsv = async () => {
    if (!selectedFolder) {
      setTestStatus("❌ Please select a data folder first");
      return;
    }

    setIsLoading(true);
    setTestStatus("Loading CSV data...");
    try {
      const result = await loadData(selectedFolder);

      if (
        !result ||
        !result.assemblies ||
        !result.parts ||
        !result.bom_items ||
        !result.stock
      ) {
        throw new Error("Invalid data structure received");
      }

      setData(result);
      const validation = validateCsvData(result);

      if (!validation.isValid) {
        setTestStatus(
          `❌ Data validation failed: ${validation.errors.join("; ")}`
        );
        return;
      }

      setTestStatus(
        `✅ Loaded ${result.assemblies.length} assemblies, ${result.parts.length} parts, ${result.bom_items.length} BOM items`
      );

      if (result.assemblies.length > 0) {
        setSelectedAssembly(result.assemblies[0].assembly_sku);
      }
    } catch (error) {
      console.error("Error loading data:", error);
      setTestStatus(
        `❌ Failed to load CSV data: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      setData(null);
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
    setBomResults(null);
    setBuildability(null);

    try {
      const indexed = indexBomByParent(data.bom_items);
      const assemblySkus = new Set(data.assemblies.map((a) => a.assembly_sku));
      const isAssembly = (sku: SKU) => assemblySkus.has(sku);
      const results = explodeBom(selectedAssembly, indexed, isAssembly);

      if (!results || Object.keys(results).length === 0) {
        setTestStatus(
          `❌ BOM explosion returned no results for ${selectedAssembly}`
        );
        return;
      }

      const multipliedResults: Record<string, number> = {};
      for (const [sku, qty] of Object.entries(results)) {
        multipliedResults[sku] = qty * panelQuantity;
      }

      setBomResults(multipliedResults);

      if (data.stock && data.stock.length > 0) {
        const stockMap = new Map<string, number>();
        for (const stockItem of data.stock) {
          const available = stockItem.on_hand_qty - stockItem.reserved_qty;
          stockMap.set(stockItem.sku, Math.max(0, available));
        }

        const limitingComponents: Array<{
          sku: string;
          available: number;
          reqPerUnit: number;
          candidateBuilds: number;
        }> = [];

        let canBuildRequested = true;
        let maxPossible = Number.POSITIVE_INFINITY;

        for (const [sku, totalNeeded] of Object.entries(multipliedResults)) {
          const available = stockMap.get(sku) || 0;
          const reqPerUnit = totalNeeded / panelQuantity;
          const candidateBuilds = Math.floor(available / reqPerUnit);
          const shortage = Math.max(0, totalNeeded - available);

          if (shortage > 0) {
            canBuildRequested = false;
          }

          limitingComponents.push({
            sku,
            available,
            reqPerUnit,
            candidateBuilds,
          });

          if (candidateBuilds < maxPossible) {
            maxPossible = candidateBuilds;
          }
        }

        if (!isFinite(maxPossible)) maxPossible = 0;

        limitingComponents.sort(
          (a, b) => a.candidateBuilds - b.candidateBuilds
        );

        setBuildability({
          maxBuildable: canBuildRequested ? panelQuantity : maxPossible,
          limitingComponents: limitingComponents.slice(0, 10),
        });
      }

      setTestStatus(
        `✅ Analysis complete! Found ${
          Object.keys(multipliedResults).length
        } parts required`
      );
    } catch (error) {
      console.error("Error in analysis:", error);
      setTestStatus(
        `❌ Analysis failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleRecordBuild = async () => {
    if (!data || !selectedFolder || !buildAssembly) {
      setTestStatus("❌ Please load data and select assembly to build first");
      return;
    }

    if (!workOrder.trim() || !salesOrder.trim() || !customer.trim()) {
      setTestStatus("❌ Please fill in all required fields");
      return;
    }

    setIsRecordingBuild(true);
    try {
      const buildRecord = {
        work_order: workOrder.trim(),
        sales_order: salesOrder.trim(),
        customer: customer.trim(),
        assembly_sku: buildAssembly,
        quantity_built: builtQuantity,
        operator: operator.trim() || undefined,
        notes: buildNotes.trim() || undefined,
      };

      const updatedData = await recordBuild(selectedFolder, buildRecord);
      setData(updatedData);

      // Clear form
      setWorkOrder("");
      setSalesOrder("");
      setCustomer("");
      setBuildAssembly("");
      setBuiltQuantity(1);
      setOperator("");
      setBuildNotes("");

      setTestStatus(
        `✅ Build recorded! ${builtQuantity} units of ${buildAssembly} completed`
      );
    } catch (error) {
      setTestStatus(
        `❌ Failed to record build: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    } finally {
      setIsRecordingBuild(false);
    }
  };

  const loadPanelHistoryData = async () => {
    if (!selectedFolder) {
      setTestStatus("❌ Please select a data folder first");
      return;
    }

    setIsLoadingHistory(true);
    try {
      const history = await loadPanelHistory(selectedFolder);
      setPanelHistory(history);
      setTestStatus(`✅ Panel history loaded: ${history.length} records found`);
    } catch (error) {
      setTestStatus(
        `❌ Failed to load panel history: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      setPanelHistory([]);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  return (
    <div
      style={{
        padding: 20,
        fontFamily: "Inter, system-ui, sans-serif",
        maxWidth: 1200,
        margin: "0 auto",
        width: "100%",
        textAlign: "center",
      }}
    >
      <h1>🔧 Forgeable</h1>

      {/* Tab Navigation */}
      <div
        style={{
          borderBottom: "2px solid #dee2e6",
          marginBottom: 20,
          textAlign: "left",
        }}
      >
        <div style={{ display: "flex", gap: 0 }}>
          <button
            onClick={() => setActiveTab("analysis")}
            style={{
              background: activeTab === "analysis" ? "#007bff" : "transparent",
              color: activeTab === "analysis" ? "white" : "#007bff",
              border: "none",
              padding: "12px 24px",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              borderRadius: "8px 8px 0 0",
              borderBottom:
                activeTab === "analysis" ? "2px solid #007bff" : "none",
              marginBottom: activeTab === "analysis" ? "-2px" : "0",
            }}
          >
            🔧 Analysis
          </button>
          <button
            onClick={() => setActiveTab("inventory")}
            style={{
              background: activeTab === "inventory" ? "#007bff" : "transparent",
              color: activeTab === "inventory" ? "white" : "#007bff",
              border: "none",
              padding: "12px 24px",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              borderRadius: "8px 8px 0 0",
              borderBottom:
                activeTab === "inventory" ? "2px solid #007bff" : "none",
              marginBottom: activeTab === "inventory" ? "-2px" : "0",
            }}
          >
            📦 Inventory
          </button>
          <button
            onClick={() => setActiveTab("record")}
            style={{
              background: activeTab === "record" ? "#007bff" : "transparent",
              color: activeTab === "record" ? "white" : "#007bff",
              border: "none",
              padding: "12px 24px",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              borderRadius: "8px 8px 0 0",
              borderBottom:
                activeTab === "record" ? "2px solid #007bff" : "none",
              marginBottom: activeTab === "record" ? "-2px" : "0",
            }}
          >
            📝 Record Build
          </button>
          <button
            onClick={() => setActiveTab("history")}
            style={{
              background: activeTab === "history" ? "#007bff" : "transparent",
              color: activeTab === "history" ? "white" : "#007bff",
              border: "none",
              padding: "12px 24px",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              borderRadius: "8px 8px 0 0",
              borderBottom:
                activeTab === "history" ? "2px solid #007bff" : "none",
              marginBottom: activeTab === "history" ? "-2px" : "0",
            }}
          >
            📈 History
          </button>
        </div>
      </div>

      {/* Status Section - Always visible */}
      <div
        style={{
          background: "#f0f8ff",
          padding: 16,
          borderRadius: 8,
          marginBottom: 20,
          textAlign: "left",
        }}
      >
        <h3 style={{ margin: 0, marginBottom: 8, color: "#0066cc" }}>Status</h3>
        <p style={{ margin: 0, fontSize: 14, whiteSpace: "pre-line" }}>
          <strong>{testStatus}</strong>
        </p>
      </div>

      {/* Data Loading Section - Always visible */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #ddd",
          padding: 16,
          borderRadius: 8,
          marginBottom: 20,
          textAlign: "left",
        }}
      >
        <h3 style={{ margin: 0, marginBottom: 12 }}>1. Load CSV Data</h3>
        <div style={{ marginBottom: 12 }}>
          <button
            onClick={selectDataFolder}
            style={{
              background: selectedFolder ? "#28a745" : "#6c757d",
              color: "white",
              border: "none",
              padding: "8px 16px",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 14,
              marginRight: 8,
            }}
          >
            📁 {selectedFolder ? "Change Folder" : "Select Data Folder"}
          </button>
          {selectedFolder && (
            <span style={{ fontSize: 12, color: "#666" }}>
              📂 {selectedFolder}
            </span>
          )}
        </div>
        <button
          onClick={loadDataFromCsv}
          disabled={isLoading || !selectedFolder}
          style={{
            background: data ? "#28a745" : "#007bff",
            color: "white",
            border: "none",
            padding: "10px 20px",
            borderRadius: 6,
            cursor: isLoading || !selectedFolder ? "not-allowed" : "pointer",
            opacity: isLoading || !selectedFolder ? 0.6 : 1,
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

      {/* Analysis Tab */}
      <div
        style={{
          display: activeTab === "analysis" ? "block" : "none",
          textAlign: "left",
        }}
      >
        {data && (
          <>
            {/* Assembly Selection */}
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
                2. Select Assembly
              </h3>
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
                    minWidth: 200,
                    fontSize: 14,
                  }}
                >
                  <option value="">Select a panel...</option>
                  {data.assemblies.map((assembly) => (
                    <option
                      key={assembly.assembly_sku}
                      value={assembly.assembly_sku}
                    >
                      {assembly.name} ({assembly.assembly_sku})
                    </option>
                  ))}
                </select>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <label
                    style={{ fontSize: 14, fontWeight: 500, color: "#333" }}
                  >
                    Quantity:
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={panelQuantity}
                    onChange={(e) =>
                      setPanelQuantity(parseInt(e.target.value) || 1)
                    }
                    style={{
                      width: 80,
                      padding: "6px 8px",
                      border: "1px solid #ccc",
                      borderRadius: 4,
                      textAlign: "center",
                      fontSize: 14,
                    }}
                  />
                  <span style={{ fontSize: 12, color: "#666" }}>panels</span>
                </div>

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
                      !selectedAssembly || isLoading
                        ? "not-allowed"
                        : "pointer",
                    opacity: !selectedAssembly || isLoading ? 0.6 : 1,
                    fontSize: 14,
                  }}
                >
                  {isLoading ? "Analyzing..." : "Analyze Panel"}
                </button>
              </div>
            </div>

            {/* Results */}
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
                  Parts Required for {panelQuantity} × {selectedAssembly}
                </h3>
                <div style={{ overflow: "auto", maxHeight: 300 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#f8f9fa" }}>
                        <th
                          style={{
                            padding: "8px 12px",
                            textAlign: "left",
                            borderBottom: "1px solid #dee2e6",
                            fontSize: 12,
                          }}
                        >
                          Part SKU
                        </th>
                        <th
                          style={{
                            padding: "8px 12px",
                            textAlign: "right",
                            borderBottom: "1px solid #dee2e6",
                            fontSize: 12,
                          }}
                        >
                          Quantity Needed
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(bomResults)
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([sku, qty]) => (
                          <tr
                            key={sku}
                            style={{ borderBottom: "1px solid #f1f3f4" }}
                          >
                            <td
                              style={{
                                padding: "6px 12px",
                                fontSize: 12,
                                fontFamily: "monospace",
                              }}
                            >
                              {sku}
                            </td>
                            <td
                              style={{
                                padding: "6px 12px",
                                textAlign: "right",
                                fontSize: 12,
                              }}
                            >
                              {Math.round(qty)}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Buildability */}
            {buildability && (
              <div
                style={{
                  background: "#fff",
                  border: "1px solid #ddd",
                  padding: 16,
                  borderRadius: 8,
                }}
              >
                <h3 style={{ margin: 0, marginBottom: 12, color: "#333" }}>
                  Buildability Analysis
                </h3>
                <div
                  style={{
                    padding: 12,
                    borderRadius: 6,
                    marginBottom: 16,
                    background:
                      buildability.maxBuildable >= panelQuantity
                        ? "#d4edda"
                        : "#f8d7da",
                    color:
                      buildability.maxBuildable >= panelQuantity
                        ? "#155724"
                        : "#721c24",
                  }}
                >
                  <strong>
                    {buildability.maxBuildable >= panelQuantity
                      ? `✅ Can build requested ${panelQuantity} panels`
                      : `❌ Cannot build ${panelQuantity} panels - insufficient stock`}
                  </strong>
                </div>
                <h4 style={{ margin: "0 0 8px 0", fontSize: 14 }}>
                  Limiting Components:
                </h4>
                <div style={{ overflow: "auto", maxHeight: 300 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#f8f9fa" }}>
                        <th
                          style={{
                            padding: "8px 12px",
                            textAlign: "left",
                            borderBottom: "1px solid #dee2e6",
                            fontSize: 12,
                          }}
                        >
                          Part SKU
                        </th>
                        <th
                          style={{
                            padding: "8px 12px",
                            textAlign: "right",
                            borderBottom: "1px solid #dee2e6",
                            fontSize: 12,
                          }}
                        >
                          Available
                        </th>
                        <th
                          style={{
                            padding: "8px 12px",
                            textAlign: "right",
                            borderBottom: "1px solid #dee2e6",
                            fontSize: 12,
                          }}
                        >
                          Required/Unit
                        </th>
                        <th
                          style={{
                            padding: "8px 12px",
                            textAlign: "right",
                            borderBottom: "1px solid #dee2e6",
                            fontSize: 12,
                          }}
                        >
                          Total Needed
                        </th>
                        <th
                          style={{
                            padding: "8px 12px",
                            textAlign: "right",
                            borderBottom: "1px solid #dee2e6",
                            fontSize: 12,
                          }}
                        >
                          Shortage
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {buildability.limitingComponents.map((component) => (
                        <tr
                          key={component.sku}
                          style={{ borderBottom: "1px solid #f1f3f4" }}
                        >
                          <td
                            style={{
                              padding: "6px 12px",
                              fontSize: 12,
                              fontFamily: "monospace",
                            }}
                          >
                            {component.sku}
                          </td>
                          <td
                            style={{
                              padding: "6px 12px",
                              textAlign: "right",
                              fontSize: 12,
                            }}
                          >
                            {Math.round(component.available)}
                          </td>
                          <td
                            style={{
                              padding: "6px 12px",
                              textAlign: "right",
                              fontSize: 12,
                            }}
                          >
                            {component.reqPerUnit.toFixed(4)}
                          </td>
                          <td
                            style={{
                              padding: "6px 12px",
                              textAlign: "right",
                              fontSize: 12,
                            }}
                          >
                            {Math.round(component.reqPerUnit * panelQuantity)}
                          </td>
                          <td
                            style={{
                              padding: "6px 12px",
                              textAlign: "right",
                              fontSize: 12,
                              background:
                                component.reqPerUnit * panelQuantity >
                                component.available
                                  ? "#ffebee"
                                  : "transparent",
                              color:
                                component.reqPerUnit * panelQuantity >
                                component.available
                                  ? "#c62828"
                                  : "inherit",
                            }}
                          >
                            {Math.max(
                              0,
                              Math.round(
                                component.reqPerUnit * panelQuantity -
                                  component.available
                              )
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Inventory Tab */}
      <div
        style={{
          display: activeTab === "inventory" ? "block" : "none",
          textAlign: "left",
        }}
      >
        <h2 style={{ margin: "0 0 20px 0" }}>📦 Inventory Management</h2>

        {/* Stock Levels Section */}
        {data && data.stock && data.stock.length > 0 && (
          <div
            style={{
              background: "#fff",
              border: "1px solid #ddd",
              borderRadius: 8,
              padding: 20,
              margin: "20px 0",
            }}
          >
            <h3 style={{ margin: "0 0 16px 0", color: "#333" }}>
              📊 Current Stock Levels
            </h3>
            <div style={{ overflow: "auto", maxHeight: 400 }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f8f9fa" }}>
                    <th
                      style={{
                        padding: "10px 12px",
                        textAlign: "left",
                        borderBottom: "2px solid #dee2e6",
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      Part SKU
                    </th>
                    <th
                      style={{
                        padding: "10px 12px",
                        textAlign: "right",
                        borderBottom: "2px solid #dee2e6",
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      On Hand
                    </th>
                    <th
                      style={{
                        padding: "10px 12px",
                        textAlign: "right",
                        borderBottom: "2px solid #dee2e6",
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      Reserved
                    </th>
                    <th
                      style={{
                        padding: "10px 12px",
                        textAlign: "right",
                        borderBottom: "2px solid #dee2e6",
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      Available
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.stock
                    .slice()
                    .sort((a, b) => a.sku.localeCompare(b.sku))
                    .map((stockItem) => {
                      const available =
                        stockItem.on_hand_qty - stockItem.reserved_qty;
                      const isLowStock = available <= 0;

                      return (
                        <tr
                          key={stockItem.sku}
                          style={{
                            borderBottom: "1px solid #f1f3f4",
                            background: isLowStock ? "#fff5f5" : "transparent",
                          }}
                        >
                          <td
                            style={{
                              padding: "8px 12px",
                              fontSize: 12,
                              fontFamily: "monospace",
                            }}
                          >
                            {stockItem.sku}
                          </td>
                          <td
                            style={{
                              padding: "8px 12px",
                              textAlign: "right",
                              fontSize: 12,
                            }}
                          >
                            {stockItem.on_hand_qty}
                          </td>
                          <td
                            style={{
                              padding: "8px 12px",
                              textAlign: "right",
                              fontSize: 12,
                            }}
                          >
                            {stockItem.reserved_qty}
                          </td>
                          <td
                            style={{
                              padding: "8px 12px",
                              textAlign: "right",
                              fontSize: 12,
                              fontWeight: 600,
                              color: isLowStock ? "#dc3545" : "#28a745",
                            }}
                          >
                            {Math.max(0, available)}
                            {isLowStock && " ⚠️"}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: "12px", fontSize: "12px", color: "#666" }}>
              ⚠️ indicates low or out-of-stock items. Available = On Hand -
              Reserved.
            </div>
          </div>
        )}
      </div>

      {/* Record Build Tab */}
      <div
        style={{
          display: activeTab === "record" ? "block" : "none",
          textAlign: "left",
        }}
      >
        <h2 style={{ margin: "0 0 20px 0" }}>📝 Record Panel Build</h2>

        {data && (
          <div
            style={{
              background: "#f9f9f9",
              border: "1px solid #ddd",
              borderRadius: 8,
              padding: 20,
              margin: "20px 0",
              maxWidth: 800,
            }}
          >
            <h3 style={{ margin: "0 0 16px 0", color: "#333" }}>
              📋 Build Recording Form
            </h3>
            <p style={{ margin: "0 0 20px 0", color: "#666", fontSize: 14 }}>
              Record a completed panel build to update inventory levels
              automatically.
            </p>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
                gap: "16px",
                marginBottom: "16px",
              }}
            >
              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: "4px",
                    fontWeight: "600",
                    fontSize: "14px",
                  }}
                >
                  Panel Type *
                </label>
                <select
                  value={buildAssembly}
                  onChange={(e) => setBuildAssembly(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: "1px solid #ddd",
                    borderRadius: "4px",
                    fontSize: "14px",
                  }}
                >
                  <option value="">Select panel to build...</option>
                  {data.assemblies.map((assembly) => (
                    <option
                      key={assembly.assembly_sku}
                      value={assembly.assembly_sku}
                    >
                      {assembly.name} ({assembly.assembly_sku})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: "4px",
                    fontWeight: "600",
                    fontSize: "14px",
                  }}
                >
                  Work Order *
                </label>
                <input
                  type="text"
                  value={workOrder}
                  onChange={(e) => setWorkOrder(e.target.value)}
                  placeholder="e.g., WO#23898"
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: "1px solid #ddd",
                    borderRadius: "4px",
                    fontSize: "14px",
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: "4px",
                    fontWeight: "600",
                    fontSize: "14px",
                  }}
                >
                  Sales Order *
                </label>
                <input
                  type="text"
                  value={salesOrder}
                  onChange={(e) => setSalesOrder(e.target.value)}
                  placeholder="e.g., SO#23709"
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: "1px solid #ddd",
                    borderRadius: "4px",
                    fontSize: "14px",
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: "4px",
                    fontWeight: "600",
                    fontSize: "14px",
                  }}
                >
                  Customer *
                </label>
                <input
                  type="text"
                  value={customer}
                  onChange={(e) => setCustomer(e.target.value)}
                  placeholder="e.g., TDH, BEACON, City of Toronto"
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: "1px solid #ddd",
                    borderRadius: "4px",
                    fontSize: "14px",
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: "4px",
                    fontWeight: "600",
                    fontSize: "14px",
                  }}
                >
                  Quantity Built *
                </label>
                <input
                  type="number"
                  value={builtQuantity}
                  onChange={(e) =>
                    setBuiltQuantity(parseInt(e.target.value) || 1)
                  }
                  min="1"
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: "1px solid #ddd",
                    borderRadius: "4px",
                    fontSize: "14px",
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: "4px",
                    fontWeight: "600",
                    fontSize: "14px",
                  }}
                >
                  Operator
                </label>
                <input
                  type="text"
                  value={operator}
                  onChange={(e) => setOperator(e.target.value)}
                  placeholder="Optional"
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: "1px solid #ddd",
                    borderRadius: "4px",
                    fontSize: "14px",
                  }}
                />
              </div>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "4px",
                  fontWeight: "600",
                  fontSize: "14px",
                }}
              >
                Notes
              </label>
              <textarea
                value={buildNotes}
                onChange={(e) => setBuildNotes(e.target.value)}
                placeholder="Optional build notes..."
                rows={3}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  fontSize: "14px",
                  resize: "vertical",
                }}
              />
            </div>

            <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
              <button
                onClick={handleRecordBuild}
                disabled={isRecordingBuild || !buildAssembly}
                style={{
                  background:
                    isRecordingBuild || !buildAssembly ? "#ccc" : "#28a745",
                  color: "white",
                  border: "none",
                  borderRadius: 6,
                  padding: "12px 24px",
                  fontSize: 16,
                  fontWeight: 600,
                  cursor:
                    isRecordingBuild || !buildAssembly
                      ? "not-allowed"
                      : "pointer",
                  transition: "background-color 0.2s",
                }}
              >
                {isRecordingBuild
                  ? "Recording..."
                  : buildAssembly
                  ? `Record Build: ${builtQuantity} × ${buildAssembly}`
                  : "Select panel type to record build"}
              </button>

              <span style={{ fontSize: "12px", color: "#666" }}>
                This will update inventory levels automatically
              </span>
            </div>
          </div>
        )}

        {data && !data.assemblies?.length && (
          <div
            style={{
              background: "#fff3cd",
              border: "1px solid #ffeaa7",
              borderRadius: 8,
              padding: 16,
              margin: "20px 0",
            }}
          >
            <p style={{ margin: 0, color: "#856404" }}>
              ⚠️ Please load CSV data first to access the build recording form.
            </p>
          </div>
        )}
      </div>

      {/* History Tab */}
      <div
        style={{
          display: activeTab === "history" ? "block" : "none",
          textAlign: "left",
        }}
      >
        <h2 style={{ margin: "0 0 20px 0" }}>📈 Panel Build History</h2>

        {/* Build History Section from CSV data */}
        {data && data.build_history && data.build_history.length > 0 && (
          <div
            style={{
              background: "#fff",
              border: "1px solid #ddd",
              borderRadius: 8,
              padding: 20,
              margin: "20px 0",
            }}
          >
            <h3 style={{ margin: "0 0 16px 0", color: "#333" }}>
              📋 Recent Build History
            </h3>
            <div style={{ overflow: "auto", maxHeight: 400 }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f8f9fa" }}>
                    <th
                      style={{
                        padding: "10px 12px",
                        textAlign: "left",
                        borderBottom: "2px solid #dee2e6",
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      Date/Time
                    </th>
                    <th
                      style={{
                        padding: "10px 12px",
                        textAlign: "left",
                        borderBottom: "2px solid #dee2e6",
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      Panel Type
                    </th>
                    <th
                      style={{
                        padding: "10px 12px",
                        textAlign: "right",
                        borderBottom: "2px solid #dee2e6",
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      Qty
                    </th>
                    <th
                      style={{
                        padding: "10px 12px",
                        textAlign: "left",
                        borderBottom: "2px solid #dee2e6",
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      Work Order
                    </th>
                    <th
                      style={{
                        padding: "10px 12px",
                        textAlign: "left",
                        borderBottom: "2px solid #dee2e6",
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      Sales Order
                    </th>
                    <th
                      style={{
                        padding: "10px 12px",
                        textAlign: "left",
                        borderBottom: "2px solid #dee2e6",
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      Customer
                    </th>
                    <th
                      style={{
                        padding: "10px 12px",
                        textAlign: "left",
                        borderBottom: "2px solid #dee2e6",
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      Operator
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.build_history
                    .slice()
                    .sort(
                      (a, b) =>
                        new Date(b.timestamp).getTime() -
                        new Date(a.timestamp).getTime()
                    )
                    .slice(0, 20)
                    .map((record) => (
                      <tr
                        key={record.id}
                        style={{
                          borderBottom: "1px solid #f1f3f4",
                        }}
                      >
                        <td
                          style={{
                            padding: "8px 12px",
                            fontSize: 11,
                            fontFamily: "monospace",
                          }}
                        >
                          {new Date(record.timestamp).toLocaleString()}
                        </td>
                        <td
                          style={{
                            padding: "8px 12px",
                            fontSize: 12,
                            fontFamily: "monospace",
                            fontWeight: 500,
                          }}
                        >
                          {record.assembly_sku}
                        </td>
                        <td
                          style={{
                            padding: "8px 12px",
                            textAlign: "right",
                            fontSize: 12,
                            fontWeight: 600,
                          }}
                        >
                          {record.quantity_built}
                        </td>
                        <td
                          style={{
                            padding: "8px 12px",
                            fontSize: 11,
                          }}
                        >
                          {record.work_order}
                        </td>
                        <td
                          style={{
                            padding: "8px 12px",
                            fontSize: 11,
                          }}
                        >
                          {record.sales_order}
                        </td>
                        <td
                          style={{
                            padding: "8px 12px",
                            fontSize: 12,
                          }}
                        >
                          {record.customer}
                        </td>
                        <td
                          style={{
                            padding: "8px 12px",
                            fontSize: 11,
                            color: "#666",
                          }}
                        >
                          {record.operator || "-"}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: "12px", fontSize: "12px", color: "#666" }}>
              Showing last 20 builds from loaded CSV data.
            </div>
          </div>
        )}

        {/* Assembly Production Summary */}
        {data && data.build_history && data.build_history.length > 0 && (
          <div
            style={{
              background: "#fff",
              border: "1px solid #ddd",
              borderRadius: 8,
              padding: 20,
              margin: "20px 0",
            }}
          >
            <h3 style={{ margin: "0 0 16px 0", color: "#333" }}>
              🏭 Panel Production Summary
            </h3>
            <div style={{ overflow: "auto", maxHeight: 400 }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f8f9fa" }}>
                    <th
                      style={{
                        padding: "10px 12px",
                        textAlign: "left",
                        borderBottom: "2px solid #dee2e6",
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      Panel Type
                    </th>
                    <th
                      style={{
                        padding: "10px 12px",
                        textAlign: "left",
                        borderBottom: "2px solid #dee2e6",
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      Panel Name
                    </th>
                    <th
                      style={{
                        padding: "10px 12px",
                        textAlign: "right",
                        borderBottom: "2px solid #dee2e6",
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      Total Built
                    </th>
                    <th
                      style={{
                        padding: "10px 12px",
                        textAlign: "right",
                        borderBottom: "2px solid #dee2e6",
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      Builds
                    </th>
                    <th
                      style={{
                        padding: "10px 12px",
                        textAlign: "left",
                        borderBottom: "2px solid #dee2e6",
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      Last Built
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    // Group builds by assembly_sku and calculate totals
                    const assemblyStats = new Map<
                      string,
                      {
                        totalQuantity: number;
                        buildCount: number;
                        lastBuild: string;
                        name: string;
                      }
                    >();

                    // Process build history
                    data.build_history.forEach((record) => {
                      const existing = assemblyStats.get(record.assembly_sku);
                      const recordDate = new Date(record.timestamp);

                      if (existing) {
                        existing.totalQuantity += record.quantity_built;
                        existing.buildCount += 1;
                        const existingDate = new Date(existing.lastBuild);
                        if (recordDate > existingDate) {
                          existing.lastBuild = record.timestamp;
                        }
                      } else {
                        // Find assembly name
                        const assembly = data.assemblies.find(
                          (a) => a.assembly_sku === record.assembly_sku
                        );
                        assemblyStats.set(record.assembly_sku, {
                          totalQuantity: record.quantity_built,
                          buildCount: 1,
                          lastBuild: record.timestamp,
                          name: assembly?.name || record.assembly_sku,
                        });
                      }
                    });

                    // Convert to array and sort by total quantity (highest first)
                    return Array.from(assemblyStats.entries())
                      .sort(([, a], [, b]) => b.totalQuantity - a.totalQuantity)
                      .map(([assemblySku, stats]) => (
                        <tr
                          key={assemblySku}
                          style={{
                            borderBottom: "1px solid #f1f3f4",
                          }}
                        >
                          <td
                            style={{
                              padding: "8px 12px",
                              fontSize: 12,
                              fontFamily: "monospace",
                              fontWeight: 600,
                            }}
                          >
                            {assemblySku}
                          </td>
                          <td
                            style={{
                              padding: "8px 12px",
                              fontSize: 12,
                            }}
                          >
                            {stats.name}
                          </td>
                          <td
                            style={{
                              padding: "8px 12px",
                              textAlign: "right",
                              fontSize: 12,
                              fontWeight: 600,
                              color: "#28a745",
                            }}
                          >
                            {stats.totalQuantity}
                          </td>
                          <td
                            style={{
                              padding: "8px 12px",
                              textAlign: "right",
                              fontSize: 12,
                              color: "#666",
                            }}
                          >
                            {stats.buildCount}
                          </td>
                          <td
                            style={{
                              padding: "8px 12px",
                              fontSize: 11,
                              color: "#666",
                            }}
                          >
                            {new Date(stats.lastBuild).toLocaleDateString()}
                          </td>
                        </tr>
                      ));
                  })()}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: "12px", fontSize: "12px", color: "#666" }}>
              Summary of all panel types built from production history. Sorted
              by total quantity produced.
            </div>
          </div>
        )}

        <div
          style={{
            background: "#f9f9f9",
            border: "1px solid #ddd",
            borderRadius: 8,
            padding: 20,
            margin: "20px 0",
          }}
        >
          <h3 style={{ margin: "0 0 16px 0", color: "#333" }}>
            📋 Load Panel History from File
          </h3>
          <p style={{ margin: "0 0 16px 0", color: "#666", fontSize: 14 }}>
            Load and view the complete build history from the panel_history.csv
            file.
          </p>

          <button
            onClick={loadPanelHistoryData}
            disabled={isLoadingHistory || !selectedFolder}
            style={{
              background: !selectedFolder
                ? "#6c757d"
                : isLoadingHistory
                ? "#ccc"
                : "#007bff",
              color: "white",
              border: "none",
              padding: "12px 24px",
              borderRadius: 6,
              cursor:
                !selectedFolder || isLoadingHistory ? "not-allowed" : "pointer",
              fontSize: 14,
              fontWeight: 600,
              marginBottom: 16,
            }}
          >
            {isLoadingHistory ? "Loading..." : "Load Panel History"}
          </button>

          {!selectedFolder && (
            <p style={{ margin: "8px 0 0 0", color: "#dc3545", fontSize: 12 }}>
              Please select a data folder first
            </p>
          )}
        </div>

        {panelHistory.length > 0 && (
          <div
            style={{
              background: "#fff",
              border: "1px solid #ddd",
              borderRadius: 8,
              padding: 20,
              margin: "20px 0",
            }}
          >
            <h3 style={{ margin: "0 0 16px 0", color: "#333" }}>
              📊 Complete Build History ({panelHistory.length} records)
            </h3>
            <div style={{ overflow: "auto", maxHeight: 600 }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f8f9fa" }}>
                    <th
                      style={{
                        padding: "12px 8px",
                        textAlign: "left",
                        borderBottom: "2px solid #dee2e6",
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      Date/Time
                    </th>
                    <th
                      style={{
                        padding: "12px 8px",
                        textAlign: "left",
                        borderBottom: "2px solid #dee2e6",
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      Panel Type
                    </th>
                    <th
                      style={{
                        padding: "12px 8px",
                        textAlign: "right",
                        borderBottom: "2px solid #dee2e6",
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      Qty
                    </th>
                    <th
                      style={{
                        padding: "12px 8px",
                        textAlign: "left",
                        borderBottom: "2px solid #dee2e6",
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      Work Order
                    </th>
                    <th
                      style={{
                        padding: "12px 8px",
                        textAlign: "left",
                        borderBottom: "2px solid #dee2e6",
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      Sales Order
                    </th>
                    <th
                      style={{
                        padding: "12px 8px",
                        textAlign: "left",
                        borderBottom: "2px solid #dee2e6",
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      Customer
                    </th>
                    <th
                      style={{
                        padding: "12px 8px",
                        textAlign: "left",
                        borderBottom: "2px solid #dee2e6",
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      Operator
                    </th>
                    <th
                      style={{
                        padding: "12px 8px",
                        textAlign: "left",
                        borderBottom: "2px solid #dee2e6",
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      Notes
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {panelHistory
                    .slice()
                    .sort(
                      (a, b) =>
                        new Date(b.timestamp).getTime() -
                        new Date(a.timestamp).getTime()
                    )
                    .map((record) => (
                      <tr
                        key={record.id}
                        style={{
                          borderBottom: "1px solid #f1f3f4",
                        }}
                      >
                        <td
                          style={{
                            padding: "8px",
                            fontSize: 11,
                            fontFamily: "monospace",
                          }}
                        >
                          {new Date(record.timestamp).toLocaleString()}
                        </td>
                        <td
                          style={{
                            padding: "8px",
                            fontSize: 12,
                            fontFamily: "monospace",
                            fontWeight: 500,
                          }}
                        >
                          {record.assembly_sku}
                        </td>
                        <td
                          style={{
                            padding: "8px",
                            textAlign: "right",
                            fontSize: 12,
                            fontWeight: 600,
                            color: "#28a745",
                          }}
                        >
                          {record.quantity_built}
                        </td>
                        <td
                          style={{
                            padding: "8px",
                            fontSize: 11,
                          }}
                        >
                          {record.work_order}
                        </td>
                        <td
                          style={{
                            padding: "8px",
                            fontSize: 11,
                          }}
                        >
                          {record.sales_order}
                        </td>
                        <td
                          style={{
                            padding: "8px",
                            fontSize: 12,
                          }}
                        >
                          {record.customer}
                        </td>
                        <td
                          style={{
                            padding: "8px",
                            fontSize: 11,
                            color: "#666",
                          }}
                        >
                          {record.operator || "-"}
                        </td>
                        <td
                          style={{
                            padding: "8px",
                            fontSize: 11,
                            color: "#666",
                            maxWidth: 200,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {record.notes || "-"}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: "12px", fontSize: "12px", color: "#666" }}>
              Complete build history sorted by most recent first. Data from
              panel_history.csv file.
            </div>
          </div>
        )}

        {panelHistory.length === 0 && selectedFolder && (
          <div
            style={{
              background: "#fff3cd",
              border: "1px solid #ffeaa7",
              borderRadius: 8,
              padding: 16,
              margin: "20px 0",
            }}
          >
            <p style={{ margin: 0, color: "#856404" }}>
              📝 No panel build history found. Build some panels first using the
              Record Build tab to see history here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
