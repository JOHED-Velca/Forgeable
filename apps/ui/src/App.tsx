export default function App() {
  console.log("🚀 App component rendered - IMPORT TEST");
  
  return (
    <div style={{ padding: 16, fontFamily: "Inter, system-ui, sans-serif" }}>
      <h1>🔧 Forgeable — Import Test</h1>
      <div style={{ background: "#f0f8ff", padding: 16, borderRadius: 4, marginBottom: 16 }}>
        <h3 style={{ margin: 0, marginBottom: 8, color: "#0066cc" }}>Status</h3>
        <p style={{ margin: 0 }}>✅ React App is rendering</p>
        <p style={{ margin: 0 }}>✅ Basic imports working</p>
      </div>
      <p style={{ opacity: 0.7 }}>
        Testing if basic React is still working...
      </p>
    </div>
  );
}
