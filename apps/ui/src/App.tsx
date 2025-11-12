import { useState } from "react";
import { loadData } from "./services/native";
import type { SKU, DataSnapshot, Buildability } from "./domain/types";
import { indexBomByParent, explodeBom } from "./domain/bomExplode";
import { computeMaxBuildable } from "./domain/limitingReagent";

export default function App() {
  const [testStatus, setTestStatus] = useState<string>("Ready to load data");
  const [data, setData] = useState<DataSnapshot | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string>(
    "C:\\Users\\johed\\OneDrive\\Documents\\Forgeable\\data"
  );
  const [selectedAssembly, setSelectedAssembly] = useState<string>("");
  const [panelQuantity, setPanelQuantity] = useState<number>(1);
  const [bomResults, setBomResults] = useState<Record<string, number> | null>(
    null
  );
  const [buildability, setBuildability] = useState<Buildability | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // CSV Data validation function
  const validateCsvData = (
    data: DataSnapshot
  ): { isValid: boolean; errors: string[]; warnings: string[] } => {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check assemblies data
    if (!data.assemblies || data.assemblies.length === 0) {
      errors.push("No assemblies data found");
    } else {
      // Check required fields in assemblies
      const invalidAssemblies = data.assemblies.filter(
        (a: any) =>
          !a.assembly_sku ||
          typeof a.assembly_sku !== "string" ||
          a.assembly_sku.trim() === ""
      );
      if (invalidAssemblies.length > 0) {
        errors.push(
          `${invalidAssemblies.length} assemblies have missing or invalid assembly_sku`
        );
      }

      // Check for duplicate assembly SKUs
      const assemblySkus = data.assemblies.map((a: any) => a.assembly_sku);
      const duplicateSkus = assemblySkus.filter(
        (sku: any, index: number) => assemblySkus.indexOf(sku) !== index
      );
      if (duplicateSkus.length > 0) {
        warnings.push(
          `Duplicate assembly SKUs found: ${[...new Set(duplicateSkus)].join(
            ", "
          )}`
        );
      }
    }

    // Check parts data
    if (!data.parts || data.parts.length === 0) {
      errors.push("No parts data found");
    } else {
      // Check required fields in parts
      const invalidParts = data.parts.filter(
        (p: any) =>
          !p.part_sku ||
          typeof p.part_sku !== "string" ||
          p.part_sku.trim() === ""
      );
      if (invalidParts.length > 0) {
        errors.push(
          `${invalidParts.length} parts have missing or invalid part_sku`
        );
      }

      // Check for duplicate part SKUs
      const partSkus = data.parts.map((p: any) => p.part_sku);
      const duplicatePartSkus = partSkus.filter(
        (sku: any, index: number) => partSkus.indexOf(sku) !== index
      );
      if (duplicatePartSkus.length > 0) {
        warnings.push(
          `Duplicate part SKUs found: ${[...new Set(duplicatePartSkus)].join(
            ", "
          )}`
        );
      }
    }

    // Check BOM items data
    if (!data.bom_items || data.bom_items.length === 0) {
      warnings.push(
        "No BOM items data found - BOM explosion will not be possible"
      );
    } else {
      // Check required fields in BOM items
      const invalidBomItems = data.bom_items.filter(
        (bom: any) =>
          !bom.parent_assembly_sku ||
          !bom.component_sku ||
          typeof bom.parent_assembly_sku !== "string" ||
          typeof bom.component_sku !== "string" ||
          bom.parent_assembly_sku.trim() === "" ||
          bom.component_sku.trim() === "" ||
          typeof bom.qty_per !== "number" ||
          bom.qty_per <= 0
      );
      if (invalidBomItems.length > 0) {
        errors.push(
          `${invalidBomItems.length} BOM items have missing or invalid parent_assembly_sku, component_sku, or qty_per`
        );
      }

      // Check for BOM items referencing non-existent assemblies or parts
      if (data.assemblies && data.parts) {
        const allSkus = new Set([
          ...data.assemblies.map((a: any) => a.assembly_sku),
          ...data.parts.map((p: any) => p.part_sku),
        ]);

        const orphanedBomItems = data.bom_items.filter(
          (bom: any) =>
            !allSkus.has(bom.parent_assembly_sku) ||
            !allSkus.has(bom.component_sku)
        );

        if (orphanedBomItems.length > 0) {
          warnings.push(
            `${orphanedBomItems.length} BOM items reference SKUs not found in assemblies or parts data`
          );
        }
      }
    }

    // Check stock data
    if (!data.stock || data.stock.length === 0) {
      warnings.push(
        "No stock data found - buildability analysis will not be possible"
      );
    } else {
      // Check required fields in stock
      const invalidStock = data.stock.filter(
        (s: any) =>
          !s.sku ||
          typeof s.sku !== "string" ||
          s.sku.trim() === "" ||
          typeof s.on_hand_qty !== "number" ||
          s.on_hand_qty < 0
      );
      if (invalidStock.length > 0) {
        errors.push(
          `${invalidStock.length} stock items have missing or invalid sku or on_hand_qty`
        );
      }

      // Check for stock items referencing non-existent parts
      if (data.parts) {
        const partSkus = new Set(data.parts.map((p: any) => p.part_sku));
        const orphanedStock = data.stock.filter(
          (s: any) => !partSkus.has(s.sku)
        );

        if (orphanedStock.length > 0) {
          warnings.push(
            `${orphanedStock.length} stock items reference parts not found in parts data`
          );
        }
      }

      // Check for duplicate stock entries
      const stockSkus = data.stock.map((s: any) => s.sku);
      const duplicateStockSkus = stockSkus.filter(
        (sku: any, index: number) => stockSkus.indexOf(sku) !== index
      );
      if (duplicateStockSkus.length > 0) {
        warnings.push(
          `Duplicate stock entries found for: ${[
            ...new Set(duplicateStockSkus),
          ].join(", ")}`
        );
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  };

  const selectDataFolder = async () => {
    try {
      // For now, we'll use a simple prompt, but this should be replaced with proper Tauri dialog
      const folderPath = window.prompt(
        "Please enter the path to your CSV data folder:",
        selectedFolder ||
          "C:\\Users\\johed\\OneDrive\\Documents\\Forgeable\\data"
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

      // Validate loaded data
      if (!result) {
        throw new Error("No data received from CSV files");
      }

      if (!result.assemblies || !Array.isArray(result.assemblies)) {
        throw new Error("Invalid or missing assemblies data");
      }

      if (!result.parts || !Array.isArray(result.parts)) {
        throw new Error("Invalid or missing parts data");
      }

      if (!result.bom_items || !Array.isArray(result.bom_items)) {
        throw new Error("Invalid or missing BOM items data");
      }

      if (!result.stock || !Array.isArray(result.stock)) {
        throw new Error("Invalid or missing stock data");
      }

      // Check for empty data
      if (result.assemblies.length === 0) {
        setTestStatus("⚠️ Warning: No assemblies found in CSV data");
        setData(result);
        return;
      }

      if (result.bom_items.length === 0) {
        setTestStatus(
          "⚠️ Warning: No BOM items found - analysis will be limited"
        );
        setData(result);
        return;
      }

      setData(result);

      // Validate the loaded CSV data
      const validation = validateCsvData(result);

      if (!validation.isValid) {
        setTestStatus(
          `❌ Data validation failed: ${validation.errors.join("; ")}`
        );
        console.error("CSV Data validation errors:", validation.errors);
        if (validation.warnings.length > 0) {
          console.warn("CSV Data validation warnings:", validation.warnings);
        }
        return;
      }

      // Display warnings if any
      let statusMessage = `✅ Loaded ${result.assemblies.length} assemblies, ${result.parts.length} parts, ${result.bom_items.length} BOM items`;

      if (validation.warnings.length > 0) {
        statusMessage += ` (${validation.warnings.length} warnings - check console)`;
        console.warn("CSV Data validation warnings:", validation.warnings);
      }

      setTestStatus(statusMessage);

      // Auto-select first assembly if available
      if (result.assemblies.length > 0) {
        setSelectedAssembly(result.assemblies[0].assembly_sku);
      }
    } catch (error) {
      console.error("Error loading data:", error);

      // Provide more specific error messages
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      if (errorMessage.includes("No such file")) {
        setTestStatus(
          "❌ CSV files not found. Please check the data directory path."
        );
      } else if (errorMessage.includes("permission")) {
        setTestStatus("❌ Permission denied accessing CSV files.");
      } else if (errorMessage.includes("Invalid")) {
        setTestStatus(`❌ Data validation error: ${errorMessage}`);
      } else {
        setTestStatus(`❌ Failed to load CSV data: ${errorMessage}`);
      }

      // Clear any existing data on error
      setData(null);
      setSelectedAssembly("");
      setBomResults(null);
      setBuildability(null);
    } finally {
      setIsLoading(false);
    }
  };

  const explodeBomForAssembly = async () => {
    // Validation checks
    if (!data) {
      setTestStatus("❌ No data loaded. Please load CSV data first.");
      return;
    }

    if (!selectedAssembly) {
      setTestStatus(
        "❌ No panel selected. Please choose a panel from the dropdown."
      );
      return;
    }

    // Validate the selected assembly exists
    const assemblyExists = data.assemblies.some(
      (a) => a.assembly_sku === selectedAssembly
    );
    if (!assemblyExists) {
      setTestStatus(
        "❌ Selected assembly not found in loaded data. Please select a different assembly."
      );
      return;
    }

    // Check if we have BOM data for analysis
    if (!data.bom_items || data.bom_items.length === 0) {
      setTestStatus("❌ No BOM data available for analysis.");
      return;
    }

    // Check if we have stock data for buildability analysis
    if (!data.stock || data.stock.length === 0) {
      setTestStatus(
        "⚠️ No stock data available - buildability analysis will be skipped."
      );
    }

    setIsLoading(true);
    setTestStatus(`Analyzing ${selectedAssembly}...`);

    // Clear previous results
    setBomResults(null);
    setBuildability(null);

    try {
      const indexed = indexBomByParent(data.bom_items);

      // Check if the assembly has any BOM items
      const assemblyBomItems = indexed.get(selectedAssembly);
      if (!assemblyBomItems || assemblyBomItems.length === 0) {
        setTestStatus(
          `⚠️ No BOM items found for panel ${selectedAssembly}. It may be a standalone part.`
        );
        return;
      }

      const assemblySkus = new Set(data.assemblies.map((a) => a.assembly_sku));
      const isAssembly = (sku: SKU) => assemblySkus.has(sku);

      const results = explodeBom(selectedAssembly, indexed, isAssembly);

      if (!results || Object.keys(results).length === 0) {
        setTestStatus(
          `❌ BOM explosion returned no results for ${selectedAssembly}`
        );
        return;
      }

      // Multiply results by panel quantity
      const multipliedResults: Record<string, number> = {};
      for (const [sku, qty] of Object.entries(results)) {
        multipliedResults[sku] = qty * panelQuantity;
      }

      setBomResults(multipliedResults);

      // Only calculate buildability if we have stock data
      if (data.stock && data.stock.length > 0) {
        // Calculate buildability for the requested quantity
        const stockMap = new Map<string, number>();
        for (const stockItem of data.stock) {
          const available = stockItem.on_hand_qty - stockItem.reserved_qty;
          stockMap.set(stockItem.sku, Math.max(0, available));
        }

        // Check which components are limiting for the requested quantity
        const limitingComponents: Array<{
          sku: string;
          available: number;
          reqPerUnit: number;
          candidateBuilds: number;
          needed: number;
          shortage: number;
        }> = [];

        let canBuildRequested = true;
        let maxPossible = Number.POSITIVE_INFINITY;

        for (const [sku, totalNeeded] of Object.entries(multipliedResults)) {
          const available = stockMap.get(sku) || 0;
          const reqPerUnit = totalNeeded / panelQuantity; // Back-calculate per-unit requirement
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
            needed: totalNeeded,
            shortage,
          });

          if (candidateBuilds < maxPossible) {
            maxPossible = candidateBuilds;
          }
        }

        if (!isFinite(maxPossible)) maxPossible = 0;

        // Sort by most limiting first (those with shortages, then lowest candidate builds)
        limitingComponents.sort((a, b) => {
          if (a.shortage > 0 && b.shortage === 0) return -1;
          if (a.shortage === 0 && b.shortage > 0) return 1;
          if (a.shortage > 0 && b.shortage > 0) return b.shortage - a.shortage;
          return a.candidateBuilds - b.candidateBuilds;
        });

        setBuildability({
          maxBuildable: canBuildRequested ? panelQuantity : maxPossible,
          limitingComponents: limitingComponents.slice(0, 10), // Show top 10 limiting components
        });

        // Calculate buildability for all panel types
        const allPanelBuildability: string[] = [];
        for (const assembly of data.assemblies) {
          try {
            const assemblyResults = explodeBom(
              assembly.assembly_sku,
              indexed,
              isAssembly
            );
            const assemblyBuildability = computeMaxBuildable(
              assemblyResults,
              data.stock
            );

            // Clean up panel name: "TS2_TYPE01" -> "Type01"
            const cleanPanelName = assembly.assembly_sku
              .replace(/^TS2_/, "") // Remove "TS2_" prefix
              .replace(/TYPE/, "Type"); // Change "TYPE" to "Type"

            allPanelBuildability.push(
              `${cleanPanelName}: ${assemblyBuildability.maxBuildable} panels`
            );
          } catch (error) {
            // Skip panels that can't be analyzed (e.g., no BOM data)
            const cleanPanelName = assembly.assembly_sku
              .replace(/^TS2_/, "")
              .replace(/TYPE/, "Type");
            allPanelBuildability.push(`${cleanPanelName}: Unable to analyze`);
          }
        }

        setTestStatus(
          `✅ Analysis complete! Panel buildability with current stock:\n${allPanelBuildability.join(
            "\n"
          )}`
        );
      } else {
        const partCount = Object.keys(results).length;
        setTestStatus(
          `✅ BOM explosion complete! Found ${partCount} parts (buildability analysis skipped - no stock data)`
        );
      }
    } catch (error) {
      console.error("Error in analysis:", error);

      const errorMessage =
        error instanceof Error ? error.message : String(error);
      if (errorMessage.includes("Circular BOM")) {
        setTestStatus(`❌ Circular dependency detected: ${errorMessage}`);
      } else if (errorMessage.includes("undefined")) {
        setTestStatus(
          "❌ Data structure error - some required fields may be missing"
        );
      } else {
        setTestStatus(`❌ Analysis failed: ${errorMessage}`);
      }

      // Clear results on error
      setBomResults(null);
      setBuildability(null);
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
        <p style={{ margin: 0, fontSize: 14, whiteSpace: "pre-line" }}>
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
              <option value="">Select a panel...</option>
              {data.assemblies.map((assembly) => (
                <option
                  key={assembly.assembly_sku}
                  value={assembly.assembly_sku}
                >
                  {assembly.assembly_sku} - {assembly.name}
                </option>
              ))}
            </select>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <label style={{ fontSize: 14, fontWeight: 500 }}>Quantity:</label>
              <input
                type="number"
                value={panelQuantity}
                onChange={(e) => {
                  const value = parseInt(e.target.value) || 1;
                  if (value <= 0) {
                    alert(
                      "❌ Wrong input! Please enter a number greater than 0."
                    );
                    setPanelQuantity(1);
                  } else {
                    setPanelQuantity(value);
                  }
                }}
                min="1"
                style={{
                  padding: "6px 8px",
                  borderRadius: 4,
                  border: "1px solid #ccc",
                  fontSize: 14,
                  width: 80,
                  textAlign: "center",
                }}
                placeholder="1"
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
                  !selectedAssembly || isLoading ? "not-allowed" : "pointer",
                opacity: !selectedAssembly || isLoading ? 0.6 : 1,
                fontSize: 14,
              }}
            >
              {isLoading ? "Analyzing..." : "Analyze Panel"}
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
            3. Parts Breakdown for Manufacturing
          </h3>
          <p style={{ margin: "0 0 12px 0", color: "#666", fontSize: 14 }}>
            Parts required to build {panelQuantity}x {selectedAssembly}:
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
                        {sku === "CABLE_GRAY" ? "Gray cable" : sku}
                      </td>
                      <td
                        style={{
                          padding: "6px 12px",
                          textAlign: "right",
                          fontSize: 13,
                        }}
                      >
                        {(() => {
                          const formattedQty =
                            qty % 1 === 0
                              ? qty.toString()
                              : qty.toFixed(2).replace(/\.?0+$/, "");

                          if (sku === "CABLE_GRAY") {
                            return `${formattedQty} inches`;
                          } else {
                            const numQty = parseFloat(formattedQty);
                            return `${formattedQty} ${
                              numQty === 1 ? "piece" : "pieces"
                            }`;
                          }
                        })()}
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

      {/* Buildability Section */}
      {buildability && (
        <div
          style={{
            background: "#fff",
            border: "1px solid #ddd",
            padding: 16,
            borderRadius: 8,
          }}
        >
          <h3 style={{ margin: 0, marginBottom: 12 }}>
            4. Buildability Analysis
          </h3>

          <div
            style={{
              background: buildability.maxBuildable > 0 ? "#d4edda" : "#f8d7da",
              border: `1px solid ${
                buildability.maxBuildable > 0 ? "#c3e6cb" : "#f5c6cb"
              }`,
              padding: 12,
              borderRadius: 4,
              marginBottom: 16,
            }}
          >
            <h4
              style={{
                margin: 0,
                color: buildability.maxBuildable > 0 ? "#155724" : "#721c24",
                fontSize: 16,
              }}
            >
              {buildability.maxBuildable >= panelQuantity
                ? `✅ Can build requested ${panelQuantity} panels`
                : `❌ Cannot build ${panelQuantity} panels - only ${buildability.maxBuildable} possible`}
            </h4>
            <p
              style={{
                margin: "8px 0 0 0",
                fontSize: 12,
                color:
                  buildability.maxBuildable >= panelQuantity
                    ? "#155724"
                    : "#721c24",
              }}
            >
              {buildability.maxBuildable >= panelQuantity
                ? "All required parts are available in sufficient quantities."
                : `Missing parts prevent building the requested quantity. Maximum possible: ${buildability.maxBuildable} panels.`}
            </p>
          </div>

          {buildability.limitingComponents.length > 0 && (
            <div>
              <h4 style={{ margin: "0 0 8px 0", fontSize: 14 }}>
                Limiting Components:
              </h4>
              <div
                style={{
                  maxHeight: 300,
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
                          {component.available.toFixed(2)}
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
                          {(component.reqPerUnit * panelQuantity).toFixed(2)}
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
                            component.reqPerUnit * panelQuantity -
                              component.available
                          ).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
