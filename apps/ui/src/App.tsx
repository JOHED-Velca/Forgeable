export default function App() {
  console.log("🚀 App component rendered - SIMPLE TEST");

  return (
    <div style={{ padding: 16, fontFamily: "Inter, system-ui, sans-serif" }}>
      <h1>🔧 Forgeable — SIMPLE TEST</h1>
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
        <p style={{ margin: 0 }}>✅ TypeScript is compiling</p>
        <p style={{ margin: 0 }}>✅ Tauri webview is working</p>
      </div>
      <p
        style={{
          background: "#f5f5f5",
          padding: 16,
          borderRadius: 4,
          fontSize: 12,
        }}
      >
        Console log: "🚀 App component rendered - SIMPLE TEST"
      </p>
      <p style={{ opacity: 0.7 }}>
        If you see this message, React is working correctly!
      </p>
    </div>
  );
}
