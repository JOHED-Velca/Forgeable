import { useState } from "react";

// Test if the issue is with the explodeBom import path
// Let's try importing from a different way
export default function App() {
  const [testStatus, setTestStatus] = useState<string>(
    "TESTING - No BOM Import"
  );

  console.log("🚀 App component rendered - NO BOM IMPORT TEST");

  const testImport = async () => {
    try {
      console.log("About to import bomExplode...");
      const { explodeBom } = await import("./domain/bomExplode");
      console.log("Successfully imported:", typeof explodeBom);
      setTestStatus("Dynamic import successful!");
    } catch (error) {
      console.error("Import failed:", error);
      setTestStatus(`Import failed: ${error}`);
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
        onClick={testImport}
        style={{
          background: "#007bff",
          color: "white",
          border: "none",
          padding: "8px 16px",
          borderRadius: 4,
          cursor: "pointer",
        }}
      >
        Test Dynamic Import
      </button>
      <p style={{ opacity: 0.7 }}>
        Testing if basic React app works without any imports...
      </p>
    </div>
  );
}
