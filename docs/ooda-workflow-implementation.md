# OODA Workflow Implementation Guide

The OODA (Observe-Orient-Decide-Act) loop implementation in Ona Terminal provides a systematic framework for solar asset management operations. This guide details the complete implementation, from architecture to command structure to data flow.

## What is OODA?

OODA stands for:
- **Observe** - Gather information and detect patterns
- **Orient** - Analyze context and assess risks
- **Decide** - Evaluate options and make decisions
- **Act** - Execute actions and track outcomes

This framework ensures systematic thinking over rushed responses, forcing models to verify technical constraints before proposing solutions.

## Implementation Architecture

The OODA implementation follows a backend adapter pattern with two primary implementations:

### Core Components

1. **Protocol Interface** (`src/ona_terminal/ooda/backend.py`)
   - Defines the `OodaBackend` protocol with methods for each phase
   - Provides `get_backend(config_loader)` factory function

2. **File Backend** (`src/ona_terminal/ooda/file_backend.py`)
   - Demo implementation using flat files for data/state persistence
   - Processes mock data from CSV files in `.ona/ooda/inputs/observations/`
   - Generates artifacts in `.ona/ooda/state/` directory

3. **Enhanced File Backend** (`src/ona_terminal/ooda/enhanced_file_backend.py`)
   - More sophisticated implementation with additional analytics
   - Implements enhanced versions of core methods

### Command Registry Integration

Commands are registered in the CLI through the command registry system:
- Registered in `src/ona_terminal/cli.py` inside `_initialize_command_registry()`
- Each command follows the pattern: `command(action: str = None, **kwargs)`
- Actions typically include: `run`, `list`, `stream`, `export`, `create`

## Command Structure and Workflow

### 1. Observe Phase - `/detect` (aliases: `/fault`)

Detects faults quickly on new telemetry data, incorporating both physical sensor data and energy production forecasts.

**Actions:**
- `run` - Run fault detection on assets
- `list` - List previous detection results
- `stream` - Stream real-time detection data

**Parameters:**
- `--asset <id>` - Filter by specific asset ID
- `--since <ISO8601>` - Filter observations after timestamp
- `--window_min <int>` - Rolling window in minutes (default: 15)
- `--severity_threshold <0-1>` - Minimum severity for flagging (default: 0.5)

**Implementation Details:**
- Loads newest CSV in `ooda.data_root/inputs/observations/` matching asset filter
- Loads energy production forecast data from `ooda.data_root/inputs/forecasts/` if available
- Computes anomaly scores using z-score analysis for physical parameters
- Analyzes deviation between actual and forecasted energy production
- Maps signals to fault codes based on predefined rules
- Persists results to `state/diagnostics/latest.json` under `raw_faults` key

**Example:**
```
/detect --action run --asset INV-001 --severity_threshold 0.7
```

### 2. Orient Phase - `/diagnose` (aliases: `/diag`)

Runs diagnostics grouping and computes Energy-at-Risk (EAR) over time horizons, now enhanced with energy production forecasting analysis.

**Actions:**
- `run` - Run diagnostics on assets
- `list` - List previous diagnostic results
- `export` - Export diagnostics data

**Parameters:**
- `--asset <id>` - Filter by specific asset ID

**Implementation Details:**
- Loads categories from `configs/ooda/categories.yaml`
- Groups raw faults by category and subcategory
- Computes risk scores using weighted metrics (severity, frequency, recency)
- Analyzes deviation between actual and forecasted energy production
- Calculates EAR using deterministic formulas based on capacity factors
- Persists results to `state/diagnostics/latest.json`

**Example:**
```
/diagnose run --asset INV-001
```

### 3. Decide Phase - `/schedule` and `/ear`

Optimizes maintenance scheduling and calculates financial impact.

**Schedule Actions:**
- `list` - List existing schedules
- `create` - Create new maintenance schedule
- `set-loss` - Set loss function weights

**EAR Actions:**
- `calc` - Calculate Energy-at-Risk
- `list` - List previous EAR calculations

**Parameters:**
- `--assets <ids>` - Comma-separated list of asset IDs
- `--start <date>` - Schedule start date
- `--horizon <hours>` - Forecast horizon in hours
- `--constraints <file>` - Constraints file path
- `--note <str>` - Schedule notes
- `--horizons <hours>` - Comma-separated list of horizons for EAR (default: "24,72")

**Implementation Details:**
- Schedule creation distributes work across crews based on configuration
- EAR calculations use exponential models for risk progression
- Both commands use loss function weights from `configs/ooda/loss_function.yaml`
- Results persisted to `state/schedule/` and `state/risk/` respectively

**Examples:**
```
/schedule create --assets INV-001 --horizon 168 --note "Preventive maintenance"
/ear calc --asset INV-001 --horizons 24,72,168
```

### 4. Act Phase - `/bom`, `/track`, and `/order`

Creates actionable artifacts and tracks execution.

**BOM Actions:**
- `list` - List existing bills of materials
- `build` - Build BOM from schedule

**Track Actions:**
- `subscribe` - Subscribe to job updates
- `list` - List tracking subscriptions

**Order Actions:**
- `list` - List existing orders
- `create` - Create new order from BOM

**Parameters:**
- `--schedule_id <id>` - Schedule ID for BOM creation
- `--email <str>` - Subscriber email for tracking
- `--job <id>` - Job ID for tracking
- `--bom_id <id>` - BOM ID for order creation

**Implementation Details:**
- BOM generation creates parts lists based on diagnostic results
- Tracking system maintains subscriber lists in `state/tracking/subscribers.json`
- Order system creates purchase orders referencing BOMs
- All artifacts persisted to respective state directories

**Examples:**
```
/bom build --schedule_id sched-123
/track subscribe --email ops@example.com --job JOB-123
/order create --bom_id BOM-123
```

## Data Flow and Persistence

The OODA implementation follows a consistent data flow pattern:

### Input Data
```
.ona/ooda/
├── inputs/
│   ├── observations/     # Raw sensor data in CSV format
│   └── assets.json       # Asset metadata and configuration
```

### Configuration Files
```
configs/
├── ooda/
│   ├── categories.yaml   # Fault category mappings
│   └── loss_function.yaml # Weighting for decision algorithms
└── default.yaml          # Main configuration with ooda.* keys
```

### State Persistence
```
.ona/ooda/
├── state/
│   ├── diagnostics/      # Diagnostic results and raw faults
│   ├── risk/             # Energy-at-Risk calculations
│   ├── schedule/         # Maintenance schedules
│   ├── boms/             # Bills of materials
│   ├── tracking/         # Subscription tracking
│   └── orders/           # Work orders
└── config/
    └── loss_weights.json # Runtime-configurable weights
```

## Configuration Schema

### Main Configuration (`configs/default.yaml`)
```yaml
ooda:
  categories_path: "configs/ooda/categories.yaml"
  loss_function_path: "configs/ooda/loss_function.yaml"
  data_root: "~/.asoba/ooda"
  capacity_factor_default: 0.25
  crews_default: 2
  hours_per_day_default: 8
```

### Categories (`configs/ooda/categories.yaml`)
```yaml
Weather Damage:
  - hail_impact
  - wind_stress
OEM Fault:
  - inverter_overtemp
  - dc_bus_fault
Ops Fault:
  - wrong_setpoint
Wear and Tear:
  - bearing_wear
End of Life:
  - capacity_fade
Unknown Needs Further Investigation:
  - unknown_pattern
```

### Loss Function (`configs/ooda/loss_function.yaml`)
```yaml
weights:
  w_energy: 1.0
  w_cost: 0.3
  w_mttr: 0.2
crew:
  crews_available: 2
  hours_per_day: 8
```

## Forecasting Integration

The OODA implementation now incorporates energy production forecasting to enhance fault detection accuracy. This integration combines physical device data with predicted energy output patterns to provide a more comprehensive view of asset health.

### Benefits of Forecast Integration

1. **Enhanced Fault Detection**: By comparing actual energy production with forecasts, the system can identify performance degradation that might not be evident from physical sensor data alone.

2. **Predictive Maintenance**: Forecast data enables proactive maintenance scheduling based on expected performance rather than just reactive measures.

3. **Improved Diagnostics**: Energy production patterns provide additional context for diagnosing inverter issues, helping distinguish between hardware problems and environmental factors.

### Implementation Details

- Forecast data is loaded from `ooda.data_root/inputs/forecasts/` directory
- The system correlates actual energy production with forecasts to identify deviations
- Diagnostic algorithms consider both physical sensor anomalies and energy production discrepancies
- Energy-at-Risk calculations now factor in forecast accuracy for more precise financial impact assessments

### Data Flow with Forecasting

```
.ona/ooda/
├── inputs/
│   ├── observations/     # Raw sensor data in CSV format
│   ├── forecasts/        # Energy production forecasts in CSV format
│   └── assets.json       # Asset metadata and configuration
├── state/
│   ├── diagnostics/      # Diagnostic results including forecast analysis
│   ├── risk/             # Energy risk calculations with forecast integration
│   ├── schedule/         # Maintenance schedules
│   ├── boms/             # Bills of materials
│   ├── tracking/         # Subscription tracking
│   └── orders/           # Work orders
└── config/
    └── loss_weights.json # Runtime-configurable weights
```

## System-Level Design Principles

### 1. Reality First
Technical constraints are immutable boundaries that must be respected absolutely. Physical laws and API limits take precedence over user requests.

### 2. Verification Over Generation
Every response includes validation steps, and uncertainty is acknowledged rather than disguised with confident guessing.

### 3. Context Over Compliance
Understanding the "why" behind requests is more important than blind compliance. The system pushes back on impossible or potentially harmful requests.

### 4. Systematic Over Spontaneous
Structured thinking prevents errors through defined phases and reproducible reasoning, making decisions traceable and explainable.

## Orchestration Patterns

### Command Chaining
Commands can be chained together to form complete workflows:
```
/detect --action run --asset INV-001 | /diagnose run --asset INV-001 | /ear calc --asset INV-001 --horizons 24,72,168 | /schedule create --assets INV-001 --horizon 168 | /bom build | /track subscribe --email ops@example.com --job JOB-123
```

### Parallel Execution
Multiple agents can work in parallel on different aspects of a problem:
```
/parallel --agents "analyzer,linter,security-scan" --target src/
```

### Conditional Execution
Execution can be made conditional based on results:
```
/if-error /analyze > /debug > /fix
```

## Testing Strategy

### Unit Tests
Located in `tests/unit/ooda/` covering:
- Fault scoring from sample observations
- Diagnostics grouping and risk aggregation
- EAR computation against fixed inputs
- Schedule greedy selection correctness
- BOM mapping rules
- Forecast data integration and analysis

### Integration Tests
Located in `tests/integration/ooda/` ensuring:
- Observe→Orient chain produces consistent risk and persists state files
- Decide creates schedule and BOM, files saved in expected locations
- Forecast data is properly loaded and analyzed in diagnostics

### E2E Tests
Located in `tests/e2e/ooda/` validating:
- Full pipeline via CLI produces a schedule and BOM and allows tracking subscribe
- Forecast integration enhances fault detection accuracy

## Demo and Examples

For a complete walkthrough of the OODA workflow with energy production forecasting integration, see [OODA Demo Guide](ooda-demo.md).

## Extensibility

### Custom Backend Implementation
To swap from file-based to API-based backend:
1. Implement the `OodaBackend` protocol with all required methods
2. Update the `get_backend()` factory function to return your implementation
3. Maintain the same method signatures for compatibility

### Custom Agents
Create custom single-use agents tailored to specific workflows:
```yaml
# custom-agents.yaml
agents:
  log-analyzer:
    description: "Analyzes application logs for errors"
    model: "claude-3-haiku"
    system_prompt: "You are a log analysis expert..."
    
  api-tester:
    description: "Tests API endpoints and reports issues"
    model: "mistral-7b"
    system_prompt: "You test APIs systematically..."
```

## Future Enhancements

### API Backend
Replace `FileBackend` with `ApiBackend` for real service integration without changing CLI or configs.

### Domain Specialization
Extend categories/loss function per deployment via environment overrides or `production.yaml`.

### Advanced Orchestration
Implement more sophisticated workflow patterns with conditional branching and parallel execution.