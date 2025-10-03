# Interpolation Service

A microservice for ML-based solar data interpolation with gap analysis capabilities.

## Components

### Gap Analysis Tool (`models/gap_analysis.py`)
Analyzes solar power time series data to identify missing data patterns and recommend interpolation methods.

### Interpolation Engine (`interpolation.py`)
Takes gap analysis results and performs the recommended interpolation methods with comprehensive validation metrics.

### Output Structure
The tool generates:

1. **Console Summary**: Key metrics printed to terminal
2. **JSON File**: Detailed analysis results in structured format
3. **Text Report**: Human-readable analysis summary

### Console Output
```
SUMMARY:
Total gaps: [number]
Missing percentage: [percentage]%
Solar physics violations: [count]
Overall gap impact: [low/medium/high]
Recommended method: [method_name]
```

### JSON Output Structure
```json
{
  "filepath": "path/to/data.csv",
  "city_name": "location_name",
  "structure": {
    "time_column": "column_name",
    "power_columns": ["power_col1", "power_col2", ...],
    "time_frequency": "hourly/daily",
    "total_rows": number,
    "total_columns": number
  },
  "analysis": {
    "dataset_info": {
      "total_rows": number,
      "time_range": {"start": "date", "end": "date"},
      "duration_days": number,
      "time_frequency": "frequency"
    },
    "columns": {
      "column_name": {
        "missing_count": number,
        "missing_percentage": number,
        "gaps": [{"start": "datetime", "end": "datetime", "length_hours": number}],
        "gap_length_stats": {"min": number, "max": number, "mean": number, "median": number}
      }
    },
    "overall_stats": {
      "total_gaps": number,
      "total_missing_values": number,
      "overall_missing_percentage": number,
      "gap_length_distribution": {
        "short (1-6h)": number,
        "medium (6-24h)": number,
        "long (24h+)": number
      }
    },
    "solar_physics_violations": {
      "nighttime_power": number,
      "negative_power": number,
      "unrealistic_values": number,
      "total_violations": number
    },
    "weather_correlation": {
      "storm_correlated_gaps": number,
      "maintenance_correlated_gaps": number,
      "total_weather_correlated": number
    },
    "gap_impact_assessment": {
      "daily_energy_impact": "low/medium/high",
      "peak_power_impact": "low/medium/high",
      "performance_ratio_impact": "low/medium/high",
      "overall_impact": "low/medium/high"
    }
  },
  "recommendations": {
    "primary_method": "method_name",
    "method_parameters": {
      "model_equipment_independently": boolean,
      "use_equipment_correlation": boolean,
      "apply_solar_constraints": boolean
    },
    "reasoning": ["explanation1", "explanation2"],
    "pattern_based_recommendations": {
      "failure_patterns": {
        "column_name": {
          "randomness": "low/medium/high/unknown",
          "systematic": "low/medium/high/unknown",
          "degradation": "improving/stable/degrading/unknown",
          "maintenance_like": "yes/no/unknown",
          "weather_correlated": "yes/no/unknown"
        }
      },
      "cross_equipment_correlation": {
        "simultaneous_failures": "low/medium/high/unknown",
        "independent_failures": "low/medium/high/unknown",
        "cascading_failures": "low/medium/high/unknown"
      },
      "temporal_clustering": {
        "clustered": "low/medium/high/unknown",
        "distributed": "low/medium/high/unknown",
        "seasonal": "yes/no/unknown"
      }
    }
  }
}
```

### Usage
```bash
python models/gap_analysis.py input_data.csv --city "location_name" -f text
```

### Input Requirements
- CSV file with time column and power columns
- Optional city name for weather correlation analysis
- Power columns should contain numeric values (NaN for missing data)

### Output Files
- `[input_file]_gap_analysis.text`: JSON results file
- Console output with summary statistics

## Interpolation Engine (`interpolation.py`)

### What It Does
Takes the gap analysis output and performs intelligent interpolation using the recommended method. Provides comprehensive validation metrics including SMAPE, MAPE, R², MAE, RMSE, and correlation.

### Available Methods
- **spline_interpolation**: Cubic spline for short gaps
- **gaussian_process**: GP regression for medium gaps with uncertainty
- **physics_based_model**: Solar physics-based interpolation
- **multi_output_regression**: LightGBM for correlated equipment (recommended)
- **system_level_interpolation**: Alias for multi-output regression
- **degradation_aware_interpolation**: GP regression for degradation patterns
- **maintenance_aware_interpolation**: Physics-based for maintenance patterns
- **equipment_specific_interpolation**: Spline for equipment-specific gaps

### Validation Metrics
The interpolation engine provides comprehensive validation metrics:
- **R² Score**: Explained variance (higher is better)
- **SMAPE**: Symmetric Mean Absolute Percentage Error (lower is better)
- **MAPE**: Mean Absolute Percentage Error (lower is better)
- **MAE**: Mean Absolute Error (lower is better)
- **RMSE**: Root Mean Square Error (lower is better)
- **Correlation**: Linear relationship strength (higher is better)

### Usage
```bash
# List available methods
python interpolation.py --list-methods

# Run with gap analysis recommendations
python interpolation.py chart.csv chart_gap_analysis.text

# Run with specific method
python interpolation.py chart.csv chart_gap_analysis.text -m multi_output_regression

# Skip validation (faster)
python interpolation.py chart.csv chart_gap_analysis.text --no-validation

# Custom output directory
python interpolation.py chart.csv chart_gap_analysis.text -o results/
```

### Output Files
- `[input_file]_interpolated_[method].csv`: Complete dataset with interpolated values
- `[input_file]_interpolation_summary_[method].json`: Detailed metrics and metadata

### Integration with Gap Analysis
The interpolation engine automatically:
1. Reads gap analysis recommendations
2. Selects the optimal interpolation method
3. Applies solar physics constraints (nighttime = 0, no negative values)
4. Provides validation metrics on held-out data
5. Generates comprehensive reports

### Key Features
- **Automatic Method Selection**: Uses gap analysis recommendations
- **Validation System**: Creates validation splits and calculates realistic metrics
- **Solar Physics Constraints**: Enforces realistic solar generation patterns
- **Comprehensive Metrics**: SMAPE, MAPE, R², MAE, RMSE, correlation
- **Multiple Methods**: 8 different interpolation approaches
- **Error Handling**: Graceful fallbacks and robust error management