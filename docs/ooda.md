# OODA Loop Implementation

The OODA (Observe, Orient, Decide, Act) loop implementation provides a framework for solar asset management with advanced analytics capabilities.

For a comprehensive guide to the OODA workflow implementation, see [OODA Workflow Implementation Guide](ooda-workflow-implementation.md).

For a practical walkthrough with example commands, see [OODA Demo Guide](ooda-demo.md).

## Overview

The OODA implementation consists of several interconnected components that work together to provide a complete asset management solution:

1. **Observe** - Fault detection and data collection
2. **Orient** - Diagnostics and risk assessment
3. **Decide** - Scheduling and planning
4. **Act** - Execution and tracking

## Commands

### /detect (aliases: /fault)

Run fault detection on solar assets.

**Actions:**
- `run` - Run fault detection
- `list` - List detection results
- `stream` - Stream detection data

**Parameters:**
- `--asset` - Specific asset ID to analyze
- `--since` - ISO8601 timestamp to filter results
- `--window_min` - Rolling window in minutes (default: 15)
- `--severity_threshold` - Severity threshold (default: 0.5)

**Examples:**
```
/detect run --asset INV-1
/detect run --asset INV-1 --since 2025-08-12T00:00:00Z --window_min 30 --severity_threshold 0.7
```

### /diagnose (aliases: /diag)

Run diagnostics on solar assets.

**Actions:**
- `run` - Run diagnostics
- `list` - List diagnostic results
- `export` - Export diagnostic data

**Parameters:**
- `--asset` - Specific asset ID to analyze

**Examples:**
```
/diagnose run --asset INV-1
/diagnose list
```

### /ear (aliases: /energy-risk)

Calculate Energy-at-Risk for solar assets.

**Actions:**
- `calc` - Calculate energy risk
- `list` - List risk calculations

**Parameters:**
- `--asset` - Specific asset ID to analyze
- `--horizons` - Comma-separated list of hours (default: "24,72")

**Examples:**
```
/ear calc --asset INV-1
/ear calc --asset INV-1 --horizons 24,48,72
```

### /schedule (aliases: /sched)

Create and manage maintenance schedules.

**Actions:**
- `list` - List schedules
- `create` - Create new schedule
- `set-loss` - Set loss function

**Parameters:**
- `--assets` - Comma-separated list of asset IDs
- `--start` - Start date for schedule
- `--horizon` - Horizon in hours (default: 72)
- `--constraints` - Constraints file path
- `--note` - Schedule note
- `--metrics` - Metrics CSV for set-loss action

**Examples:**
```
/schedule list
/schedule create --assets INV-1,INV-2 --horizon 168 --note "Weekly maintenance"
```

### /bom (aliases: /build-bom)

Build bill of materials for maintenance work.

**Actions:**
- `list` - List BOMs
- `build` - Build new BOM

**Parameters:**
- `--schedule_id` - Schedule ID to build BOM from

**Examples:**
```
/bom list
/bom build --schedule_id sched-123
```

### /track

Track job updates and subscribe to notifications.

**Actions:**
- `list` - List tracking subscriptions
- `subscribe` - Subscribe to job updates

**Parameters:**
- `--email` - Email for subscription
- `--job` - Job ID to track

**Examples:**
```
/track list
/track subscribe --email ops@company.com --job JOB-123
```

### /order

Create and manage work orders.

**Actions:**
- `list` - List orders
- `create` - Create new order

**Parameters:**
- `--bom_id` - BOM ID for order creation

**Examples:**
```
/order list
/order create --bom_id BOM-123
```

## Enhanced Analytics

The OODA implementation includes enhanced analytics capabilities with energy production forecasting integration:

### Enhanced Fault Detection
- Multi-signal anomaly detection
- Filtering based on severity thresholds
- Detailed event reporting with timestamps and values
- Energy production deviation analysis using forecast data

### Advanced Diagnostics
- Risk categorization (Critical, Major, Minor)
- Trend analysis for degradation detection
- Detailed metrics for severity, frequency, and recency
- Energy production pattern analysis

### Energy Risk Calculations
- Confidence intervals for risk assessments
- Risk progression tracking over time
- Detailed metadata including capacity and capacity factor
- Forecast accuracy integration for improved predictions

### Scheduling Enhancements
- Job distribution across crews
- Detailed scheduling metadata
- Enhanced scheduling parameters

### BOM Creation
- Job-based item generation
- Detailed categorization of items
- Comprehensive itemization with quantities and units

## Data Management

All OODA data is stored in the `.ona/ooda/` directory with the following structure:

```
.ona/ooda/
├── inputs/
│   ├── observations/     # Sensor data CSV files
│   └── assets.json       # Asset metadata
├── state/
│   ├── diagnostics/      # Diagnostic results
│   ├── risk/             # Energy risk calculations
│   ├── schedule/         # Scheduling data
│   │   ├── current.json  # Current schedule
│   │   └── history/      # Schedule history
│   ├── boms/             # Bill of materials
│   ├── tracking/         # Tracking subscriptions
│   └── orders/           # Work orders
└── config/
    └── loss_weights.json # Loss function weights
```

## Configuration

The OODA implementation can be configured through the main configuration file:

```yaml
ooda:
  categories_path: "configs/ooda/categories.yaml"
  loss_function_path: "configs/ooda/loss_function.yaml"
  data_root: "~/.asoba/ooda"
  capacity_factor_default: 0.25
  crews_default: 2
  hours_per_day_default: 8
```