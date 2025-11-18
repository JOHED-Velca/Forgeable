# Forgeable v1.0.0

**Manufacturing Analysis & Build Tracking Desktop Application**

Forgeable is a comprehensive desktop application designed for manufacturing analysis and production tracking, specifically focused on panel assembly production planning. It provides Bill of Materials (BOM) analysis, stock-based buildability calculations, build recording, and complete production history tracking.

## 🚀 Features

### **Panel Analysis & Planning**

- **BOM Explosion**: Break down any panel assembly into its constituent parts and components
- **Stock-based Buildability**: Calculate how many panels can be built with current inventory
- **Multi-panel Analysis**: Analyze all panel types simultaneously to see production capacity
- **Limiting Component Detection**: Identify which parts constrain production capacity

### **Production Tracking**

- **Build Recording**: Record completed panel builds with work orders, sales orders, and customer information
- **Automatic Inventory Updates**: Stock levels are automatically adjusted when builds are recorded
- **Production History**: Complete tracking of all panel builds with timestamps and operators
- **Panel History Management**: Dedicated panel_history.csv for specialized tracking

### **Manufacturing Intelligence**

- **Recent Build History**: View recent production activities across all panel types
- **Production Summary**: Aggregate statistics showing total panels built by type
- **Stock Management**: Real-time inventory tracking with on-hand, reserved, and available quantities
- **Customer Tracking**: Track which customers received which panels and quantities

### **Multi-Tab Interface**

- **🔧 Analysis Tab**: BOM analysis, buildability calculations, and parts breakdown
- **📦 Inventory Tab**: Current stock levels and inventory management
- **📝 Record Build Tab**: Form for recording completed panel builds
- **📈 History Tab**: Complete production history and statistics

## � Screenshots

### Application Interface

![Application Title and Status](screenshoots/Forgeable_title.png)
_Main application interface showing data loading, panel selection, and real-time buildability status for all panel types_

### Parts Breakdown Analysis

![Parts Breakdown and Buildability Results](screenshoots/Forgeable_bottom.png)
_Detailed parts breakdown for manufacturing with clean formatting, proper units, and limiting components analysis_

## �🛠️ Technology Stack

- **Frontend**: React 19 + TypeScript + Vite
- **Backend**: Rust (Tauri 2.9)
- **Data**: CSV file processing
- **Platform**: Cross-platform desktop application

## 📋 Prerequisites

- **Node.js** (Latest LTS version)
- **Rust** (Latest stable version)
- **CSV Data Files** in the following format:

### Required CSV Files Structure

```
data/
├── assemblies.csv      # Panel definitions
├── parts.csv          # Component catalog
├── bom_items.csv      # Bill of materials relationships
├── stock.csv          # Current inventory levels
├── panel_history.csv  # Panel build history (optional, created automatically)
└── build_history.csv  # General build history (optional, created automatically)
```

#### CSV File Formats

**assemblies.csv**

```csv
assembly_sku,name,uom
TS2_TYPE01,Type 01 Panel,ea
TS2_TYPE02,Type 02 Panel,ea
```

**parts.csv**

```csv
part_sku,name,uom
LOADSWITCH,Load Switch,ea
FLASHER,Flasher,ea
CABLE_GRAY,Gray Cable,ft
```

**bom_items.csv**

```csv
parent_assembly_sku,component_sku,qty_per,scrap_rate,yield_pct,is_phantom
TS2_TYPE01,LOADSWITCH,16,0.00,1.00,false
TS2_TYPE01,FLASHER,1,0.00,1.00,false
```

**stock.csv**

```csv
sku,on_hand_qty,reserved_qty
LOADSWITCH,120,0
FLASHER,30,0
CABLE_GRAY,500,0
```

**panel_history.csv** (Optional - created automatically when recording builds)

```csv
id,timestamp,work_order,sales_order,customer,assembly_sku,quantity_built,operator,notes
550e8400-e29b-41d4-a716-446655440001,2024-11-15T08:30:00Z,WO-2024-001,SO-2024-456,BEACON,type01,3,John Smith,BEACON customer order
```

## 🚦 Getting Started

### Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd Forgeable
   ```

2. **Install dependencies**

   ```bash
   cd apps/ui
   npm install
   ```

3. **Prepare your data**

   - Place your CSV files in `/home/johed/Documents/CsvFiles/Forgeable/data/`
   - Ensure all CSV files follow the required format

4. **Run the application**

   ```bash
   # Development mode
   ./run-dev.sh

   # Or manually
   cd apps/ui
   npm run tauri:dev
   ```

### Building for Production

```bash
cd apps/ui
npm run tauri:build
```

## 📖 Usage

### Basic Workflow

1. **Load Data**: Click "Load CSV Data" to import your manufacturing data
2. **Analyze Panels**:
   - Go to the Analysis tab
   - Select a panel type and quantity
   - Click "Analyze Panel" to perform BOM explosion and buildability analysis
3. **Record Production**:
   - Go to the Record Build tab
   - Fill in work order, sales order, customer, and build details
   - Click "Record Build" to log the completed production
4. **Track History**:
   - Go to the History tab to view complete production history
   - Load panel history from CSV files
   - Review production summaries and recent builds
5. **Monitor Inventory**:
   - Go to the Inventory tab to check current stock levels
   - Monitor available vs. reserved quantities

### Tab Functions

#### 🔧 Analysis Tab

- Select panel types and quantities to analyze
- View detailed parts breakdown
- See buildability analysis and limiting components
- Real-time stock-based production capacity calculations

#### 📦 Inventory Tab

- Monitor current stock levels for all parts
- View on-hand, reserved, and available quantities
- Identify low-stock items with visual indicators

#### 📝 Record Build Tab

- Record completed panel builds
- Automatic inventory updates when builds are recorded
- Track work orders, sales orders, customers, and operators
- Add production notes and timestamps

#### 📈 History Tab

- View complete build history from CSV data
- Load panel history from panel_history.csv
- Review production summaries by panel type
- Track total quantities built and build counts

### Understanding the Results

#### Analysis Results

Shows buildability analysis for selected panels:

```
✅ Analysis complete! Found 8 parts required
Can build requested 5 panels: ✅
```

#### Build Recording

When recording builds:

- Stock levels automatically update
- Build records are saved to both build_history.csv and panel_history.csv
- Production timestamps and operator information are tracked

#### Production History

View comprehensive production data:

- Recent builds with work orders and customer information
- Production summaries showing total panels built by type
- Complete build history sorted by most recent first

#### Stock Management

Real-time inventory tracking:

- On-hand quantities vs. reserved stock
- Available stock calculations (on-hand - reserved)
- Low-stock warnings with visual indicators

## 🎯 Key Concepts

### **BOM Explosion**

The process of "exploding" a complex assembly into all its individual components. Starting with a finished panel, the system recursively breaks down sub-assemblies until it reaches basic parts, calculating total quantities needed.

### **Build Recording**

Complete production tracking system that records:

- Work orders and sales orders
- Customer information and panel types
- Quantities built and production timestamps
- Operator names and production notes
- Automatic inventory updates

### **Limiting Components**

Parts that constrain production capacity. Production is limited by whichever component runs out first. The system identifies these bottlenecks and shows available stock vs. requirements.

### **Production History**

Comprehensive tracking of all manufacturing activities:

- **Recent Build History**: Latest 20 builds from CSV data
- **Panel Production Summary**: Aggregated statistics by panel type
- **Complete History**: Full build records from panel_history.csv

### **Stock Management**

Real-time inventory tracking with:

- **On-hand quantities**: Physical stock available
- **Reserved quantities**: Stock allocated but not yet used
- **Available stock**: On-hand minus reserved (available for production)
- **Low-stock indicators**: Visual warnings for items running low

## 📁 Project Structure

```
Forgeable/
├── apps/ui/                    # React frontend application
│   ├── src/
│   │   ├── components/         # React components
│   │   ├── domain/            # Business logic
│   │   │   ├── bomExplode.ts  # BOM explosion algorithms
│   │   │   ├── limitingReagent.ts # Buildability calculations
│   │   │   └── types.ts       # TypeScript interfaces
│   │   ├── services/          # External service integrations
│   │   └── App.tsx           # Main application component
│   └── src-tauri/            # Rust backend
│       └── src/
│           ├── data.rs       # CSV data processing
│           ├── lib.rs        # Tauri application setup
│           └── main.rs       # Application entry point
├── run-dev.sh               # Development startup script
└── README.md               # This file
```

## 🔧 Configuration

### Data Directory

Update the data directory path in `App.tsx` if your CSV files are located elsewhere:

```typescript
const DATA_DIR = "/path/to/your/csv/files";
```

### CSV Processing

The application uses snake_case field names consistently across all data layers. Ensure your CSV headers match the expected format.

## 🤝 Contributing

This project follows standard practices:

- TypeScript for type safety
- Snake_case naming convention for data fields
- Comprehensive error handling and validation
- Clean, maintainable code architecture

## 📝 Version History

### v1.0.0 (Current)

- ✅ Complete BOM explosion functionality with limiting component analysis
- ✅ Multi-tab interface (Analysis, Inventory, Record Build, History)
- ✅ Build recording system with automatic inventory updates
- ✅ Production history tracking with panel_history.csv integration
- ✅ Stock management with on-hand, reserved, and available calculations
- ✅ Customer and work order tracking
- ✅ Professional UI with intuitive navigation
- ✅ Comprehensive error handling and data validation
- ✅ Real-time buildability analysis
- ✅ Production summary reporting by panel type
- ✅ Operator and notes tracking for builds
- ✅ Snake_case standardization across all data layers

## 📄 License

This project is part of the Forgeable manufacturing analysis suite.

---

**Built with ❤️ for manufacturing excellence**
