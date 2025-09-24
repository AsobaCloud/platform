# O&M Usage Guide: Ona Platform Operations & Maintenance

This guide provides practical instructions for using the Ona Platform's Operations & Maintenance (O&M) system. It focuses on real-world workflows, common scenarios, and best practices for O&M operators managing solar assets.

## 1. Getting Started

### Overview of O&M Workflow

The Ona Platform uses the OODA (Observe-Orient-Decide-Act) loop framework to transform reactive maintenance into proactive, AI-driven asset optimization:

- **Observe** (< 5 min) - Detect anomalies and faults in real-time
- **Orient** (< 10 min) - Diagnose issues and assess energy-at-risk
- **Decide** (< 15 min) - Schedule maintenance and optimize dispatch
- **Act** (Continuous) - Execute work orders and track resolution

### Prerequisites

Before using the O&M system, ensure you have:

1. **Asset Data**: Complete asset inventory with component details
2. **Sensor Data**: Historical and real-time telemetry data
3. **Forecast Data**: Energy production forecasts (optional but recommended)
4. **Configuration**: Properly configured categories and loss functions

### Quick Start Example

Here's a typical daily workflow to get you started:

```bash
# 1. Check for new faults
ona-terminal detect run --asset INV-001

# 2. Diagnose any issues found
ona-terminal diagnose run --asset INV-001

# 3. Calculate energy-at-risk
ona-terminal ear calc --asset INV-001 --horizons 24,72

# 4. Create maintenance schedule if needed
ona-terminal schedule create --assets INV-001 --horizon 168 --note "Weekly maintenance"

# 5. Build bill of materials
ona-terminal bom build --schedule_id sched-123

# 6. Create work order
ona-terminal order create --bom_id BOM-123

# 7. Set up tracking
ona-terminal track subscribe --email ops@company.com --job JOB-123
```

## 2. Daily Operations Workflow

### Morning Routine (8:00 AM)

**Step 1: System Health Check**
```bash
# Check all assets for overnight issues
ona-terminal detect list --since 2025-01-15T00:00:00Z
```

**Step 2: Review High-Priority Alerts**
```bash
# Focus on critical issues
ona-terminal diagnose list --severity_threshold 0.8
```

**Step 3: Energy Risk Assessment**
```bash
# Calculate risk for all assets
ona-terminal ear calc --asset INV-001 --horizons 24,72,168
ona-terminal ear calc --asset INV-002 --horizons 24,72,168
```

### Midday Operations (12:00 PM)

**Step 4: Schedule Optimization**
```bash
# Review and update schedules
ona-terminal schedule list
ona-terminal schedule create --assets INV-001,INV-002 --horizon 72 --note "Priority maintenance"
```

**Step 5: Resource Planning**
```bash
# Build BOMs for scheduled work
ona-terminal bom build --schedule_id sched-456
ona-terminal bom list
```

### End-of-Day Review (5:00 PM)

**Step 6: Work Order Management**
```bash
# Create orders for tomorrow's work
ona-terminal order create --bom_id BOM-789
ona-terminal order list
```

**Step 7: Tracking Setup**
```bash
# Ensure all active jobs are tracked
ona-terminal track list
ona-terminal track subscribe --email supervisor@company.com --job JOB-456
```

### Common Scenarios

#### Scenario 1: Inverter Overheating
```bash
# Detect the issue
ona-terminal detect run --asset INV-001 --severity_threshold 0.6

# Diagnose the root cause
ona-terminal diagnose run --asset INV-001

# Calculate immediate risk
ona-terminal ear calc --asset INV-001 --horizons 24

# Schedule urgent maintenance
ona-terminal schedule create --assets INV-001 --horizon 24 --note "URGENT: Cooling fan replacement"
```

#### Scenario 2: Performance Degradation
```bash
# Analyze over longer window
ona-terminal detect run --asset INV-002 --window_min 60 --severity_threshold 0.4

# Get detailed diagnostics
ona-terminal diagnose run --asset INV-002

# Plan preventive maintenance
ona-terminal schedule create --assets INV-002 --horizon 168 --note "Preventive maintenance"
```

#### Scenario 3: Weather-Related Issues
```bash
# Check for weather damage
ona-terminal detect run --asset INV-003 --since 2025-01-15T06:00:00Z

# Assess damage severity
ona-terminal diagnose run --asset INV-003

# Calculate extended risk
ona-terminal ear calc --asset INV-003 --horizons 24,72,168
```

### Best Practices

1. **Regular Monitoring**: Run detection checks every 15 minutes during peak hours
2. **Severity Thresholds**: Use 0.7+ for critical issues, 0.5+ for general monitoring
3. **Risk Assessment**: Always calculate EAR for 24, 72, and 168-hour horizons
4. **Documentation**: Include detailed notes in schedules and orders
5. **Tracking**: Set up notifications for all active work orders

## 3. Command Reference

### Observe Phase Commands

#### `/detect` (Fault Detection)

**Purpose**: Quickly identify anomalies and faults in asset data

**Actions**:
- `run` - Execute fault detection
- `list` - Show previous detection results
- `stream` - Real-time monitoring

**Key Parameters**:
- `--asset <id>` - Target specific asset
- `--since <timestamp>` - Filter by time (ISO8601 format)
- `--window_min <minutes>` - Analysis window (default: 15)
- `--severity_threshold <0-1>` - Minimum severity to flag (default: 0.5)

**Examples**:
```bash
# Basic detection
ona-terminal detect run --asset INV-001

# Extended analysis window
ona-terminal detect run --asset INV-001 --window_min 30 --severity_threshold 0.7

# Historical analysis
ona-terminal detect run --asset INV-001 --since 2025-01-15T00:00:00Z

# List recent detections
ona-terminal detect list
```

### Orient Phase Commands

#### `/diagnose` (Diagnostics)

**Purpose**: Analyze detected faults and identify root causes

**Actions**:
- `run` - Execute diagnostics
- `list` - Show diagnostic results
- `export` - Export diagnostic data

**Key Parameters**:
- `--asset <id>` - Target specific asset

**Examples**:
```bash
# Run diagnostics
ona-terminal diagnose run --asset INV-001

# List all diagnostics
ona-terminal diagnose list

# Export for reporting
ona-terminal diagnose export --asset INV-001
```

#### `/ear` (Energy-at-Risk)

**Purpose**: Calculate financial impact of asset issues

**Actions**:
- `calc` - Calculate energy risk
- `list` - Show previous calculations

**Key Parameters**:
- `--asset <id>` - Target specific asset
- `--horizons <hours>` - Risk horizons (default: "24,72")

**Examples**:
```bash
# Standard risk calculation
ona-terminal ear calc --asset INV-001

# Extended horizons
ona-terminal ear calc --asset INV-001 --horizons 24,48,72,168

# Multiple assets
ona-terminal ear calc --asset INV-001 --horizons 24,72
ona-terminal ear calc --asset INV-002 --horizons 24,72
```

### Decide Phase Commands

#### `/schedule` (Maintenance Scheduling)

**Purpose**: Create and manage maintenance schedules

**Actions**:
- `list` - Show existing schedules
- `create` - Create new schedule
- `set-loss` - Configure loss function weights

**Key Parameters**:
- `--assets <ids>` - Comma-separated asset list
- `--start <date>` - Schedule start date
- `--horizon <hours>` - Planning horizon (default: 72)
- `--constraints <file>` - Constraints file path
- `--note <text>` - Schedule description

**Examples**:
```bash
# List all schedules
ona-terminal schedule list

# Create single asset schedule
ona-terminal schedule create --assets INV-001 --horizon 168 --note "Weekly maintenance"

# Create multi-asset schedule
ona-terminal schedule create --assets INV-001,INV-002,INV-003 --horizon 72 --note "Batch maintenance"

# Set loss function weights
ona-terminal schedule set-loss --metrics metrics.csv
```

### Act Phase Commands

#### `/bom` (Bill of Materials)

**Purpose**: Generate parts lists for maintenance work

**Actions**:
- `list` - Show existing BOMs
- `build` - Create new BOM

**Key Parameters**:
- `--schedule_id <id>` - Source schedule ID
- `--asset <id>` - Target asset
- `--from-catalog` - Use parts catalog
- `--variants-per-type <n>` - Keep N alternatives
- `--ear-usd-day <amount>` - EAR value for selection

**Examples**:
```bash
# List all BOMs
ona-terminal bom list

# Build from schedule
ona-terminal bom build --schedule_id sched-123

# Build with catalog selection
ona-terminal bom build --schedule_id sched-123 --from-catalog --ear-usd-day 150

# Build with multiple variants
ona-terminal bom build --schedule_id sched-123 --variants-per-type 3
```

#### `/order` (Work Orders)

**Purpose**: Create and manage work orders

**Actions**:
- `list` - Show existing orders
- `create` - Create new order

**Key Parameters**:
- `--bom_id <id>` - Source BOM ID
- `--asset <id>` - Target asset

**Examples**:
```bash
# List all orders
ona-terminal order list

# Create order from BOM
ona-terminal order create --bom_id BOM-123

# Create with asset validation
ona-terminal order create --bom_id BOM-123 --asset INV-001
```

#### `/track` (Job Tracking)

**Purpose**: Monitor work order progress

**Actions**:
- `list` - Show tracking subscriptions
- `subscribe` - Add new subscription

**Key Parameters**:
- `--email <address>` - Notification email
- `--job <id>` - Job ID to track

**Examples**:
```bash
# List subscriptions
ona-terminal track list

# Subscribe to job updates
ona-terminal track subscribe --email ops@company.com --job JOB-123

# Subscribe multiple users
ona-terminal track subscribe --email supervisor@company.com --job JOB-123
ona-terminal track subscribe --email technician@company.com --job JOB-123
```

## 4. Data Management

### Input Data Requirements

#### Asset Data (`~/.asoba/ooda/inputs/assets.json`)
```json
{
  "assets": [
    {
      "id": "INV-001",
      "name": "Inverter 001",
      "type": "Solar Inverter",
      "capacity_kw": 20.0,
      "location": "Solar Farm A",
      "components": [
        {
          "oem": "Sungrow",
          "model": "SG20KTL",
          "serial": "SN123456",
          "type": "inverter"
        }
      ]
    }
  ]
}
```

#### Sensor Data (`~/.asoba/ooda/inputs/observations/`)
CSV format with columns:
- `timestamp` - ISO8601 timestamp
- `asset_id` - Asset identifier
- `temperature_c` - Temperature in Celsius
- `voltage_v` - Voltage in Volts
- `power_kw` - Power in kilowatts

Example:
```csv
timestamp,asset_id,temperature_c,voltage_v,power_kw
2025-01-15T08:00:00Z,INV-001,45.2,800.5,18.3
2025-01-15T08:15:00Z,INV-001,46.1,799.8,17.9
```

#### Forecast Data (`~/.asoba/ooda/inputs/forecasts/`)
CSV format with columns:
- `timestamp` - ISO8601 timestamp
- `predicted_power_kw` - Predicted power output

Example:
```csv
timestamp,predicted_power_kw
2025-01-15T08:00:00Z,19.2
2025-01-15T08:15:00Z,19.5
```

### Output Data Interpretation

#### Detection Results
- **Severity Score**: 0.0-1.0 (higher = more critical)
- **Deviation**: Difference between actual and forecast power
- **Signals**: Raw sensor values at time of detection

#### Diagnostic Results
- **Findings**: List of identified component issues
- **Recommended Actions**: Suggested maintenance actions
- **Risk Categories**: Weather Damage, OEM Fault, Ops Fault, Wear and Tear, End of Life

#### Energy-at-Risk Calculations
- **EAR Value**: USD per day of energy loss
- **Confidence Intervals**: Uncertainty bounds
- **Risk Progression**: How risk changes over time

### File Organization

```
~/.asoba/ooda/
├── inputs/
│   ├── observations/     # Sensor data CSV files
│   ├── forecasts/        # Energy forecast CSV files
│   └── assets.json       # Asset metadata
├── state/
│   ├── diagnostics/      # Diagnostic results
│   ├── risk/             # Energy risk calculations
│   ├── schedule/         # Maintenance schedules
│   ├── boms/             # Bills of materials
│   ├── tracking/         # Tracking subscriptions
│   └── orders/           # Work orders
└── config/
    └── loss_weights.json # Runtime weights
```

## 5. Configuration & Customization

### Categories Configuration (`configs/ooda/categories.yaml`)

Define fault categories and subcategories:

```yaml
Weather Damage:
  - hail_impact
  - wind_stress
  - lightning_strike

OEM Fault:
  - inverter_overtemp
  - dc_bus_fault
  - communication_error

Ops Fault:
  - wrong_setpoint
  - maintenance_overdue
  - calibration_drift

Wear and Tear:
  - bearing_wear
  - capacitor_degradation
  - connector_corrosion

End of Life:
  - capacity_fade
  - efficiency_loss
  - component_failure

Unknown Needs Further Investigation:
  - unknown_pattern
  - intermittent_fault
```

### Loss Function Configuration (`configs/ooda/loss_function.yaml`)

Configure decision-making weights:

```yaml
weights:
  w_energy: 1.0      # Energy loss weight
  w_cost: 0.3        # Maintenance cost weight
  w_mttr: 0.2        # Mean time to repair weight

crew:
  crews_available: 2  # Number of maintenance crews
  hours_per_day: 8    # Working hours per day
```

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

### Environment-Specific Overrides

Create environment-specific configurations:

```yaml
# configs/production.yaml
ooda:
  capacity_factor_default: 0.30  # Higher capacity factor for production
  crews_default: 4              # More crews available
  hours_per_day_default: 10     # Extended working hours
```

### Custom Thresholds

Adjust detection sensitivity:

```bash
# More sensitive detection
ona-terminal detect run --severity_threshold 0.3

# Less sensitive detection
ona-terminal detect run --severity_threshold 0.8

# Custom analysis window
ona-terminal detect run --window_min 60
```

## 6. Troubleshooting & Common Issues

### Common Problems and Solutions

#### Problem: No Detection Results
**Symptoms**: `detect run` returns no results
**Causes**:
- Missing sensor data
- Incorrect asset ID
- Data format issues

**Solutions**:
```bash
# Check data availability
ls ~/.asoba/ooda/inputs/observations/

# Verify asset ID
ona-terminal assets list

# Check data format
head ~/.asoba/ooda/inputs/observations/inverter_data.csv
```

#### Problem: High False Positive Rate
**Symptoms**: Too many low-severity alerts
**Causes**:
- Threshold too low
- Analysis window too short
- Environmental factors

**Solutions**:
```bash
# Increase severity threshold
ona-terminal detect run --severity_threshold 0.7

# Extend analysis window
ona-terminal detect run --window_min 30

# Review and adjust categories
cat configs/ooda/categories.yaml
```

#### Problem: Missing Diagnostic Results
**Symptoms**: `diagnose run` fails or returns empty results
**Causes**:
- No detection data
- Invalid asset configuration
- Missing categories file

**Solutions**:
```bash
# Run detection first
ona-terminal detect run --asset INV-001

# Check asset configuration
cat ~/.asoba/ooda/inputs/assets.json

# Verify categories file
cat configs/ooda/categories.yaml
```

#### Problem: EAR Calculation Errors
**Symptoms**: `ear calc` fails or returns unrealistic values
**Causes**:
- Missing capacity data
- Invalid horizon values
- Configuration issues

**Solutions**:
```bash
# Check asset capacity
grep "capacity_kw" ~/.asoba/ooda/inputs/assets.json

# Use standard horizons
ona-terminal ear calc --asset INV-001 --horizons 24,72

# Verify configuration
cat configs/default.yaml
```

#### Problem: Schedule Creation Failures
**Symptoms**: `schedule create` fails
**Causes**:
- Invalid asset IDs
- Conflicting schedules
- Resource constraints

**Solutions**:
```bash
# Verify asset IDs
ona-terminal assets list

# Check existing schedules
ona-terminal schedule list

# Use valid horizon values
ona-terminal schedule create --assets INV-001 --horizon 72
```

### Debugging Techniques

#### Enable Verbose Output
```bash
# Add --verbose flag to any command
ona-terminal detect run --asset INV-001 --verbose
```

#### Check State Files
```bash
# Review detection results
cat ~/.asoba/ooda/state/diagnostics/latest.json

# Check schedule data
cat ~/.asoba/ooda/state/schedule/current.json

# Review BOM data
cat ~/.asoba/ooda/state/boms/latest.json
```

#### Validate Data Formats
```bash
# Check CSV format
head -5 ~/.asoba/ooda/inputs/observations/inverter_data.csv

# Validate JSON files
python -m json.tool ~/.asoba/ooda/inputs/assets.json

# Check YAML syntax
python -c "import yaml; yaml.safe_load(open('configs/ooda/categories.yaml'))"
```

### Performance Optimization

#### Optimize Detection Performance
```bash
# Use appropriate window sizes
ona-terminal detect run --window_min 15  # For real-time
ona-terminal detect run --window_min 60  # For analysis

# Batch process multiple assets
for asset in INV-001 INV-002 INV-003; do
  ona-terminal detect run --asset $asset
done
```

#### Optimize Data Storage
```bash
# Archive old data
tar -czf observations_archive_$(date +%Y%m%d).tar.gz ~/.asoba/ooda/inputs/observations/

# Clean up old state files
find ~/.asoba/ooda/state -name "*.json" -mtime +30 -delete
```

## 7. Advanced Usage

### Workflow Automation

#### Daily Automation Script
```bash
#!/bin/bash
# daily_om_check.sh

# Morning health check
ona-terminal detect run --since $(date -d "1 day ago" -Iseconds)

# Process high-severity issues
ona-terminal diagnose list --severity_threshold 0.8 | while read asset; do
  ona-terminal diagnose run --asset $asset
  ona-terminal ear calc --asset $asset --horizons 24,72
done

# Generate daily report
ona-terminal schedule list > daily_schedule_$(date +%Y%m%d).txt
ona-terminal order list >> daily_schedule_$(date +%Y%m%d).txt
```

#### Real-time Monitoring
```bash
#!/bin/bash
# real_time_monitor.sh

while true; do
  # Check for new issues every 15 minutes
  ona-terminal detect run --since $(date -d "15 minutes ago" -Iseconds)
  
  # Alert on critical issues
  if ona-terminal detect list --severity_threshold 0.9 | grep -q "INV-"; then
    echo "CRITICAL ALERT: High severity issue detected" | mail -s "O&M Alert" ops@company.com
  fi
  
  sleep 900  # Wait 15 minutes
done
```

### Integration Patterns

#### API Integration
```python
# Example Python integration
import subprocess
import json

def run_detection(asset_id, threshold=0.5):
    cmd = ["ona-terminal", "detect", "run", "--asset", asset_id, "--severity_threshold", str(threshold)]
    result = subprocess.run(cmd, capture_output=True, text=True)
    return json.loads(result.stdout)

def get_ear_calculation(asset_id, horizons="24,72"):
    cmd = ["ona-terminal", "ear", "calc", "--asset", asset_id, "--horizons", horizons]
    result = subprocess.run(cmd, capture_output=True, text=True)
    return json.loads(result.stdout)
```

#### Database Integration
```sql
-- Example SQL queries for O&M data
SELECT 
    asset_id,
    severity,
    timestamp,
    signals
FROM detection_results 
WHERE severity > 0.7 
ORDER BY timestamp DESC;

SELECT 
    asset_id,
    ear_usd_day,
    horizon_hours
FROM energy_risk 
WHERE ear_usd_day > 100
ORDER BY ear_usd_day DESC;
```

### Custom Extensions

#### Custom Detection Rules
```python
# custom_detection.py
def custom_temperature_check(data):
    """Custom temperature anomaly detection"""
    if data['temperature_c'] > 60:
        return {
            'severity': 0.9,
            'category': 'OEM Fault',
            'subcategory': 'inverter_overtemp',
            'notes': 'Critical temperature threshold exceeded'
        }
    return None
```

#### Custom Risk Calculations
```python
# custom_risk.py
def calculate_custom_ear(asset_capacity, degradation_rate, energy_price):
    """Custom EAR calculation"""
    daily_loss = asset_capacity * degradation_rate * energy_price
    return {
        'ear_usd_day': daily_loss,
        'confidence': 0.85,
        'method': 'custom_degradation_model'
    }
```

### Best Practices for Scale

#### Multi-Site Management
```bash
# Process multiple sites
for site in site_a site_b site_c; do
  echo "Processing $site..."
  ona-terminal detect run --asset ${site}_INV-001
  ona-terminal detect run --asset ${site}_INV-002
done
```

#### Resource Optimization
```bash
# Optimize crew scheduling
ona-terminal schedule create --assets INV-001,INV-002,INV-003 --horizon 168 --note "Batch maintenance for efficiency"
```

#### Data Archival Strategy
```bash
# Monthly data archival
month=$(date +%Y%m)
tar -czf om_data_${month}.tar.gz ~/.asoba/ooda/inputs/observations/
aws s3 cp om_data_${month}.tar.gz s3://company-om-archive/
```

### Monitoring and Alerting

#### Custom Alerts
```bash
# High severity alert
if ona-terminal detect list --severity_threshold 0.9 | grep -q "INV-"; then
  curl -X POST "https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK" \
    -H 'Content-type: application/json' \
    --data '{"text":"🚨 Critical O&M Alert: High severity issue detected"}'
fi
```

#### Performance Monitoring
```bash
# Monitor system performance
echo "Detection performance:"
time ona-terminal detect run --asset INV-001

echo "Diagnostic performance:"
time ona-terminal diagnose run --asset INV-001
```

This comprehensive O&M usage guide provides everything needed to effectively use the Ona Platform's Operations & Maintenance system, from basic operations to advanced automation and integration patterns.