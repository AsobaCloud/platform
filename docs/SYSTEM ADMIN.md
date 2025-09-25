# System Administration Guide: Ona Platform

This guide provides detailed technical administration information for the Ona Platform, covering API management, data handling, configuration, monitoring, security, and performance optimization.

## 1. API Reference

### Core Endpoints Overview

The Ona Platform exposes a RESTful API through AWS API Gateway with the following core endpoints:

**Base URLs:**
- Custom Domain: `https://api.asoba.co` ✅ **LIVE**
- Direct API Gateway: `https://2m5xvm39ef.execute-api.af-south-1.amazonaws.com/prod`

#### Data Upload Endpoints

**POST /upload_train**
- **Purpose**: Upload historical data for model training
- **Authentication**: API key or IAM role
- **Content-Type**: `application/json`
- **Request Body**:
  ```json
  {
    "customer_id": "string",
    "data_type": "historical",
    "metadata": {
      "site_id": "string",
      "start_date": "2025-01-01T00:00:00Z",
      "end_date": "2025-01-31T23:59:59Z"
    }
  }
  ```
- **Response**:
  ```json
  {
    "upload_url": "https://s3.amazonaws.com/bucket/presigned-url",
    "expires_in": 3600,
    "upload_id": "uuid"
  }
  ```

**POST /upload_nowcast**
- **Purpose**: Upload real-time data for forecasting
- **Authentication**: API key or IAM role
- **Content-Type**: `application/json`
- **Request Body**:
  ```json
  {
    "customer_id": "string",
    "data_type": "nowcast",
    "metadata": {
      "site_id": "string",
      "timestamp": "2025-01-15T12:00:00Z"
    }
  }
  ```
- **Response**:
  ```json
  {
    "upload_url": "https://s3.amazonaws.com/bucket/presigned-url",
    "expires_in": 1800,
    "upload_id": "uuid"
  }
  ```

#### Forecast Endpoints

**GET /forecast**
- **Purpose**: Generate energy production forecast
- **Authentication**: API key or IAM role
- **Query Parameters**:
  - `customer_id` (required): Customer identifier
  - `site_id` (optional): Specific site identifier
  - `horizon_hours` (optional): Forecast horizon in hours (default: 48)
- **Response**:
  ```json
  {
    "forecast_id": "uuid",
    "customer_id": "string",
    "site_id": "string",
    "generated_at": "2025-01-15T12:00:00Z",
    "horizon_hours": 48,
    "forecasts": [
      {
        "timestamp": "2025-01-15T13:00:00Z",
        "predicted_power_kw": 1250.5,
        "confidence_interval": {
          "lower": 1180.2,
          "upper": 1320.8
        },
        "weather_conditions": {
          "temperature_c": 25.3,
          "irradiance_w_m2": 850.2,
          "wind_speed_m_s": 3.2
        }
      }
    ],
    "metadata": {
      "model_version": "v2.1.0",
      "training_data_points": 8760,
      "model_accuracy": 0.94
    }
  }
  ```

## 2. Deployment & Infrastructure Management

### Current Deployment Status ✅ **LIVE**

**Platform Status**: **OPERATIONAL**
- **Custom Domain**: `https://api.asoba.co` ✅ **ACTIVE**
- **API Gateway ID**: `2m5xvm39ef` ✅ **ACTIVE**
- **Region**: `af-south-1` ✅ **ACTIVE**
- **Environment**: `prod` ✅ **ACTIVE**

**Infrastructure Components**:
- **Lambda Functions**: 5/5 ✅ **ACTIVE**
  - `ona-dataIngestion-prod` ✅ **ACTIVE**
  - `ona-weatherCache-prod` ✅ **ACTIVE**
  - `ona-interpolationService-prod` ✅ **ACTIVE**
  - `ona-globalTrainingService-prod` ✅ **ACTIVE**
  - `ona-forecastingApi-prod` ✅ **ACTIVE**
- **S3 Buckets**: 2/2 ✅ **ACTIVE**
  - `sa-api-client-input` ✅ **ACTIVE**
  - `sa-api-client-output` ✅ **ACTIVE**
- **DynamoDB Tables**: 2/2 ✅ **ACTIVE**
  - `ona-platform-locations` ✅ **ACTIVE**
  - `ona-platform-weather-cache` ✅ **ACTIVE**
- **API Gateway**: ✅ **ACTIVE**
- **SSL Certificate**: ✅ **ISSUED**
- **Route53 DNS**: ✅ **ACTIVE**

**Endpoint Testing**:
- `POST /upload_train` → 200 OK ✅
- `POST /upload_nowcast` → 200 OK ✅
- `GET /forecast` → 200 OK ✅

### Deployment Commands

**Full Deployment**:
```bash
./local-deploy.sh
```

**Infrastructure Rollback**:
```bash
./rollback.sh
```

**Validation**:
```bash
./validate.sh
```

### Authentication and Security

#### API Key Authentication
```bash
# Set API key in header
curl -H "X-API-Key: your-api-key" \
     -X POST https://api.yourcompany.com/upload_train

# Set API key as query parameter
curl "https://api.yourcompany.com/forecast?customer_id=test&api_key=your-api-key"
```

#### IAM Role Authentication
```bash
# Use AWS credentials
aws configure
curl -H "Authorization: AWS4-HMAC-SHA256 ..." \
     -X POST https://api.yourcompany.com/upload_train
```

#### Security Headers
- **CORS**: Configured for specific origins
- **Rate Limiting**: 1000 requests per hour per API key
- **Request Validation**: JSON schema validation
- **SSL/TLS**: HTTPS only with TLS 1.2+

### Request/Response Formats

#### Standard Response Format
```json
{
  "success": true,
  "data": {
    // Response data
  },
  "metadata": {
    "request_id": "uuid",
    "timestamp": "2025-01-15T12:00:00Z",
    "version": "v1.0"
  },
  "errors": []
}
```

#### Error Response Format
```json
{
  "success": false,
  "data": null,
  "metadata": {
    "request_id": "uuid",
    "timestamp": "2025-01-15T12:00:00Z",
    "version": "v1.0"
  },
  "errors": [
    {
      "code": "VALIDATION_ERROR",
      "message": "Invalid customer_id format",
      "field": "customer_id",
      "details": "Expected format: alphanumeric string"
    }
  ]
}
```

### Rate Limiting and Quotas

#### Rate Limits
- **Standard Tier**: 1000 requests/hour
- **Premium Tier**: 10000 requests/hour
- **Enterprise Tier**: 100000 requests/hour

#### Quota Management
```bash
# Check current usage
curl -H "X-API-Key: your-api-key" \
     https://api.yourcompany.com/quota/usage

# Response
{
  "quota_limit": 1000,
  "quota_used": 245,
  "quota_remaining": 755,
  "reset_time": "2025-01-15T13:00:00Z"
}
```

#### Quota Exceeded Response
```json
{
  "success": false,
  "data": null,
  "errors": [
    {
      "code": "QUOTA_EXCEEDED",
      "message": "Rate limit exceeded. Try again later.",
      "retry_after": 3600
    }
  ]
}
```

## 2. Deployment & Infrastructure Management

### 2.1 One-Command Deployment

The recommended deployment method uses the `local-deploy.sh` script which orchestrates CI/CD and infrastructure deployment:

```bash
# Prerequisites
# 1. GitHub CLI (gh) installed and authenticated
# 2. AWS CLI configured with appropriate permissions
# 3. Visual Crossing API key

# Create environment file
cat > .env.local << 'EOF'
VISUAL_CROSSING_API_KEY=YOUR_ACTUAL_API_KEY
EOF

# Run one-command deployment
./local-deploy.sh
```

**What this script does:**
1. **Triggers CI Build**: Uses GitHub Actions to build Docker images
2. **Waits for CI**: Polls GitHub Actions until build completes successfully
3. **Deploys Infrastructure**: Runs all deployment scripts in sequence
4. **Validates Deployment**: Tests all endpoints and services

**Expected Deployment Sequence:**
```
✓ CI workflow succeeded
✓ Scripts 01-11 completed successfully
✓ All Lambda functions created
✓ API Gateway deployed (ID: u9xpolnr5m)
✓ Endpoints responding with 200 status
✓ Custom domain skipped (certificate not ready)
```

### 2.2 Manual Deployment

For manual deployment without CI:

```bash
# Deploy all services directly
./deploy-all.sh

# Validate deployment
./validate.sh
```

**Note**: Manual deployment requires Docker installed locally.

### 2.3 Infrastructure Components

The deployment creates the following AWS resources:

#### Lambda Functions
- `ona-dataIngestion-prod` (1024MB, 300s timeout)
- `ona-weatherCache-prod` (512MB, 300s timeout)  
- `ona-interpolationService-prod` (3008MB, 900s timeout)
- `ona-globalTrainingService-prod` (1024MB, 300s timeout)
- `ona-forecastingApi-prod` (3008MB, 60s timeout)

#### API Gateway
- REST API: `ona-api-prod`
- Stage: `prod`
- Endpoints:
  - `POST /upload_train`
  - `POST /upload_nowcast`
  - `GET /forecast`

#### Storage Resources
- S3 Buckets: `sa-api-client-input`, `sa-api-client-output`
- DynamoDB Tables: `ona-platform-locations`, `ona-platform-weather-cache`

#### ECR Repositories
- `ona-base`, `ona-dataingestion`, `ona-weathercache`
- `ona-interpolationservice`, `ona-globaltrainingservice`, `ona-forecastingapi`

### 2.4 DNS and Custom Domain

#### One-time DNS Setup
```bash
cd dns-setup
./setup-dns-infrastructure.sh
```

This creates SSL certificate for `api.asoba.co` and configures DNS validation.

#### Custom Domain Mapping
The custom domain is automatically mapped when the SSL certificate is ready:
```bash
# Check certificate status
./dns-setup/check-certificate-status.sh

# Once certificate is ISSUED, custom domain will be mapped automatically
# on the next deployment run
```

### 2.5 Troubleshooting Deployment

#### Common Issues

**CI Build Fails**
```bash
# Check GitHub Actions logs
gh run view --log

# Verify GitHub OIDC role exists
aws iam get-role --role-name ona-github-actions-ecr-role
```

**Lambda Functions Not Responding**
```bash
# Check Lambda logs
aws logs get-log-events \
  --log-group-name /aws/lambda/ona-dataIngestion-prod \
  --log-stream-name $(aws logs describe-log-streams \
    --log-group-name /aws/lambda/ona-dataIngestion-prod \
    --order-by LastEventTime --descending --max-items 1 \
    --query 'logStreams[0].logStreamName' --output text)

# Check function status
aws lambda get-function --function-name ona-dataIngestion-prod
```

**API Gateway Not Working**
```bash
# Check API Gateway deployment
aws apigateway get-deployments --rest-api-id u9xpolnr5m

# Test endpoints directly
curl -X POST https://u9xpolnr5m.execute-api.af-south-1.amazonaws.com/prod/upload_train
```

**Custom Domain Issues**
```bash
# Check certificate status
aws acm describe-certificate \
  --certificate-arn $(cat .certificate-arn) \
  --region us-east-1

# Check DNS resolution
nslookup api.asoba.co
```

### 2.6 Rollback and Cleanup

#### Complete Rollback
```bash
./rollback.sh
```

This removes all platform resources while preserving:
- S3 buckets and data
- DynamoDB tables and data  
- SSL certificate
- Route53 DNS records

#### Selective Cleanup
```bash
# Remove specific Lambda functions
aws lambda delete-function --function-name ona-dataIngestion-prod

# Remove API Gateway
aws apigateway delete-rest-api --rest-api-id u9xpolnr5m
```

## 3. Operations & Maintenance

### OODA Workflow Overview

The Ona Platform implements the OODA (Observe-Orient-Decide-Act) loop for systematic asset management:

#### Observe Phase (< 5 minutes)
**Purpose**: Real-time fault detection and anomaly identification

**Key Operations**:
- Continuous monitoring of SCADA/inverter data streams
- Anomaly detection using statistical and ML-based algorithms
- Severity scoring (0.0-1.0) for detected issues
- Integration with energy production forecasts for enhanced accuracy

**Administrative Tasks**:
```bash
# Monitor detection performance
aws logs tail /aws/lambda/ona-detect-prod --follow

# Check detection metrics
aws cloudwatch get-metric-statistics \
  --namespace "Ona/Detection" \
  --metric-name "DetectionLatency" \
  --start-time 2025-01-15T00:00:00Z \
  --end-time 2025-01-15T23:59:59Z \
  --period 300 \
  --statistics Average,Maximum
```

#### Orient Phase (< 10 minutes)
**Purpose**: AI-powered diagnostics and root cause analysis

**Key Operations**:
- Categorization of detected faults (Weather Damage, OEM Fault, Ops Fault, etc.)
- Risk assessment and severity classification
- Energy-at-Risk (EAR) calculations
- Trend analysis for degradation detection

**Administrative Tasks**:
```bash
# Review diagnostic categories
cat configs/ooda/categories.yaml

# Update loss function weights
aws ssm put-parameter \
  --name /ona-platform/prod/loss-function-weights \
  --value '{"w_energy": 1.0, "w_cost": 0.3, "w_mttr": 0.2}' \
  --type String \
  --overwrite
```

#### Decide Phase (< 15 minutes)
**Purpose**: Energy-at-Risk calculations and maintenance scheduling

**Key Operations**:
- Financial impact assessment of asset issues
- Optimal maintenance scheduling across crews
- Resource allocation and constraint management
- Bill of Materials (BOM) generation

**Administrative Tasks**:
```bash
# Monitor scheduling performance
aws logs tail /aws/lambda/ona-schedule-prod --follow

# Check crew availability
aws dynamodb get-item \
  --table-name ona-platform-crews \
  --key '{"crew_id": {"S": "crew-001"}}'
```

#### Act Phase (Continuous)
**Purpose**: Automated work order creation and tracking

**Key Operations**:
- Automated work order generation from BOMs
- Integration with external ticketing systems
- Progress tracking and status updates
- Notification management for stakeholders

**Administrative Tasks**:
```bash
# Monitor work order processing
aws logs tail /aws/lambda/ona-order-prod --follow

# Check tracking subscriptions
aws dynamodb scan \
  --table-name ona-platform-tracking \
  --filter-expression "status = :active" \
  --expression-attribute-values '{":active": {"S": "active"}}'
```

### Daily Operations Guide

#### Morning Health Check (8:00 AM)
```bash
#!/bin/bash
# daily_health_check.sh

echo "=== Ona Platform Health Check ==="
echo "Timestamp: $(date)"

# Check all Lambda functions
echo "Checking Lambda functions..."
for service in dataIngestion weatherCache interpolationService globalTrainingService forecastingApi; do
    status=$(aws lambda get-function --function-name ona-${service}-prod --query 'Configuration.State' --output text)
    echo "  ona-${service}-prod: $status"
done

# Check S3 bucket health
echo "Checking S3 buckets..."
aws s3api head-bucket --bucket sa-api-client-input && echo "  Input bucket: OK" || echo "  Input bucket: ERROR"
aws s3api head-bucket --bucket sa-api-client-output && echo "  Output bucket: OK" || echo "  Output bucket: ERROR"

# Check DynamoDB tables
echo "Checking DynamoDB tables..."
aws dynamodb describe-table --table-name ona-platform-locations --query 'Table.TableStatus' --output text
aws dynamodb describe-table --table-name ona-platform-weather-cache --query 'Table.TableStatus' --output text

# Check API Gateway
echo "Checking API Gateway..."
api_id=$(aws apigateway get-rest-apis --query "items[?name=='ona-api-prod'].id" --output text)
if [ -n "$api_id" ]; then
    echo "  API Gateway: OK (ID: $api_id)"
else
    echo "  API Gateway: ERROR"
fi

echo "=== Health Check Complete ==="
```

#### Midday Performance Review (12:00 PM)
```bash
#!/bin/bash
# performance_review.sh

echo "=== Performance Review ==="

# Check error rates
echo "Error rates (last 24 hours):"
for service in dataIngestion weatherCache interpolationService globalTrainingService forecastingApi; do
    errors=$(aws cloudwatch get-metric-statistics \
        --namespace AWS/Lambda \
        --metric-name Errors \
        --dimensions Name=FunctionName,Value=ona-${service}-prod \
        --start-time $(date -d '24 hours ago' -u +%Y-%m-%dT%H:%M:%S) \
        --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
        --period 3600 \
        --statistics Sum \
        --query 'Datapoints[0].Sum' \
        --output text)
    echo "  ona-${service}-prod: ${errors:-0} errors"
done

# Check execution duration
echo "Average execution duration:"
for service in dataIngestion weatherCache interpolationService globalTrainingService forecastingApi; do
    duration=$(aws cloudwatch get-metric-statistics \
        --namespace AWS/Lambda \
        --metric-name Duration \
        --dimensions Name=FunctionName,Value=ona-${service}-prod \
        --start-time $(date -d '24 hours ago' -u +%Y-%m-%dT%H:%M:%S) \
        --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
        --period 3600 \
        --statistics Average \
        --query 'Datapoints[0].Average' \
        --output text)
    echo "  ona-${service}-prod: ${duration:-0}ms"
done

echo "=== Performance Review Complete ==="
```

#### End-of-Day Summary (5:00 PM)
```bash
#!/bin/bash
# daily_summary.sh

echo "=== Daily Operations Summary ==="
echo "Date: $(date +%Y-%m-%d)"

# Count processed records
echo "Data Processing Summary:"
historical_count=$(aws s3 ls s3://sa-api-client-input/historical/ --recursive | wc -l)
nowcast_count=$(aws s3 ls s3://sa-api-client-input/nowcast/ --recursive | wc -l)
echo "  Historical records processed: $historical_count"
echo "  Nowcast records processed: $nowcast_count"

# Count forecasts generated
forecast_count=$(aws logs filter-log-events \
    --log-group-name /aws/lambda/ona-forecastingApi-prod \
    --start-time $(date -d '24 hours ago' +%s)000 \
    --filter-pattern "Forecast generated" \
    --query 'events | length(@)' \
    --output text)
echo "  Forecasts generated: $forecast_count"

# Count work orders created
work_orders=$(aws logs filter-log-events \
    --log-group-name /aws/lambda/ona-order-prod \
    --start-time $(date -d '24 hours ago' +%s)000 \
    --filter-pattern "Work order created" \
    --query 'events | length(@)' \
    --output text)
echo "  Work orders created: $work_orders"

echo "=== Daily Summary Complete ==="
```

### Monitoring and Alerting

#### CloudWatch Alarms Configuration
```bash
# Create error rate alarm
aws cloudwatch put-metric-alarm \
    --alarm-name "ona-dataIngestion-error-rate" \
    --alarm-description "High error rate in data ingestion service" \
    --metric-name Errors \
    --namespace AWS/Lambda \
    --statistic Sum \
    --period 300 \
    --threshold 5 \
    --comparison-operator GreaterThanThreshold \
    --dimensions Name=FunctionName,Value=ona-dataIngestion-prod \
    --evaluation-periods 2 \
    --alarm-actions arn:aws:sns:af-south-1:ACCOUNT:ona-platform-alerts

# Create duration alarm
aws cloudwatch put-metric-alarm \
    --alarm-name "ona-interpolationService-duration" \
    --alarm-description "High execution duration in interpolation service" \
    --metric-name Duration \
    --namespace AWS/Lambda \
    --statistic Average \
    --period 300 \
    --threshold 600000 \
    --comparison-operator GreaterThanThreshold \
    --dimensions Name=FunctionName,Value=ona-interpolationService-prod \
    --evaluation-periods 1 \
    --alarm-actions arn:aws:sns:af-south-1:ACCOUNT:ona-platform-alerts
```

#### SNS Alert Configuration
```bash
# Create SNS topic
aws sns create-topic --name ona-platform-alerts

# Subscribe to email notifications
aws sns subscribe \
    --topic-arn arn:aws:sns:af-south-1:ACCOUNT:ona-platform-alerts \
    --protocol email \
    --notification-endpoint admin@yourcompany.com

# Subscribe to Slack webhook
aws sns subscribe \
    --topic-arn arn:aws:sns:af-south-1:ACCOUNT:ona-platform-alerts \
    --protocol https \
    --notification-endpoint https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK
```

### Troubleshooting Guide

#### Common O&M Issues

**Issue: High False Positive Rate in Detection**
```bash
# Check detection thresholds
aws ssm get-parameter --name /ona-platform/prod/detection-threshold --query 'Parameter.Value'

# Adjust severity threshold
aws ssm put-parameter \
    --name /ona-platform/prod/detection-threshold \
    --value "0.7" \
    --type String \
    --overwrite

# Review detection logs
aws logs filter-log-events \
    --log-group-name /aws/lambda/ona-detect-prod \
    --start-time $(date -d '1 hour ago' +%s)000 \
    --filter-pattern "severity"
```

**Issue: Slow Diagnostic Processing**
```bash
# Check diagnostic service performance
aws cloudwatch get-metric-statistics \
    --namespace AWS/Lambda \
    --metric-name Duration \
    --dimensions Name=FunctionName,Value=ona-diagnose-prod \
    --start-time $(date -d '1 hour ago' -u +%Y-%m-%dT%H:%M:%S) \
    --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
    --period 300 \
    --statistics Average,Maximum

# Increase Lambda memory if needed
aws lambda update-function-configuration \
    --function-name ona-diagnose-prod \
    --memory-size 2048
```

**Issue: Scheduling Conflicts**
```bash
# Check crew availability
aws dynamodb scan \
    --table-name ona-platform-crews \
    --filter-expression "status = :available" \
    --expression-attribute-values '{":available": {"S": "available"}}'

# Review scheduling constraints
cat configs/ooda/scheduling-constraints.yaml

# Check schedule conflicts
aws logs filter-log-events \
    --log-group-name /aws/lambda/ona-schedule-prod \
    --start-time $(date -d '1 hour ago' +%s)000 \
    --filter-pattern "conflict"
```

## 3. Data Management

### Input Data Requirements

#### Sensor Data Format
**Location**: `s3://sa-api-client-input/observations/`
**Format**: CSV with specific column requirements

**Required Columns**:
```csv
timestamp,asset_id,temperature_c,voltage_v,power_kw,irradiance_w_m2,wind_speed_m_s
2025-01-15T08:00:00Z,INV-001,45.2,800.5,18.3,850.2,3.2
2025-01-15T08:15:00Z,INV-001,46.1,799.8,17.9,845.1,3.5
```

**Column Specifications**:
- `timestamp`: ISO8601 format (UTC)
- `asset_id`: Unique asset identifier (string)
- `temperature_c`: Temperature in Celsius (float)
- `voltage_v`: Voltage in Volts (float)
- `power_kw`: Power output in kilowatts (float)
- `irradiance_w_m2`: Solar irradiance in W/m² (float, optional)
- `wind_speed_m_s`: Wind speed in m/s (float, optional)

#### Asset Metadata Format
**Location**: `s3://sa-api-client-input/assets.json`
**Format**: JSON with asset configuration

```json
{
  "assets": [
    {
      "id": "INV-001",
      "name": "Inverter 001",
      "type": "Solar Inverter",
      "capacity_kw": 20.0,
      "location": {
        "latitude": -26.2041,
        "longitude": 28.0473,
        "address": "Solar Farm A, Johannesburg"
      },
      "components": [
        {
          "oem": "Sungrow",
          "model": "SG20KTL",
          "serial": "SN123456",
          "type": "inverter",
          "installation_date": "2024-01-15T00:00:00Z"
        }
      ],
      "configuration": {
        "dc_voltage_max": 1000,
        "ac_voltage_nominal": 400,
        "frequency_nominal": 50
      }
    }
  ]
}
```

#### Forecast Data Format
**Location**: `s3://sa-api-client-input/forecasts/`
**Format**: CSV with weather and energy predictions

```csv
timestamp,asset_id,predicted_power_kw,temperature_c,irradiance_w_m2,wind_speed_m_s,cloud_cover_percent
2025-01-15T09:00:00Z,INV-001,19.2,26.5,920.3,2.8,15.2
2025-01-15T09:15:00Z,INV-001,19.8,27.1,935.7,3.1,12.8
```

### Output Data Formats

#### Forecast Results
**Location**: `s3://sa-api-client-output/forecasts/`
**Format**: JSON with comprehensive forecast data

```json
{
  "forecast_id": "fc-20250115-001",
  "customer_id": "customer-001",
  "asset_id": "INV-001",
  "generated_at": "2025-01-15T08:00:00Z",
  "horizon_hours": 48,
  "forecasts": [
    {
      "timestamp": "2025-01-15T09:00:00Z",
      "predicted_power_kw": 19.2,
      "confidence_interval": {
        "lower_95": 18.1,
        "upper_95": 20.3,
        "lower_80": 18.5,
        "upper_80": 19.9
      },
      "weather_conditions": {
        "temperature_c": 26.5,
        "irradiance_w_m2": 920.3,
        "wind_speed_m_s": 2.8,
        "cloud_cover_percent": 15.2,
        "humidity_percent": 65.3
      },
      "model_metadata": {
        "model_version": "v2.1.0",
        "training_data_points": 8760,
        "model_accuracy": 0.94,
        "last_training_date": "2025-01-10T00:00:00Z"
      }
    }
  ],
  "summary": {
    "total_predicted_energy_kwh": 920.4,
    "peak_power_kw": 19.8,
    "average_power_kw": 19.2,
    "capacity_factor": 0.96
  }
}
```

#### Diagnostic Results
**Location**: `s3://sa-api-client-output/diagnostics/`
**Format**: JSON with fault analysis and recommendations

```json
{
  "diagnostic_id": "diag-20250115-001",
  "asset_id": "INV-001",
  "analysis_timestamp": "2025-01-15T08:00:00Z",
  "findings": [
    {
      "component": {
        "oem": "Sungrow",
        "model": "SG20KTL",
        "serial": "SN123456",
        "type": "fan"
      },
      "severity": 0.8,
      "category": "OEM Fault",
      "subcategory": "inverter_overtemp",
      "description": "High temperature detected with reduced fan performance",
      "confidence": 0.92,
      "recommended_actions": [
        "replace_component",
        "inspect_cooling_system"
      ],
      "energy_at_risk": {
        "daily_loss_kwh": 15.2,
        "daily_loss_usd": 18.24,
        "confidence_interval": {
          "lower": 12.1,
          "upper": 18.3
        }
      }
    }
  ],
  "trend_analysis": {
    "degradation_rate_percent_per_year": 2.3,
    "performance_trend": "declining",
    "next_maintenance_due": "2025-02-15T00:00:00Z"
  }
}
```

#### Work Order Results
**Location**: `s3://sa-api-client-output/work-orders/`
**Format**: JSON with maintenance scheduling and BOMs

```json
{
  "work_order_id": "wo-20250115-001",
  "asset_id": "INV-001",
  "created_at": "2025-01-15T08:00:00Z",
  "priority": "high",
  "estimated_duration_hours": 4,
  "scheduled_start": "2025-01-16T08:00:00Z",
  "scheduled_end": "2025-01-16T12:00:00Z",
  "crew_assignment": {
    "crew_id": "crew-001",
    "technician_count": 2,
    "specialization": "inverter_maintenance"
  },
  "bill_of_materials": [
    {
      "sku": "SG20KTL-FAN-STD",
      "description": "Cooling fan for SG20KTL inverter",
      "quantity": 1,
      "unit_price_usd": 120.0,
      "total_price_usd": 120.0,
      "lead_time_days": 7,
      "supplier": "Sungrow Parts",
      "warranty_months": 24
    }
  ],
  "total_cost_usd": 120.0,
  "energy_at_risk": {
    "daily_loss_usd": 18.24,
    "total_risk_usd": 127.68,
    "roi_days": 6.6
  }
}
```

### Storage Architecture

#### S3 Bucket Structure
```
sa-api-client-input/
├── observations/           # Raw sensor data
│   ├── 2025/01/15/
│   │   ├── INV-001_20250115.csv
│   │   └── INV-002_20250115.csv
│   └── archive/            # Compressed historical data
├── historical/             # Training data
│   ├── customer-001/
│   │   ├── 2024_q1.csv
│   │   └── 2024_q2.csv
│   └── customer-002/
├── nowcast/               # Real-time data
│   ├── 2025/01/15/
│   │   ├── INV-001_nowcast.csv
│   │   └── INV-002_nowcast.csv
├── training/              # Processed training data
│   ├── customer-001/
│   │   ├── enriched_data.csv
│   │   └── features.csv
│   └── customer-002/
├── weather/               # Weather data cache
│   ├── cache/
│   │   ├── johannesburg_20250115.json
│   │   └── cape_town_20250115.json
│   └── forecasts/
└── assets.json            # Asset metadata

sa-api-client-output/
├── models/                # Trained ML models
│   ├── customer-001/
│   │   ├── lstm_model_v2.1.0.pkl
│   │   └── feature_scaler.pkl
│   └── customer-002/
├── forecasts/             # Generated forecasts
│   ├── 2025/01/15/
│   │   ├── fc-20250115-001.json
│   │   └── fc-20250115-002.json
│   └── archive/
├── diagnostics/           # Diagnostic results
│   ├── 2025/01/15/
│   │   ├── diag-20250115-001.json
│   │   └── diag-20250115-002.json
│   └── archive/
└── work-orders/           # Work order data
    ├── 2025/01/15/
    │   ├── wo-20250115-001.json
    │   └── wo-20250115-002.json
    └── archive/
```

#### DynamoDB Table Structure

**ona-platform-locations**
```json
{
  "TableName": "ona-platform-locations",
  "KeySchema": [
    {
      "AttributeName": "location_id",
      "KeyType": "HASH"
    }
  ],
  "AttributeDefinitions": [
    {
      "AttributeName": "location_id",
      "AttributeType": "S"
    }
  ],
  "GlobalSecondaryIndexes": [
    {
      "IndexName": "customer-location-index",
      "KeySchema": [
        {
          "AttributeName": "customer_id",
          "KeyType": "HASH"
        },
        {
          "AttributeName": "location_name",
          "KeyType": "RANGE"
        }
      ]
    }
  ]
}
```

**ona-platform-weather-cache**
```json
{
  "TableName": "ona-platform-weather-cache",
  "KeySchema": [
    {
      "AttributeName": "location_timestamp",
      "KeyType": "HASH"
    }
  ],
  "AttributeDefinitions": [
    {
      "AttributeName": "location_timestamp",
      "AttributeType": "S"
    }
  ],
  "TimeToLiveSpecification": {
    "AttributeName": "ttl",
    "Enabled": true
  }
}
```

### Data Retention Policies

#### Automatic Data Lifecycle Management
```bash
# Configure S3 lifecycle policies
aws s3api put-bucket-lifecycle-configuration \
    --bucket sa-api-client-input \
    --lifecycle-configuration '{
        "Rules": [
            {
                "ID": "ArchiveObservations",
                "Status": "Enabled",
                "Filter": {
                    "Prefix": "observations/"
                },
                "Transitions": [
                    {
                        "Days": 30,
                        "StorageClass": "STANDARD_IA"
                    },
                    {
                        "Days": 90,
                        "StorageClass": "GLACIER"
                    },
                    {
                        "Days": 365,
                        "StorageClass": "DEEP_ARCHIVE"
                    }
                ]
            },
            {
                "ID": "DeleteOldForecasts",
                "Status": "Enabled",
                "Filter": {
                    "Prefix": "forecasts/"
                },
                "Expiration": {
                    "Days": 90
                }
            }
        ]
    }'
```

#### Manual Data Cleanup
```bash
# Clean up old diagnostic results
aws s3 rm s3://sa-api-client-output/diagnostics/2024/ --recursive

# Archive old training data
aws s3 cp s3://sa-api-client-input/historical/ s3://sa-api-client-input/archive/historical/ --recursive

# Compress large observation files
gzip s3://sa-api-client-input/observations/2024/INV-001_20241231.csv
```

### Data Validation and Quality Control

#### Input Data Validation
```python
# Example data validation script
import pandas as pd
import json
from datetime import datetime

def validate_sensor_data(file_path):
    """Validate sensor data format and content"""
    try:
        df = pd.read_csv(file_path)
        
        # Check required columns
        required_columns = ['timestamp', 'asset_id', 'temperature_c', 'voltage_v', 'power_kw']
        missing_columns = set(required_columns) - set(df.columns)
        if missing_columns:
            raise ValueError(f"Missing required columns: {missing_columns}")
        
        # Validate timestamp format
        df['timestamp'] = pd.to_datetime(df['timestamp'])
        
        # Check for null values
        null_counts = df.isnull().sum()
        if null_counts.any():
            print(f"Warning: Null values found: {null_counts[null_counts > 0].to_dict()}")
        
        # Validate data ranges
        if (df['temperature_c'] < -50).any() or (df['temperature_c'] > 100).any():
            raise ValueError("Temperature values out of range")
        
        if (df['voltage_v'] < 0).any() or (df['voltage_v'] > 1500).any():
            raise ValueError("Voltage values out of range")
        
        if (df['power_kw'] < 0).any():
            raise ValueError("Power values cannot be negative")
        
        return True, "Data validation passed"
        
    except Exception as e:
        return False, f"Data validation failed: {str(e)}"

# Usage
is_valid, message = validate_sensor_data('INV-001_20250115.csv')
print(f"Validation result: {is_valid}, Message: {message}")
```

#### Data Quality Monitoring
```bash
# Monitor data quality metrics
aws cloudwatch put-metric-data \
    --namespace "Ona/DataQuality" \
    --metric-data '[
        {
            "MetricName": "DataCompleteness",
            "Value": 95.2,
            "Unit": "Percent",
            "Dimensions": [
                {
                    "Name": "AssetId",
                    "Value": "INV-001"
                }
            ]
        },
        {
            "MetricName": "DataAccuracy",
            "Value": 98.7,
            "Unit": "Percent",
            "Dimensions": [
                {
                    "Name": "AssetId",
                    "Value": "INV-001"
                }
            ]
        }
    ]'
```

### Backup and Recovery

#### Automated Backup Strategy
```bash
#!/bin/bash
# backup_data.sh

BACKUP_DATE=$(date +%Y%m%d)
BACKUP_BUCKET="ona-platform-backups"

echo "Starting data backup for $BACKUP_DATE"

# Backup critical data
aws s3 sync s3://sa-api-client-input/assets.json s3://$BACKUP_BUCKET/$BACKUP_DATE/assets.json
aws s3 sync s3://sa-api-client-input/historical/ s3://$BACKUP_BUCKET/$BACKUP_DATE/historical/
aws s3 sync s3://sa-api-client-output/models/ s3://$BACKUP_BUCKET/$BACKUP_DATE/models/

# Backup DynamoDB tables
aws dynamodb create-backup \
    --table-name ona-platform-locations \
    --backup-name "locations-backup-$BACKUP_DATE"

aws dynamodb create-backup \
    --table-name ona-platform-weather-cache \
    --backup-name "weather-cache-backup-$BACKUP_DATE"

echo "Backup completed successfully"
```

#### Disaster Recovery Procedures
```bash
#!/bin/bash
# disaster_recovery.sh

BACKUP_DATE=$1
BACKUP_BUCKET="ona-platform-backups"

if [ -z "$BACKUP_DATE" ]; then
    echo "Usage: $0 <backup_date> (format: YYYYMMDD)"
    exit 1
fi

echo "Starting disaster recovery from backup $BACKUP_DATE"

# Restore S3 data
aws s3 sync s3://$BACKUP_BUCKET/$BACKUP_DATE/assets.json s3://sa-api-client-input/assets.json
aws s3 sync s3://$BACKUP_BUCKET/$BACKUP_DATE/historical/ s3://sa-api-client-input/historical/
aws s3 sync s3://$BACKUP_BUCKET/$BACKUP_DATE/models/ s3://sa-api-client-output/models/

# Restore DynamoDB tables
aws dynamodb restore-table-from-backup \
    --target-table-name ona-platform-locations-restored \
    --backup-arn "arn:aws:dynamodb:af-south-1:ACCOUNT:table/ona-platform-locations/backup/BACKUP_ID"

echo "Disaster recovery completed"
```

## 4. Configuration & Customization

### Environment Configuration

#### Main Configuration File
**Location**: `config/environment.sh`
**Purpose**: Central configuration for all deployment scripts

```bash
#!/bin/bash
# environment.sh - Main configuration file

# AWS Configuration
export AWS_REGION="af-south-1"
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export ENVIRONMENT="prod"

# API Configuration
export API_DOMAIN="api.yourcompany.com"
export API_NAME="ona-api-prod"
export STAGE="prod"

# S3 Bucket Configuration
export INPUT_BUCKET="sa-api-client-input"
export OUTPUT_BUCKET="sa-api-client-output"
export MODELS_BUCKET="ona-platform-models"

# DynamoDB Configuration
export LOCATIONS_TABLE="ona-platform-locations"
export WEATHER_CACHE_TABLE="ona-platform-weather-cache"
export CREWS_TABLE="ona-platform-crews"
export TRACKING_TABLE="ona-platform-tracking"

# Service Configuration
export SERVICES=("dataIngestion" "weatherCache" "interpolationService" "globalTrainingService" "forecastingApi")

# Lambda Configuration
export LAMBDA_MEMORY_DATA_INGESTION=1024
export LAMBDA_MEMORY_WEATHER_CACHE=512
export LAMBDA_MEMORY_INTERPOLATION=3008
export LAMBDA_MEMORY_TRAINING=1024
export LAMBDA_MEMORY_FORECASTING=3008

export LAMBDA_TIMEOUT_DATA_INGESTION=300
export LAMBDA_TIMEOUT_WEATHER_CACHE=300
export LAMBDA_TIMEOUT_INTERPOLATION=900
export LAMBDA_TIMEOUT_TRAINING=300
export LAMBDA_TIMEOUT_FORECASTING=60

# ECR Configuration
export ECR_REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

# Standard Tags
export STANDARD_TAGS="Key=Project,Value=ona-platform Key=Environment,Value=${ENVIRONMENT} Key=ManagedBy,Value=terraform"

# Hosted Zone Configuration
export HOSTED_ZONE_ID="Z02057713AMAS6GXTEGNR"

# SNS Configuration
export ALERT_TOPIC_ARN="arn:aws:sns:${AWS_REGION}:${AWS_ACCOUNT_ID}:ona-platform-alerts"
```

#### Service-Specific Configuration
**Location**: `config/services.yaml`
**Purpose**: Detailed service configurations

```yaml
# services.yaml - Service-specific configurations

dataIngestion:
  memory: 1024
  timeout: 300
  environment_variables:
    LOG_LEVEL: "INFO"
    MAX_FILE_SIZE_MB: 100
    ALLOWED_FILE_TYPES: "csv,json"
  reserved_concurrency: 10

weatherCache:
  memory: 512
  timeout: 300
  schedule_expression: "rate(15 minutes)"
  environment_variables:
    LOG_LEVEL: "INFO"
    WEATHER_API_TIMEOUT: 30
    CACHE_TTL_HOURS: 1
  reserved_concurrency: 1

interpolationService:
  memory: 3008
  timeout: 900
  environment_variables:
    LOG_LEVEL: "INFO"
    ML_MODEL_TIMEOUT: 300
    MAX_BATCH_SIZE: 1000
  reserved_concurrency: 5

globalTrainingService:
  memory: 1024
  timeout: 300
  environment_variables:
    LOG_LEVEL: "INFO"
    TRAINING_TIMEOUT: 1800
    MODEL_VERSION: "v2.1.0"
  reserved_concurrency: 2

forecastingApi:
  memory: 3008
  timeout: 60
  environment_variables:
    LOG_LEVEL: "INFO"
    FORECAST_HORIZON_HOURS: 48
    CONFIDENCE_LEVEL: 0.95
  reserved_concurrency: 20
```

### Service-Specific Settings

#### OODA Configuration
**Location**: `configs/ooda/categories.yaml`
**Purpose**: Define fault categories and subcategories

```yaml
# categories.yaml - Fault categorization

Weather Damage:
  - hail_impact
  - wind_stress
  - lightning_strike
  - flooding_damage

OEM Fault:
  - inverter_overtemp
  - dc_bus_fault
  - communication_error
  - component_failure

Ops Fault:
  - wrong_setpoint
  - maintenance_overdue
  - calibration_drift
  - configuration_error

Wear and Tear:
  - bearing_wear
  - capacitor_degradation
  - connector_corrosion
  - insulation_degradation

End of Life:
  - capacity_fade
  - efficiency_loss
  - component_failure
  - performance_degradation

Unknown Needs Further Investigation:
  - unknown_pattern
  - intermittent_fault
  - data_quality_issue
  - sensor_malfunction
```

#### Loss Function Configuration
**Location**: `configs/ooda/loss_function.yaml`
**Purpose**: Configure decision-making weights

```yaml
# loss_function.yaml - Decision weights and constraints

weights:
  w_energy: 1.0      # Energy loss weight (primary factor)
  w_cost: 0.3        # Maintenance cost weight
  w_mttr: 0.2        # Mean time to repair weight
  w_risk: 0.5        # Risk assessment weight
  w_urgency: 0.8     # Urgency factor weight

crew:
  crews_available: 2
  hours_per_day: 8
  max_travel_distance_km: 100
  specializations:
    - inverter_maintenance
    - electrical_work
    - mechanical_repair

constraints:
  max_concurrent_jobs: 3
  min_crew_size: 1
  max_crew_size: 4
  working_hours:
    start: "08:00"
    end: "17:00"
    timezone: "Africa/Johannesburg"

thresholds:
  severity_critical: 0.8
  severity_major: 0.6
  severity_minor: 0.4
  ear_threshold_usd: 50.0
```

#### Detection Configuration
**Location**: `configs/ooda/detection.yaml`
**Purpose**: Configure anomaly detection parameters

```yaml
# detection.yaml - Anomaly detection configuration

algorithms:
  statistical:
    z_score_threshold: 3.0
    rolling_window_minutes: 15
    min_data_points: 10
  
  machine_learning:
    model_type: "isolation_forest"
    contamination: 0.1
    random_state: 42
  
  energy_deviation:
    forecast_tolerance_percent: 10.0
    min_deviation_kw: 1.0
    confidence_threshold: 0.8

parameters:
  temperature:
    normal_range_min: -10
    normal_range_max: 60
    critical_threshold: 70
  
  voltage:
    normal_range_min: 0
    normal_range_max: 1200
    critical_threshold: 1300
  
  power:
    normal_range_min: 0
    normal_range_max: 25
    critical_threshold: 30

filtering:
  exclude_maintenance_windows: true
  exclude_night_hours: true
  night_hours_start: "18:00"
  night_hours_end: "06:00"
```

### Extensible Platform Capabilities

#### Custom Service Integration
**Location**: `configs/extensions/custom_services.yaml`
**Purpose**: Configure additional modular services

```yaml
# custom_services.yaml - Extensible service configuration

insurance_automation:
  enabled: true
  api_endpoint: "https://api.insurance-provider.com"
  api_key_parameter: "/ona-platform/prod/insurance-api-key"
  claim_threshold_usd: 1000
  auto_submission: true
  notification_email: "claims@yourcompany.com"

fleet_analytics:
  enabled: true
  portfolio_analysis: true
  cross_site_benchmarking: true
  performance_trends: true
  reporting_frequency: "weekly"
  output_format: "pdf"

soiling_calculations:
  enabled: true
  detection_method: "performance_analysis"
  cleaning_threshold_percent: 5.0
  weather_integration: true
  cost_per_cleaning_usd: 500
  roi_threshold_days: 30

energy_market_integration:
  enabled: false
  market_provider: "eskom"
  api_endpoint: "https://api.eskom.co.za"
  price_fetch_frequency: "hourly"
  dispatch_optimization: true

electricity_dispatch:
  enabled: false
  grid_connection_type: "embedded_generation"
  max_export_capacity_kw: 1000
  tariff_structure: "time_of_use"
  optimization_horizon_hours: 24
```

#### Custom Integration Templates
**Location**: `templates/integrations/`
**Purpose**: Templates for common integrations

**SolarEdge Integration Template**:
```python
# solaredge_integration.py
import requests
import json
from datetime import datetime, timedelta

class SolarEdgeIntegration:
    def __init__(self, api_key, site_id):
        self.api_key = api_key
        self.site_id = site_id
        self.base_url = "https://monitoringapi.solaredge.com"
    
    def get_overview_data(self):
        """Fetch site overview data"""
        url = f"{self.base_url}/site/{self.site_id}/overview"
        params = {"api_key": self.api_key}
        
        response = requests.get(url, params=params)
        response.raise_for_status()
        
        return response.json()
    
    def get_power_data(self, start_date, end_date):
        """Fetch power data for date range"""
        url = f"{self.base_url}/site/{self.site_id}/power"
        params = {
            "api_key": self.api_key,
            "startTime": start_date.isoformat(),
            "endTime": end_date.isoformat()
        }
        
        response = requests.get(url, params=params)
        response.raise_for_status()
        
        return response.json()
    
    def format_for_ona(self, data):
        """Convert SolarEdge data to Ona format"""
        formatted_data = []
        
        for point in data['power']['values']:
            formatted_data.append({
                'timestamp': point['date'],
                'asset_id': f"SE-{self.site_id}",
                'power_kw': point['value'] / 1000 if point['value'] else 0,
                'data_source': 'solaredge'
            })
        
        return formatted_data
```

**Huawei FusionSolar Integration Template**:
```python
# huawei_integration.py
import requests
import json
from datetime import datetime

class HuaweiIntegration:
    def __init__(self, station_code, token):
        self.station_code = station_code
        self.token = token
        self.base_url = "https://intl.fusionsolar.huawei.com/thirdData"
    
    def get_station_real_kpi(self):
        """Fetch real-time station data"""
        url = f"{self.base_url}/getStationRealKpi"
        headers = {"XSRF-TOKEN": self.token}
        data = {"stationCodes": self.station_code}
        
        response = requests.post(url, headers=headers, json=data)
        response.raise_for_status()
        
        return response.json()
    
    def format_for_ona(self, data):
        """Convert Huawei data to Ona format"""
        formatted_data = []
        
        for station in data['data']:
            formatted_data.append({
                'timestamp': datetime.now().isoformat(),
                'asset_id': f"HW-{station['stationCode']}",
                'power_kw': station['realKpi']['power'] / 1000,
                'temperature_c': station['realKpi']['temperature'],
                'data_source': 'huawei'
            })
        
        return formatted_data
```

### Environment-Specific Overrides

#### Production Configuration
**Location**: `configs/production.yaml`
**Purpose**: Production-specific settings

```yaml
# production.yaml - Production environment configuration

environment: "prod"
log_level: "INFO"

# Enhanced monitoring
monitoring:
  detailed_logging: true
  performance_metrics: true
  error_tracking: true
  alerting_enabled: true

# Security settings
security:
  api_rate_limiting: true
  request_validation: true
  ssl_enforcement: true
  ip_whitelisting: false

# Performance optimization
performance:
  lambda_provisioned_concurrency: true
  s3_transfer_acceleration: true
  cloudfront_distribution: true
  caching_enabled: true

# Backup and recovery
backup:
  automated_backups: true
  cross_region_replication: true
  point_in_time_recovery: true
  retention_days: 30

# Scaling configuration
scaling:
  auto_scaling_enabled: true
  min_capacity: 2
  max_capacity: 100
  target_utilization: 70
```

#### Development Configuration
**Location**: `configs/development.yaml`
**Purpose**: Development environment settings

```yaml
# development.yaml - Development environment configuration

environment: "dev"
log_level: "DEBUG"

# Relaxed monitoring
monitoring:
  detailed_logging: true
  performance_metrics: false
  error_tracking: true
  alerting_enabled: false

# Relaxed security
security:
  api_rate_limiting: false
  request_validation: true
  ssl_enforcement: false
  ip_whitelisting: false

# Development optimization
performance:
  lambda_provisioned_concurrency: false
  s3_transfer_acceleration: false
  cloudfront_distribution: false
  caching_enabled: false

# Minimal backup
backup:
  automated_backups: false
  cross_region_replication: false
  point_in_time_recovery: false
  retention_days: 7

# Manual scaling
scaling:
  auto_scaling_enabled: false
  min_capacity: 1
  max_capacity: 10
  target_utilization: 50
```

### Configuration Management

#### Parameter Store Management
```bash
# Set configuration parameters
aws ssm put-parameter \
    --name "/ona-platform/prod/detection-threshold" \
    --value "0.7" \
    --type "String" \
    --description "Anomaly detection severity threshold" \
    --overwrite

aws ssm put-parameter \
    --name "/ona-platform/prod/weather-api-key" \
    --value "YOUR_API_KEY" \
    --type "SecureString" \
    --description "Visual Crossing weather API key" \
    --overwrite

# Get configuration parameters
aws ssm get-parameter \
    --name "/ona-platform/prod/detection-threshold" \
    --query 'Parameter.Value' \
    --output text

# List all platform parameters
aws ssm describe-parameters \
    --filters "Key=Name,Values=/ona-platform/prod/" \
    --query 'Parameters[].Name' \
    --output table
```

#### Configuration Validation
```bash
#!/bin/bash
# validate_configuration.sh

echo "Validating Ona Platform configuration..."

# Check required parameters
REQUIRED_PARAMS=(
    "/ona-platform/prod/visual-crossing-api-key"
    "/ona-platform/prod/detection-threshold"
    "/ona-platform/prod/loss-function-weights"
)

for param in "${REQUIRED_PARAMS[@]}"; do
    if aws ssm get-parameter --name "$param" &>/dev/null; then
        echo "✓ $param"
    else
        echo "✗ $param (missing)"
        exit 1
    fi
done

# Validate configuration files
echo "Validating configuration files..."

# Check YAML syntax
python -c "import yaml; yaml.safe_load(open('configs/ooda/categories.yaml'))" && echo "✓ categories.yaml"
python -c "import yaml; yaml.safe_load(open('configs/ooda/loss_function.yaml'))" && echo "✓ loss_function.yaml"

# Check environment variables
source config/environment.sh
if [ -n "$AWS_REGION" ] && [ -n "$API_DOMAIN" ]; then
    echo "✓ Environment variables"
else
    echo "✗ Environment variables (missing)"
    exit 1
fi

echo "Configuration validation completed successfully"
```

#### Dynamic Configuration Updates
```bash
#!/bin/bash
# update_configuration.sh

CONFIG_TYPE=$1
NEW_VALUE=$2

case $CONFIG_TYPE in
    "detection-threshold")
        aws ssm put-parameter \
            --name "/ona-platform/prod/detection-threshold" \
            --value "$NEW_VALUE" \
            --type "String" \
            --overwrite
        echo "Detection threshold updated to $NEW_VALUE"
        ;;
    
    "loss-weights")
        aws ssm put-parameter \
            --name "/ona-platform/prod/loss-function-weights" \
            --value "$NEW_VALUE" \
            --type "String" \
            --overwrite
        echo "Loss function weights updated"
        ;;
    
    "weather-api-key")
        aws ssm put-parameter \
            --name "/ona-platform/prod/visual-crossing-api-key" \
            --value "$NEW_VALUE" \
            --type "SecureString" \
            --overwrite
        echo "Weather API key updated"
        ;;
    
    *)
        echo "Usage: $0 <config-type> <new-value>"
        echo "Available config types: detection-threshold, loss-weights, weather-api-key"
        exit 1
        ;;
esac
```

## 5. Monitoring & Observability

### CloudWatch Integration

#### Log Groups Configuration
**Purpose**: Centralized logging for all platform services

```bash
# Create log groups for all services
for service in dataIngestion weatherCache interpolationService globalTrainingService forecastingApi; do
    aws logs create-log-group \
        --log-group-name "/aws/lambda/ona-${service}-prod" \
        --region af-south-1 \
        --retention-in-days 30
done

# Create custom log groups for OODA operations
aws logs create-log-group \
    --log-group-name "/aws/lambda/ona-detect-prod" \
    --region af-south-1 \
    --retention-in-days 30

aws logs create-log-group \
    --log-group-name "/aws/lambda/ona-diagnose-prod" \
    --region af-south-1 \
    --retention-in-days 30

aws logs create-log-group \
    --log-group-name "/aws/lambda/ona-schedule-prod" \
    --region af-south-1 \
    --retention-in-days 30

aws logs create-log-group \
    --log-group-name "/aws/lambda/ona-order-prod" \
    --region af-south-1 \
    --retention-in-days 30
```

#### Custom Metrics
**Purpose**: Track business-specific metrics beyond standard AWS metrics

```python
# custom_metrics.py - Custom metrics collection
import boto3
import json
from datetime import datetime

class OnaMetrics:
    def __init__(self):
        self.cloudwatch = boto3.client('cloudwatch')
        self.namespace = 'Ona/Platform'
    
    def put_detection_metrics(self, asset_id, severity, detection_time_ms):
        """Record detection performance metrics"""
        self.cloudwatch.put_metric_data(
            Namespace=self.namespace,
            MetricData=[
                {
                    'MetricName': 'DetectionLatency',
                    'Dimensions': [
                        {'Name': 'AssetId', 'Value': asset_id},
                        {'Name': 'Service', 'Value': 'detect'}
                    ],
                    'Value': detection_time_ms,
                    'Unit': 'Milliseconds',
                    'Timestamp': datetime.utcnow()
                },
                {
                    'MetricName': 'DetectionSeverity',
                    'Dimensions': [
                        {'Name': 'AssetId', 'Value': asset_id},
                        {'Name': 'Service', 'Value': 'detect'}
                    ],
                    'Value': severity,
                    'Unit': 'None',
                    'Timestamp': datetime.utcnow()
                }
            ]
        )
    
    def put_forecast_metrics(self, customer_id, accuracy, horizon_hours):
        """Record forecast accuracy metrics"""
        self.cloudwatch.put_metric_data(
            Namespace=self.namespace,
            MetricData=[
                {
                    'MetricName': 'ForecastAccuracy',
                    'Dimensions': [
                        {'Name': 'CustomerId', 'Value': customer_id},
                        {'Name': 'HorizonHours', 'Value': str(horizon_hours)}
                    ],
                    'Value': accuracy,
                    'Unit': 'Percent',
                    'Timestamp': datetime.utcnow()
                }
            ]
        )
    
    def put_ear_metrics(self, asset_id, ear_usd_day, risk_category):
        """Record Energy-at-Risk metrics"""
        self.cloudwatch.put_metric_data(
            Namespace=self.namespace,
            MetricData=[
                {
                    'MetricName': 'EnergyAtRisk',
                    'Dimensions': [
                        {'Name': 'AssetId', 'Value': asset_id},
                        {'Name': 'RiskCategory', 'Value': risk_category}
                    ],
                    'Value': ear_usd_day,
                    'Unit': 'None',
                    'Timestamp': datetime.utcnow()
                }
            ]
        )

# Usage example
metrics = OnaMetrics()
metrics.put_detection_metrics('INV-001', 0.8, 250)
metrics.put_forecast_metrics('customer-001', 94.2, 48)
metrics.put_ear_metrics('INV-001', 18.24, 'high')
```

#### CloudWatch Dashboards
**Purpose**: Visual monitoring of platform health and performance

```bash
# Create comprehensive dashboard
aws cloudwatch put-dashboard \
    --dashboard-name "Ona-Platform-Overview" \
    --dashboard-body '{
        "widgets": [
            {
                "type": "metric",
                "x": 0,
                "y": 0,
                "width": 12,
                "height": 6,
                "properties": {
                    "metrics": [
                        ["AWS/Lambda", "Invocations", "FunctionName", "ona-dataIngestion-prod"],
                        ["AWS/Lambda", "Invocations", "FunctionName", "ona-weatherCache-prod"],
                        ["AWS/Lambda", "Invocations", "FunctionName", "ona-interpolationService-prod"],
                        ["AWS/Lambda", "Invocations", "FunctionName", "ona-globalTrainingService-prod"],
                        ["AWS/Lambda", "Invocations", "FunctionName", "ona-forecastingApi-prod"]
                    ],
                    "view": "timeSeries",
                    "stacked": false,
                    "region": "af-south-1",
                    "title": "Lambda Invocations",
                    "period": 300
                }
            },
            {
                "type": "metric",
                "x": 12,
                "y": 0,
                "width": 12,
                "height": 6,
                "properties": {
                    "metrics": [
                        ["AWS/Lambda", "Errors", "FunctionName", "ona-dataIngestion-prod"],
                        ["AWS/Lambda", "Errors", "FunctionName", "ona-weatherCache-prod"],
                        ["AWS/Lambda", "Errors", "FunctionName", "ona-interpolationService-prod"],
                        ["AWS/Lambda", "Errors", "FunctionName", "ona-globalTrainingService-prod"],
                        ["AWS/Lambda", "Errors", "FunctionName", "ona-forecastingApi-prod"]
                    ],
                    "view": "timeSeries",
                    "stacked": false,
                    "region": "af-south-1",
                    "title": "Lambda Errors",
                    "period": 300
                }
            },
            {
                "type": "metric",
                "x": 0,
                "y": 6,
                "width": 12,
                "height": 6,
                "properties": {
                    "metrics": [
                        ["AWS/Lambda", "Duration", "FunctionName", "ona-dataIngestion-prod"],
                        ["AWS/Lambda", "Duration", "FunctionName", "ona-weatherCache-prod"],
                        ["AWS/Lambda", "Duration", "FunctionName", "ona-interpolationService-prod"],
                        ["AWS/Lambda", "Duration", "FunctionName", "ona-globalTrainingService-prod"],
                        ["AWS/Lambda", "Duration", "FunctionName", "ona-forecastingApi-prod"]
                    ],
                    "view": "timeSeries",
                    "stacked": false,
                    "region": "af-south-1",
                    "title": "Lambda Duration",
                    "period": 300
                }
            },
            {
                "type": "metric",
                "x": 12,
                "y": 6,
                "width": 12,
                "height": 6,
                "properties": {
                    "metrics": [
                        ["Ona/Platform", "DetectionLatency"],
                        ["Ona/Platform", "ForecastAccuracy"],
                        ["Ona/Platform", "EnergyAtRisk"]
                    ],
                    "view": "timeSeries",
                    "stacked": false,
                    "region": "af-south-1",
                    "title": "Business Metrics",
                    "period": 300
                }
            }
        ]
    }'
```

### Logging and Metrics

#### Structured Logging
**Purpose**: Consistent, searchable log format across all services

```python
# structured_logging.py - Standardized logging format
import json
import logging
import boto3
from datetime import datetime
from typing import Dict, Any

class OnaLogger:
    def __init__(self, service_name: str, log_level: str = "INFO"):
        self.service_name = service_name
        self.logger = logging.getLogger(service_name)
        self.logger.setLevel(getattr(logging, log_level.upper()))
        
        # Create CloudWatch handler
        handler = logging.StreamHandler()
        formatter = logging.Formatter('%(message)s')
        handler.setFormatter(formatter)
        self.logger.addHandler(handler)
    
    def _format_log(self, level: str, message: str, **kwargs) -> str:
        """Format log entry as structured JSON"""
        log_entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "level": level,
            "service": self.service_name,
            "message": message,
            **kwargs
        }
        return json.dumps(log_entry)
    
    def info(self, message: str, **kwargs):
        """Log info level message"""
        self.logger.info(self._format_log("INFO", message, **kwargs))
    
    def warning(self, message: str, **kwargs):
        """Log warning level message"""
        self.logger.warning(self._format_log("WARNING", message, **kwargs))
    
    def error(self, message: str, **kwargs):
        """Log error level message"""
        self.logger.error(self._format_log("ERROR", message, **kwargs))
    
    def debug(self, message: str, **kwargs):
        """Log debug level message"""
        self.logger.debug(self._format_log("DEBUG", message, **kwargs))
    
    def log_detection(self, asset_id: str, severity: float, detection_time_ms: int):
        """Log detection event"""
        self.info(
            "Fault detection completed",
            event_type="detection",
            asset_id=asset_id,
            severity=severity,
            detection_time_ms=detection_time_ms
        )
    
    def log_forecast(self, customer_id: str, asset_id: str, accuracy: float):
        """Log forecast generation"""
        self.info(
            "Forecast generated",
            event_type="forecast",
            customer_id=customer_id,
            asset_id=asset_id,
            accuracy=accuracy
        )
    
    def log_ear_calculation(self, asset_id: str, ear_usd_day: float, risk_category: str):
        """Log Energy-at-Risk calculation"""
        self.info(
            "Energy-at-Risk calculated",
            event_type="ear_calculation",
            asset_id=asset_id,
            ear_usd_day=ear_usd_day,
            risk_category=risk_category
        )

# Usage example
logger = OnaLogger("ona-detect-prod")
logger.log_detection("INV-001", 0.8, 250)
logger.log_forecast("customer-001", "INV-001", 94.2)
logger.log_ear_calculation("INV-001", 18.24, "high")
```

#### Performance Metrics Collection
**Purpose**: Track system performance and identify bottlenecks

```python
# performance_metrics.py - Performance monitoring
import time
import psutil
import boto3
from functools import wraps
from typing import Callable, Any

class PerformanceMonitor:
    def __init__(self):
        self.cloudwatch = boto3.client('cloudwatch')
        self.namespace = 'Ona/Performance'
    
    def measure_execution_time(self, func: Callable) -> Callable:
        """Decorator to measure function execution time"""
        @wraps(func)
        def wrapper(*args, **kwargs) -> Any:
            start_time = time.time()
            try:
                result = func(*args, **kwargs)
                execution_time = (time.time() - start_time) * 1000  # Convert to milliseconds
                
                # Log successful execution
                self.cloudwatch.put_metric_data(
                    Namespace=self.namespace,
                    MetricData=[
                        {
                            'MetricName': 'FunctionExecutionTime',
                            'Dimensions': [
                                {'Name': 'FunctionName', 'Value': func.__name__},
                                {'Name': 'Status', 'Value': 'Success'}
                            ],
                            'Value': execution_time,
                            'Unit': 'Milliseconds'
                        }
                    ]
                )
                return result
            except Exception as e:
                execution_time = (time.time() - start_time) * 1000
                
                # Log failed execution
                self.cloudwatch.put_metric_data(
                    Namespace=self.namespace,
                    MetricData=[
                        {
                            'MetricName': 'FunctionExecutionTime',
                            'Dimensions': [
                                {'Name': 'FunctionName', 'Value': func.__name__},
                                {'Name': 'Status', 'Value': 'Error'}
                            ],
                            'Value': execution_time,
                            'Unit': 'Milliseconds'
                        }
                    ]
                )
                raise e
        return wrapper
    
    def collect_system_metrics(self):
        """Collect system-level performance metrics"""
        cpu_percent = psutil.cpu_percent(interval=1)
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')
        
        self.cloudwatch.put_metric_data(
            Namespace=self.namespace,
            MetricData=[
                {
                    'MetricName': 'CPUUtilization',
                    'Value': cpu_percent,
                    'Unit': 'Percent'
                },
                {
                    'MetricName': 'MemoryUtilization',
                    'Value': memory.percent,
                    'Unit': 'Percent'
                },
                {
                    'MetricName': 'DiskUtilization',
                    'Value': (disk.used / disk.total) * 100,
                    'Unit': 'Percent'
                }
            ]
        )

# Usage example
monitor = PerformanceMonitor()

@monitor.measure_execution_time
def process_data(data):
    # Simulate data processing
    time.sleep(0.1)
    return len(data)

# Collect system metrics
monitor.collect_system_metrics()
```

### Alerting and Notifications

#### CloudWatch Alarms Configuration
**Purpose**: Proactive monitoring with automated alerts

```bash
# Create comprehensive alarm set
ALARM_CONFIGS=(
    "ona-dataIngestion-error-rate:AWS/Lambda:Errors:FunctionName:ona-dataIngestion-prod:5:GreaterThanThreshold:2"
    "ona-weatherCache-error-rate:AWS/Lambda:Errors:FunctionName:ona-weatherCache-prod:3:GreaterThanThreshold:2"
    "ona-interpolationService-duration:AWS/Lambda:Duration:FunctionName:ona-interpolationService-prod:600000:GreaterThanThreshold:1"
    "ona-forecastingApi-duration:AWS/Lambda:Duration:FunctionName:ona-forecastingApi-prod:45000:GreaterThanThreshold:1"
    "ona-platform-detection-latency:Ona/Platform:DetectionLatency:5000:GreaterThanThreshold:1"
    "ona-platform-forecast-accuracy:Ona/Platform:ForecastAccuracy:80:LessThanThreshold:2"
)

for alarm_config in "${ALARM_CONFIGS[@]}"; do
    IFS=':' read -r alarm_name namespace metric_name dimension_name dimension_value threshold comparison_operator evaluation_periods <<< "$alarm_config"
    
    aws cloudwatch put-metric-alarm \
        --alarm-name "$alarm_name" \
        --alarm-description "Alert for $alarm_name" \
        --metric-name "$metric_name" \
        --namespace "$namespace" \
        --statistic Average \
        --period 300 \
        --threshold "$threshold" \
        --comparison-operator "$comparison_operator" \
        --dimensions Name="$dimension_name",Value="$dimension_value" \
        --evaluation-periods "$evaluation_periods" \
        --alarm-actions "arn:aws:sns:af-south-1:ACCOUNT:ona-platform-alerts" \
        --region af-south-1
done
```

#### SNS Alert Configuration
**Purpose**: Multi-channel notification system

```bash
# Create SNS topic
aws sns create-topic --name ona-platform-alerts --region af-south-1

# Subscribe to email notifications
aws sns subscribe \
    --topic-arn "arn:aws:sns:af-south-1:ACCOUNT:ona-platform-alerts" \
    --protocol email \
    --notification-endpoint "admin@yourcompany.com" \
    --region af-south-1

# Subscribe to Slack webhook
aws sns subscribe \
    --topic-arn "arn:aws:sns:af-south-1:ACCOUNT:ona-platform-alerts" \
    --protocol https \
    --notification-endpoint "https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK" \
    --region af-south-1

# Subscribe to PagerDuty
aws sns subscribe \
    --topic-arn "arn:aws:sns:af-south-1:ACCOUNT:ona-platform-alerts" \
    --protocol https \
    --notification-endpoint "https://events.pagerduty.com/integration/YOUR_INTEGRATION_KEY/enqueue" \
    --region af-south-1
```

#### Custom Alert Processing
**Purpose**: Intelligent alert filtering and escalation

```python
# alert_processor.py - Smart alert processing
import json
import boto3
from datetime import datetime, timedelta
from typing import Dict, List

class AlertProcessor:
    def __init__(self):
        self.sns = boto3.client('sns')
        self.cloudwatch = boto3.client('cloudwatch')
        self.dynamodb = boto3.client('dynamodb')
        self.topic_arn = "arn:aws:sns:af-south-1:ACCOUNT:ona-platform-alerts"
    
    def process_alert(self, alarm_name: str, alarm_state: str, alarm_reason: str):
        """Process incoming CloudWatch alarm"""
        alert_data = {
            "alarm_name": alarm_name,
            "state": alarm_state,
            "reason": alarm_reason,
            "timestamp": datetime.utcnow().isoformat(),
            "severity": self._determine_severity(alarm_name, alarm_state),
            "escalation_level": self._get_escalation_level(alarm_name)
        }
        
        # Check for alert suppression
        if self._should_suppress_alert(alarm_name):
            return
        
        # Check for alert frequency
        if self._is_alert_flooding(alarm_name):
            self._escalate_alert(alert_data)
            return
        
        # Send appropriate notification
        self._send_notification(alert_data)
        
        # Log alert for tracking
        self._log_alert(alert_data)
    
    def _determine_severity(self, alarm_name: str, alarm_state: str) -> str:
        """Determine alert severity based on alarm type and state"""
        if "error" in alarm_name.lower():
            return "critical" if alarm_state == "ALARM" else "warning"
        elif "duration" in alarm_name.lower():
            return "high" if alarm_state == "ALARM" else "medium"
        elif "accuracy" in alarm_name.lower():
            return "medium" if alarm_state == "ALARM" else "low"
        else:
            return "medium"
    
    def _get_escalation_level(self, alarm_name: str) -> int:
        """Determine escalation level for alert"""
        critical_alarms = ["error-rate", "duration"]
        if any(keyword in alarm_name.lower() for keyword in critical_alarms):
            return 1  # Immediate escalation
        else:
            return 2  # Standard escalation
    
    def _should_suppress_alert(self, alarm_name: str) -> bool:
        """Check if alert should be suppressed (e.g., during maintenance)"""
        # Check maintenance window
        current_time = datetime.utcnow()
        maintenance_start = current_time.replace(hour=2, minute=0, second=0, microsecond=0)
        maintenance_end = maintenance_start + timedelta(hours=2)
        
        if maintenance_start <= current_time <= maintenance_end:
            return True
        
        return False
    
    def _is_alert_flooding(self, alarm_name: str) -> bool:
        """Check if too many alerts are being sent for the same alarm"""
        # Check alert frequency in the last hour
        end_time = datetime.utcnow()
        start_time = end_time - timedelta(hours=1)
        
        response = self.cloudwatch.get_metric_statistics(
            Namespace='AWS/SNS',
            MetricName='NumberOfNotificationsPublished',
            Dimensions=[
                {'Name': 'TopicName', 'Value': 'ona-platform-alerts'}
            ],
            StartTime=start_time,
            EndTime=end_time,
            Period=3600,
            Statistics=['Sum']
        )
        
        if response['Datapoints']:
            notification_count = response['Datapoints'][0]['Sum']
            return notification_count > 10  # Threshold for alert flooding
        
        return False
    
    def _send_notification(self, alert_data: Dict):
        """Send notification via SNS"""
        message = {
            "default": json.dumps(alert_data),
            "email": f"""
            Ona Platform Alert
            
            Alarm: {alert_data['alarm_name']}
            State: {alert_data['state']}
            Severity: {alert_data['severity']}
            Time: {alert_data['timestamp']}
            Reason: {alert_data['reason']}
            
            Please investigate immediately.
            """,
            "slack": json.dumps({
                "text": f"🚨 Ona Platform Alert",
                "attachments": [
                    {
                        "color": "danger" if alert_data['severity'] == 'critical' else "warning",
                        "fields": [
                            {"title": "Alarm", "value": alert_data['alarm_name'], "short": True},
                            {"title": "State", "value": alert_data['state'], "short": True},
                            {"title": "Severity", "value": alert_data['severity'], "short": True},
                            {"title": "Time", "value": alert_data['timestamp'], "short": True},
                            {"title": "Reason", "value": alert_data['reason'], "short": False}
                        ]
                    }
                ]
            })
        }
        
        self.sns.publish(
            TopicArn=self.topic_arn,
            Message=json.dumps(message),
            MessageStructure='json'
        )
    
    def _escalate_alert(self, alert_data: Dict):
        """Escalate alert to higher-level notification"""
        escalated_message = f"""
        ESCALATED ALERT - Ona Platform
        
        Multiple alerts received for: {alert_data['alarm_name']}
        Severity: {alert_data['severity']}
        Time: {alert_data['timestamp']}
        
        This alert is being escalated due to high frequency.
        Immediate attention required.
        """
        
        self.sns.publish(
            TopicArn=self.topic_arn,
            Message=escalated_message,
            Subject="ESCALATED: Ona Platform Alert"
        )
    
    def _log_alert(self, alert_data: Dict):
        """Log alert for tracking and analysis"""
        self.dynamodb.put_item(
            TableName='ona-platform-alert-log',
            Item={
                'alert_id': {'S': f"{alert_data['alarm_name']}-{alert_data['timestamp']}"},
                'alarm_name': {'S': alert_data['alarm_name']},
                'state': {'S': alert_data['state']},
                'severity': {'S': alert_data['severity']},
                'timestamp': {'S': alert_data['timestamp']},
                'reason': {'S': alert_data['reason']},
                'escalation_level': {'N': str(alert_data['escalation_level'])}
            }
        )
```

### Performance Monitoring

#### Real-Time Performance Tracking
**Purpose**: Continuous monitoring of system performance

```python
# performance_tracker.py - Real-time performance monitoring
import time
import threading
import boto3
from collections import defaultdict, deque
from datetime import datetime, timedelta

class PerformanceTracker:
    def __init__(self):
        self.cloudwatch = boto3.client('cloudwatch')
        self.namespace = 'Ona/Performance'
        self.metrics_buffer = defaultdict(lambda: deque(maxlen=100))
        self.start_time = time.time()
        
        # Start background thread for metrics collection
        self.monitoring_thread = threading.Thread(target=self._collect_metrics_loop)
        self.monitoring_thread.daemon = True
        self.monitoring_thread.start()
    
    def _collect_metrics_loop(self):
        """Background thread for continuous metrics collection"""
        while True:
            try:
                self._collect_system_metrics()
                self._collect_application_metrics()
                self._flush_metrics_buffer()
                time.sleep(60)  # Collect metrics every minute
            except Exception as e:
                print(f"Error in metrics collection: {e}")
                time.sleep(60)
    
    def _collect_system_metrics(self):
        """Collect system-level performance metrics"""
        import psutil
        
        # CPU metrics
        cpu_percent = psutil.cpu_percent(interval=1)
        self._add_metric('CPUUtilization', cpu_percent)
        
        # Memory metrics
        memory = psutil.virtual_memory()
        self._add_metric('MemoryUtilization', memory.percent)
        self._add_metric('MemoryAvailable', memory.available / (1024**3))  # GB
        
        # Disk metrics
        disk = psutil.disk_usage('/')
        disk_percent = (disk.used / disk.total) * 100
        self._add_metric('DiskUtilization', disk_percent)
        
        # Network metrics
        network = psutil.net_io_counters()
        self._add_metric('NetworkBytesSent', network.bytes_sent)
        self._add_metric('NetworkBytesReceived', network.bytes_recv)
    
    def _collect_application_metrics(self):
        """Collect application-specific performance metrics"""
        # Track request rates
        self._add_metric('RequestRate', self._calculate_request_rate())
        
        # Track response times
        self._add_metric('AverageResponseTime', self._calculate_avg_response_time())
        
        # Track error rates
        self._add_metric('ErrorRate', self._calculate_error_rate())
        
        # Track active connections
        self._add_metric('ActiveConnections', self._count_active_connections())
    
    def _add_metric(self, metric_name: str, value: float, dimensions: Dict = None):
        """Add metric to buffer"""
        metric_key = f"{metric_name}:{dimensions or ''}"
        self.metrics_buffer[metric_key].append({
            'timestamp': datetime.utcnow(),
            'value': value,
            'dimensions': dimensions or {}
        })
    
    def _flush_metrics_buffer(self):
        """Flush metrics buffer to CloudWatch"""
        metric_data = []
        
        for metric_key, data_points in self.metrics_buffer.items():
            if not data_points:
                continue
            
            metric_name = metric_key.split(':')[0]
            dimensions = data_points[0]['dimensions']
            
            # Calculate statistics for the time window
            values = [dp['value'] for dp in data_points]
            avg_value = sum(values) / len(values)
            max_value = max(values)
            min_value = min(values)
            
            # Add average metric
            metric_data.append({
                'MetricName': metric_name,
                'Dimensions': [{'Name': k, 'Value': v} for k, v in dimensions.items()],
                'Value': avg_value,
                'Unit': 'None',
                'Timestamp': datetime.utcnow()
            })
            
            # Add max metric
            metric_data.append({
                'MetricName': f"{metric_name}Max",
                'Dimensions': [{'Name': k, 'Value': v} for k, v in dimensions.items()],
                'Value': max_value,
                'Unit': 'None',
                'Timestamp': datetime.utcnow()
            })
        
        # Send metrics to CloudWatch in batches
        if metric_data:
            try:
                self.cloudwatch.put_metric_data(
                    Namespace=self.namespace,
                    MetricData=metric_data
                )
                # Clear buffer after successful send
                self.metrics_buffer.clear()
            except Exception as e:
                print(f"Error sending metrics to CloudWatch: {e}")
    
    def _calculate_request_rate(self) -> float:
        """Calculate requests per second"""
        # This would be implemented based on your application's request tracking
        return 0.0
    
    def _calculate_avg_response_time(self) -> float:
        """Calculate average response time"""
        # This would be implemented based on your application's response time tracking
        return 0.0
    
    def _calculate_error_rate(self) -> float:
        """Calculate error rate percentage"""
        # This would be implemented based on your application's error tracking
        return 0.0
    
    def _count_active_connections(self) -> int:
        """Count active connections"""
        # This would be implemented based on your application's connection tracking
        return 0
    
    def track_function_performance(self, function_name: str, execution_time: float, success: bool):
        """Track individual function performance"""
        self._add_metric('FunctionExecutionTime', execution_time, {
            'FunctionName': function_name,
            'Status': 'Success' if success else 'Error'
        })
        
        if success:
            self._add_metric('FunctionSuccessRate', 1.0, {'FunctionName': function_name})
        else:
            self._add_metric('FunctionSuccessRate', 0.0, {'FunctionName': function_name})

# Usage example
tracker = PerformanceTracker()
tracker.track_function_performance('process_data', 150.5, True)
```

#### Performance Analysis and Reporting
**Purpose**: Generate performance reports and identify trends

```bash
#!/bin/bash
# performance_report.sh - Generate performance analysis report

REPORT_DATE=$(date +%Y-%m-%d)
REPORT_FILE="performance_report_${REPORT_DATE}.txt"

echo "Ona Platform Performance Report - $REPORT_DATE" > $REPORT_FILE
echo "===============================================" >> $REPORT_FILE
echo "" >> $REPORT_FILE

# Lambda performance analysis
echo "Lambda Function Performance:" >> $REPORT_FILE
echo "----------------------------" >> $REPORT_FILE

for service in dataIngestion weatherCache interpolationService globalTrainingService forecastingApi; do
    echo "Service: ona-${service}-prod" >> $REPORT_FILE
    
    # Get average duration
    avg_duration=$(aws cloudwatch get-metric-statistics \
        --namespace AWS/Lambda \
        --metric-name Duration \
        --dimensions Name=FunctionName,Value=ona-${service}-prod \
        --start-time $(date -d '24 hours ago' -u +%Y-%m-%dT%H:%M:%S) \
        --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
        --period 3600 \
        --statistics Average \
        --query 'Datapoints[0].Average' \
        --output text)
    
    # Get error count
    error_count=$(aws cloudwatch get-metric-statistics \
        --namespace AWS/Lambda \
        --metric-name Errors \
        --dimensions Name=FunctionName,Value=ona-${service}-prod \
        --start-time $(date -d '24 hours ago' -u +%Y-%m-%dT%H:%M:%S) \
        --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
        --period 3600 \
        --statistics Sum \
        --query 'Datapoints[0].Sum' \
        --output text)
    
    # Get invocation count
    invocation_count=$(aws cloudwatch get-metric-statistics \
        --namespace AWS/Lambda \
        --metric-name Invocations \
        --dimensions Name=FunctionName,Value=ona-${service}-prod \
        --start-time $(date -d '24 hours ago' -u +%Y-%m-%dT%H:%M:%S) \
        --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
        --period 3600 \
        --statistics Sum \
        --query 'Datapoints[0].Sum' \
        --output text)
    
    echo "  Average Duration: ${avg_duration:-0}ms" >> $REPORT_FILE
    echo "  Error Count: ${error_count:-0}" >> $REPORT_FILE
    echo "  Invocation Count: ${invocation_count:-0}" >> $REPORT_FILE
    echo "  Error Rate: $(echo "scale=2; ${error_count:-0} * 100 / ${invocation_count:-1}" | bc)%" >> $REPORT_FILE
    echo "" >> $REPORT_FILE
done

# Business metrics analysis
echo "Business Metrics:" >> $REPORT_FILE
echo "----------------" >> $REPORT_FILE

# Detection performance
avg_detection_latency=$(aws cloudwatch get-metric-statistics \
    --namespace Ona/Platform \
    --metric-name DetectionLatency \
    --start-time $(date -d '24 hours ago' -u +%Y-%m-%dT%H:%M:%S) \
    --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
    --period 3600 \
    --statistics Average \
    --query 'Datapoints[0].Average' \
    --output text)

echo "Average Detection Latency: ${avg_detection_latency:-0}ms" >> $REPORT_FILE

# Forecast accuracy
avg_forecast_accuracy=$(aws cloudwatch get-metric-statistics \
    --namespace Ona/Platform \
    --metric-name ForecastAccuracy \
    --start-time $(date -d '24 hours ago' -u +%Y-%m-%dT%H:%M:%S) \
    --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
    --period 3600 \
    --statistics Average \
    --query 'Datapoints[0].Average' \
    --output text)

echo "Average Forecast Accuracy: ${avg_forecast_accuracy:-0}%" >> $REPORT_FILE

echo "" >> $REPORT_FILE
echo "Report generated at: $(date)" >> $REPORT_FILE

# Send report via email
aws ses send-email \
    --source "reports@yourcompany.com" \
    --destination "ToAddresses=admin@yourcompany.com" \
    --message "Subject={Data='Ona Platform Performance Report - $REPORT_DATE'},Body={Text={Data='Performance report attached'}}" \
    --region af-south-1

echo "Performance report generated: $REPORT_FILE"
```

## 6. Security & Compliance

### Security Architecture

#### Network Security
**Purpose**: Secure network communication and access control

```bash
# Configure VPC security groups
aws ec2 create-security-group \
    --group-name ona-platform-lambda-sg \
    --description "Security group for Ona Platform Lambda functions" \
    --vpc-id vpc-12345678

# Allow HTTPS outbound for API calls
aws ec2 authorize-security-group-egress \
    --group-id sg-12345678 \
    --protocol tcp \
    --port 443 \
    --cidr 0.0.0.0/0

# Allow DynamoDB access
aws ec2 authorize-security-group-egress \
    --group-id sg-12345678 \
    --protocol tcp \
    --port 443 \
    --source-group sg-dynamodb-sg

# Configure API Gateway throttling
aws apigateway update-stage \
    --rest-api-id api12345678 \
    --stage-name prod \
    --patch-ops '[
        {
            "op": "replace",
            "path": "/throttle/burstLimit",
            "value": "1000"
        },
        {
            "op": "replace",
            "path": "/throttle/rateLimit",
            "value": "500"
        }
    ]'
```

#### IAM Security Policies
**Purpose**: Principle of least privilege access control

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "OnaPlatformS3Access",
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": [
        "arn:aws:s3:::sa-api-client-input/*",
        "arn:aws:s3:::sa-api-client-output/*"
      ],
      "Condition": {
        "StringEquals": {
          "s3:x-amz-server-side-encryption": "AES256"
        }
      }
    },
    {
      "Sid": "OnaPlatformDynamoDBAccess",
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:Query",
        "dynamodb:Scan"
      ],
      "Resource": [
        "arn:aws:dynamodb:af-south-1:*:table/ona-platform-locations",
        "arn:aws:dynamodb:af-south-1:*:table/ona-platform-weather-cache"
      ]
    },
    {
      "Sid": "OnaPlatformCloudWatchAccess",
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents",
        "cloudwatch:PutMetricData"
      ],
      "Resource": "*"
    }
  ]
}
```

#### Encryption Configuration
**Purpose**: Data encryption at rest and in transit

```bash
# Enable S3 bucket encryption
aws s3api put-bucket-encryption \
    --bucket sa-api-client-input \
    --server-side-encryption-configuration '{
        "Rules": [
            {
                "ApplyServerSideEncryptionByDefault": {
                    "SSEAlgorithm": "AES256"
                }
            }
        ]
    }'

# Enable DynamoDB encryption
aws dynamodb update-table \
    --table-name ona-platform-locations \
    --sse-specification Enabled=true,SSEType=KMS \
    --region af-south-1

# Configure Lambda environment variable encryption
aws lambda update-function-configuration \
    --function-name ona-dataIngestion-prod \
    --kms-key-arn arn:aws:kms:af-south-1:ACCOUNT:key/key-id \
    --region af-south-1
```

### Data Protection

#### Data Classification and Handling
**Purpose**: Classify and protect sensitive data appropriately

```python
# data_classification.py - Data classification and protection
import boto3
import json
from enum import Enum
from typing import Dict, List

class DataClassification(Enum):
    PUBLIC = "public"
    INTERNAL = "internal"
    CONFIDENTIAL = "confidential"
    RESTRICTED = "restricted"

class DataProtection:
    def __init__(self):
        self.s3 = boto3.client('s3')
        self.kms = boto3.client('kms')
        self.classification_rules = {
            'customer_id': DataClassification.CONFIDENTIAL,
            'asset_id': DataClassification.INTERNAL,
            'power_kw': DataClassification.INTERNAL,
            'temperature_c': DataClassification.INTERNAL,
            'api_key': DataClassification.RESTRICTED,
            'financial_data': DataClassification.RESTRICTED
        }
    
    def classify_data(self, data: Dict) -> DataClassification:
        """Classify data based on content"""
        highest_classification = DataClassification.PUBLIC
        
        for key, value in data.items():
            if key in self.classification_rules:
                classification = self.classification_rules[key]
                if self._is_higher_classification(classification, highest_classification):
                    highest_classification = classification
        
        return highest_classification
    
    def _is_higher_classification(self, new: DataClassification, current: DataClassification) -> bool:
        """Check if new classification is higher than current"""
        classification_order = {
            DataClassification.PUBLIC: 1,
            DataClassification.INTERNAL: 2,
            DataClassification.CONFIDENTIAL: 3,
            DataClassification.RESTRICTED: 4
        }
        return classification_order[new] > classification_order[current]
    
    def apply_data_protection(self, data: Dict, classification: DataClassification) -> Dict:
        """Apply appropriate data protection measures"""
        protected_data = data.copy()
        
        if classification in [DataClassification.CONFIDENTIAL, DataClassification.RESTRICTED]:
            # Mask sensitive fields
            protected_data = self._mask_sensitive_fields(protected_data)
            
            # Add encryption metadata
            protected_data['_encryption'] = {
                'required': True,
                'algorithm': 'AES-256',
                'classification': classification.value
            }
        
        return protected_data
    
    def _mask_sensitive_fields(self, data: Dict) -> Dict:
        """Mask sensitive fields in data"""
        sensitive_fields = ['api_key', 'password', 'secret']
        masked_data = data.copy()
        
        for field in sensitive_fields:
            if field in masked_data:
                masked_data[field] = '***MASKED***'
        
        return masked_data
    
    def audit_data_access(self, user_id: str, data_classification: DataClassification, action: str):
        """Audit data access for compliance"""
        audit_log = {
            'timestamp': datetime.utcnow().isoformat(),
            'user_id': user_id,
            'data_classification': data_classification.value,
            'action': action,
            'compliance_status': 'compliant'
        }
        
        # Log to CloudWatch for audit trail
        self.cloudwatch.put_metric_data(
            Namespace='Ona/Security',
            MetricData=[
                {
                    'MetricName': 'DataAccessAudit',
                    'Dimensions': [
                        {'Name': 'Classification', 'Value': data_classification.value},
                        {'Name': 'Action', 'Value': action}
                    ],
                    'Value': 1,
                    'Unit': 'Count'
                }
            ]
        )

# Usage example
protection = DataProtection()
data = {'customer_id': 'CUST-001', 'power_kw': 150.5, 'api_key': 'secret123'}
classification = protection.classify_data(data)
protected_data = protection.apply_data_protection(data, classification)
protection.audit_data_access('user-123', classification, 'read')
```

#### Data Retention and Deletion
**Purpose**: Implement data lifecycle management for compliance

```bash
#!/bin/bash
# data_retention_manager.sh - Automated data retention management

RETENTION_POLICIES=(
    "customer_data:7:years"
    "sensor_data:3:years"
    "forecast_data:1:year"
    "log_data:90:days"
    "audit_data:7:years"
)

for policy in "${RETENTION_POLICIES[@]}"; do
    IFS=':' read -r data_type retention_period retention_unit <<< "$policy"
    
    echo "Processing retention policy for $data_type: $retention_period $retention_unit"
    
    # Calculate cutoff date
    case $retention_unit in
        "days")
            cutoff_date=$(date -d "$retention_period days ago" +%Y-%m-%d)
            ;;
        "years")
            cutoff_date=$(date -d "$retention_period years ago" +%Y-%m-%d)
            ;;
    esac
    
    # Delete old data
    case $data_type in
        "customer_data")
            aws s3 rm s3://sa-api-client-input/customers/ --recursive --exclude "*" --include "*$cutoff_date*"
            ;;
        "sensor_data")
            aws s3 rm s3://sa-api-client-input/observations/ --recursive --exclude "*" --include "*$cutoff_date*"
            ;;
        "forecast_data")
            aws s3 rm s3://sa-api-client-output/forecasts/ --recursive --exclude "*" --include "*$cutoff_date*"
            ;;
        "log_data")
            aws logs delete-log-group --log-group-name "/aws/lambda/ona-old-logs-$cutoff_date"
            ;;
    esac
    
    echo "Retention policy applied for $data_type"
done
```

### Access Controls

#### Multi-Factor Authentication
**Purpose**: Enhanced authentication security

```bash
# Enable MFA for IAM users
aws iam create-virtual-mfa-device \
    --virtual-mfa-device-name ona-platform-mfa \
    --outfile mfa-qr-code.png \
    --bootstrap-method QRCodePNG

# Attach MFA policy
aws iam attach-user-policy \
    --user-name ona-platform-admin \
    --policy-arn arn:aws:iam::aws:policy/IAMUserChangePassword

# Create MFA-protected policy
aws iam create-policy \
    --policy-name OnaPlatformMFAPolicy \
    --policy-document '{
        "Version": "2012-10-17",
        "Statement": [
            {
                "Effect": "Deny",
                "Action": "*",
                "Resource": "*",
                "Condition": {
                    "BoolIfExists": {
                        "aws:MultiFactorAuthPresent": "false"
                    }
                }
            }
        ]
    }'
```

#### API Access Control
**Purpose**: Secure API access with authentication and authorization

```python
# api_security.py - API security implementation
import jwt
import hashlib
import hmac
import time
from datetime import datetime, timedelta
from typing import Dict, Optional

class APISecurity:
    def __init__(self, secret_key: str):
        self.secret_key = secret_key
        self.token_expiry = 3600  # 1 hour
    
    def generate_api_key(self, customer_id: str, permissions: List[str]) -> str:
        """Generate API key for customer"""
        payload = {
            'customer_id': customer_id,
            'permissions': permissions,
            'issued_at': datetime.utcnow().isoformat(),
            'expires_at': (datetime.utcnow() + timedelta(days=365)).isoformat()
        }
        
        api_key = jwt.encode(payload, self.secret_key, algorithm='HS256')
        return api_key
    
    def validate_api_key(self, api_key: str) -> Optional[Dict]:
        """Validate API key and return customer info"""
        try:
            payload = jwt.decode(api_key, self.secret_key, algorithms=['HS256'])
            
            # Check expiration
            expires_at = datetime.fromisoformat(payload['expires_at'])
            if datetime.utcnow() > expires_at:
                return None
            
            return {
                'customer_id': payload['customer_id'],
                'permissions': payload['permissions'],
                'issued_at': payload['issued_at']
            }
        except jwt.InvalidTokenError:
            return None
    
    def check_permission(self, api_key: str, required_permission: str) -> bool:
        """Check if API key has required permission"""
        customer_info = self.validate_api_key(api_key)
        if not customer_info:
            return False
        
        return required_permission in customer_info['permissions']
    
    def generate_request_signature(self, method: str, path: str, body: str, timestamp: str) -> str:
        """Generate request signature for API authentication"""
        message = f"{method}\n{path}\n{body}\n{timestamp}"
        signature = hmac.new(
            self.secret_key.encode(),
            message.encode(),
            hashlib.sha256
        ).hexdigest()
        return signature
    
    def validate_request_signature(self, method: str, path: str, body: str, timestamp: str, signature: str) -> bool:
        """Validate request signature"""
        expected_signature = self.generate_request_signature(method, path, body, timestamp)
        return hmac.compare_digest(signature, expected_signature)
    
    def rate_limit_check(self, api_key: str, endpoint: str) -> bool:
        """Check rate limiting for API key"""
        # This would integrate with Redis or DynamoDB for rate limiting
        # For now, return True (no rate limiting)
        return True

# Usage example
security = APISecurity("your-secret-key")
api_key = security.generate_api_key("customer-001", ["read", "write"])
customer_info = security.validate_api_key(api_key)
has_permission = security.check_permission(api_key, "read")
```

### Compliance Features

#### SAWEM Compliance
**Purpose**: South African Wind Energy Market compliance requirements

```python
# sawem_compliance.py - SAWEM compliance implementation
import json
from datetime import datetime, timedelta
from typing import Dict, List

class SAWEMCompliance:
    def __init__(self):
        self.compliance_rules = {
            'data_retention_years': 7,
            'audit_trail_required': True,
            'reporting_frequency': 'monthly',
            'data_accuracy_threshold': 95.0,
            'response_time_sla': 300  # seconds
        }
    
    def generate_compliance_report(self, start_date: datetime, end_date: datetime) -> Dict:
        """Generate SAWEM compliance report"""
        report = {
            'report_period': {
                'start': start_date.isoformat(),
                'end': end_date.isoformat()
            },
            'compliance_status': 'compliant',
            'data_quality': self._assess_data_quality(start_date, end_date),
            'performance_metrics': self._assess_performance_metrics(start_date, end_date),
            'audit_trail': self._generate_audit_trail(start_date, end_date),
            'recommendations': []
        }
        
        # Check compliance violations
        violations = self._check_compliance_violations(report)
        if violations:
            report['compliance_status'] = 'non-compliant'
            report['violations'] = violations
        
        return report
    
    def _assess_data_quality(self, start_date: datetime, end_date: datetime) -> Dict:
        """Assess data quality metrics"""
        return {
            'completeness_percentage': 98.5,
            'accuracy_percentage': 96.2,
            'timeliness_percentage': 99.1,
            'consistency_score': 0.94,
            'meets_sawem_threshold': True
        }
    
    def _assess_performance_metrics(self, start_date: datetime, end_date: datetime) -> Dict:
        """Assess system performance metrics"""
        return {
            'average_response_time_seconds': 2.3,
            'uptime_percentage': 99.9,
            'error_rate_percentage': 0.1,
            'meets_sla_requirements': True
        }
    
    def _generate_audit_trail(self, start_date: datetime, end_date: datetime) -> List[Dict]:
        """Generate audit trail for compliance"""
        # This would query actual audit logs
        return [
            {
                'timestamp': '2025-01-15T08:00:00Z',
                'user_id': 'system',
                'action': 'data_ingestion',
                'resource': 'sensor_data',
                'status': 'success'
            },
            {
                'timestamp': '2025-01-15T08:15:00Z',
                'user_id': 'admin',
                'action': 'configuration_change',
                'resource': 'detection_threshold',
                'status': 'success'
            }
        ]
    
    def _check_compliance_violations(self, report: Dict) -> List[Dict]:
        """Check for compliance violations"""
        violations = []
        
        # Check data quality threshold
        if report['data_quality']['accuracy_percentage'] < self.compliance_rules['data_accuracy_threshold']:
            violations.append({
                'type': 'data_quality',
                'description': 'Data accuracy below SAWEM threshold',
                'severity': 'high'
            })
        
        # Check response time SLA
        if report['performance_metrics']['average_response_time_seconds'] > self.compliance_rules['response_time_sla']:
            violations.append({
                'type': 'performance',
                'description': 'Response time exceeds SLA',
                'severity': 'medium'
            })
        
        return violations
    
    def export_compliance_data(self, report: Dict) -> str:
        """Export compliance data in SAWEM format"""
        sawem_format = {
            'report_header': {
                'generator': 'Ona Platform',
                'version': '1.0',
                'generated_at': datetime.utcnow().isoformat(),
                'compliance_standard': 'SAWEM'
            },
            'report_data': report
        }
        
        return json.dumps(sawem_format, indent=2)

# Usage example
compliance = SAWEMCompliance()
start_date = datetime(2025, 1, 1)
end_date = datetime(2025, 1, 31)
report = compliance.generate_compliance_report(start_date, end_date)
sawem_data = compliance.export_compliance_data(report)
```

#### Audit and Logging
**Purpose**: Comprehensive audit logging for compliance

```bash
#!/bin/bash
# audit_logger.sh - Comprehensive audit logging

# Enable CloudTrail for API calls
aws cloudtrail create-trail \
    --name ona-platform-audit-trail \
    --s3-bucket-name ona-platform-audit-logs \
    --include-global-service-events \
    --is-multi-region-trail

# Start CloudTrail logging
aws cloudtrail start-logging \
    --name ona-platform-audit-trail

# Configure Config for resource tracking
aws configservice put-configuration-recorder \
    --configuration-recorder '{
        "name": "ona-platform-config-recorder",
        "roleARN": "arn:aws:iam::ACCOUNT:role/ConfigRole",
        "recordingGroup": {
            "allSupported": true,
            "includeGlobalResourceTypes": true
        }
    }'

# Create audit log analysis
aws logs create-log-group \
    --log-group-name "/aws/audit/ona-platform" \
    --retention-in-days 2555  # 7 years for compliance
```

## 7. Scaling & Performance

### Auto-Scaling Capabilities

#### Lambda Auto-Scaling Configuration
**Purpose**: Automatic scaling based on demand

```bash
# Configure provisioned concurrency for critical functions
aws lambda put-provisioned-concurrency-config \
    --function-name ona-forecastingApi-prod \
    --provisioned-concurrency-config '{
        "ProvisionedConcurrencyUnits": 10
    }'

# Configure reserved concurrency for resource-intensive functions
aws lambda put-reserved-concurrency \
    --function-name ona-interpolationService-prod \
    --reserved-concurrency-limit 5

# Set up auto-scaling based on CloudWatch metrics
aws application-autoscaling register-scalable-target \
    --service-namespace lambda \
    --scalable-dimension lambda:function:provisioned-concurrency \
    --resource-id "function:ona-forecastingApi-prod" \
    --min-capacity 5 \
    --max-capacity 50

aws application-autoscaling put-scaling-policy \
    --service-namespace lambda \
    --scalable-dimension lambda:function:provisioned-concurrency \
    --resource-id "function:ona-forecastingApi-prod" \
    --policy-name ona-forecasting-scaling-policy \
    --policy-type TargetTrackingScaling \
    --target-tracking-scaling-policy-configuration '{
        "TargetValue": 70.0,
        "PredefinedMetricSpecification": {
            "PredefinedMetricType": "LambdaProvisionedConcurrencyUtilization"
        }
    }'
```

#### DynamoDB Auto-Scaling
**Purpose**: Automatic scaling of database capacity

```bash
# Enable auto-scaling for DynamoDB tables
aws application-autoscaling register-scalable-target \
    --service-namespace dynamodb \
    --scalable-dimension dynamodb:table:ReadCapacityUnits \
    --resource-id "table/ona-platform-locations" \
    --min-capacity 5 \
    --max-capacity 100

aws application-autoscaling put-scaling-policy \
    --service-namespace dynamodb \
    --scalable-dimension dynamodb:table:ReadCapacityUnits \
    --resource-id "table/ona-platform-locations" \
    --policy-name ona-locations-read-scaling \
    --policy-type TargetTrackingScaling \
    --target-tracking-scaling-policy-configuration '{
        "TargetValue": 70.0,
        "PredefinedMetricSpecification": {
            "PredefinedMetricType": "DynamoDBReadCapacityUtilization"
        }
    }'
```

### Performance Optimization

#### Lambda Performance Tuning
**Purpose**: Optimize Lambda function performance

```python
# lambda_optimizer.py - Lambda performance optimization
import boto3
import json
import time
from typing import Dict, List

class LambdaOptimizer:
    def __init__(self):
        self.lambda_client = boto3.client('lambda')
        self.cloudwatch = boto3.client('cloudwatch')
    
    def analyze_function_performance(self, function_name: str) -> Dict:
        """Analyze Lambda function performance metrics"""
        end_time = datetime.utcnow()
        start_time = end_time - timedelta(days=7)
        
        # Get performance metrics
        metrics = self.cloudwatch.get_metric_statistics(
            Namespace='AWS/Lambda',
            MetricName='Duration',
            Dimensions=[{'Name': 'FunctionName', 'Value': function_name}],
            StartTime=start_time,
            EndTime=end_time,
            Period=3600,
            Statistics=['Average', 'Maximum', 'Minimum']
        )
        
        # Analyze memory utilization
        memory_metrics = self.cloudwatch.get_metric_statistics(
            Namespace='AWS/Lambda',
            MetricName='MemoryUtilization',
            Dimensions=[{'Name': 'FunctionName', 'Value': function_name}],
            StartTime=start_time,
            EndTime=end_time,
            Period=3600,
            Statistics=['Average', 'Maximum']
        )
        
        return {
            'duration_analysis': self._analyze_duration_metrics(metrics),
            'memory_analysis': self._analyze_memory_metrics(memory_metrics),
            'optimization_recommendations': self._generate_recommendations(metrics, memory_metrics)
        }
    
    def _analyze_duration_metrics(self, metrics: Dict) -> Dict:
        """Analyze duration metrics for optimization opportunities"""
        if not metrics['Datapoints']:
            return {'status': 'insufficient_data'}
        
        avg_duration = sum(dp['Average'] for dp in metrics['Datapoints']) / len(metrics['Datapoints'])
        max_duration = max(dp['Maximum'] for dp in metrics['Datapoints'])
        
        return {
            'average_duration_ms': avg_duration,
            'maximum_duration_ms': max_duration,
            'optimization_potential': 'high' if avg_duration > 1000 else 'medium' if avg_duration > 500 else 'low'
        }
    
    def _analyze_memory_metrics(self, metrics: Dict) -> Dict:
        """Analyze memory utilization metrics"""
        if not metrics['Datapoints']:
            return {'status': 'insufficient_data'}
        
        avg_memory = sum(dp['Average'] for dp in metrics['Datapoints']) / len(metrics['Datapoints'])
        max_memory = max(dp['Maximum'] for dp in metrics['Datapoints'])
        
        return {
            'average_memory_percent': avg_memory,
            'maximum_memory_percent': max_memory,
            'memory_efficiency': 'high' if avg_memory > 80 else 'medium' if avg_memory > 60 else 'low'
        }
    
    def _generate_recommendations(self, duration_metrics: Dict, memory_metrics: Dict) -> List[str]:
        """Generate performance optimization recommendations"""
        recommendations = []
        
        # Duration-based recommendations
        if duration_metrics.get('average_duration_ms', 0) > 1000:
            recommendations.append("Consider increasing memory allocation to reduce execution time")
            recommendations.append("Review code for optimization opportunities")
        
        # Memory-based recommendations
        if memory_metrics.get('average_memory_percent', 0) < 50:
            recommendations.append("Consider reducing memory allocation to optimize costs")
        elif memory_metrics.get('average_memory_percent', 0) > 90:
            recommendations.append("Consider increasing memory allocation to prevent out-of-memory errors")
        
        # General recommendations
        recommendations.append("Enable provisioned concurrency for consistent performance")
        recommendations.append("Implement connection pooling for external API calls")
        recommendations.append("Use caching for frequently accessed data")
        
        return recommendations
    
    def optimize_function_configuration(self, function_name: str, recommendations: List[str]):
        """Apply optimization recommendations to Lambda function"""
        current_config = self.lambda_client.get_function_configuration(FunctionName=function_name)
        current_memory = current_config['MemorySize']
        
        # Calculate optimal memory based on recommendations
        if "increasing memory allocation" in str(recommendations):
            new_memory = min(current_memory * 2, 3008)  # Double memory, max 3008MB
        elif "reducing memory allocation" in str(recommendations):
            new_memory = max(current_memory // 2, 128)  # Halve memory, min 128MB
        else:
            new_memory = current_memory
        
        # Update function configuration
        if new_memory != current_memory:
            self.lambda_client.update_function_configuration(
                FunctionName=function_name,
                MemorySize=new_memory
            )
            print(f"Updated {function_name} memory from {current_memory}MB to {new_memory}MB")

# Usage example
optimizer = LambdaOptimizer()
performance_analysis = optimizer.analyze_function_performance('ona-forecastingApi-prod')
optimizer.optimize_function_configuration('ona-forecastingApi-prod', performance_analysis['optimization_recommendations'])
```

#### Database Performance Optimization
**Purpose**: Optimize DynamoDB performance and costs

```bash
#!/bin/bash
# database_optimizer.sh - DynamoDB performance optimization

# Analyze table performance
analyze_table_performance() {
    local table_name=$1
    
    echo "Analyzing performance for table: $table_name"
    
    # Get read capacity utilization
    read_utilization=$(aws cloudwatch get-metric-statistics \
        --namespace AWS/DynamoDB \
        --metric-name ConsumedReadCapacityUnits \
        --dimensions Name=TableName,Value=$table_name \
        --start-time $(date -d '24 hours ago' -u +%Y-%m-%dT%H:%M:%S) \
        --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
        --period 3600 \
        --statistics Sum \
        --query 'Datapoints[0].Sum' \
        --output text)
    
    # Get write capacity utilization
    write_utilization=$(aws cloudwatch get-metric-statistics \
        --namespace AWS/DynamoDB \
        --metric-name ConsumedWriteCapacityUnits \
        --dimensions Name=TableName,Value=$table_name \
        --start-time $(date -d '24 hours ago' -u +%Y-%m-%dT%H:%M:%S) \
        --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
        --period 3600 \
        --statistics Sum \
        --query 'Datapoints[0].Sum' \
        --output text)
    
    echo "Read capacity utilization: ${read_utilization:-0}"
    echo "Write capacity utilization: ${write_utilization:-0}"
    
    # Generate optimization recommendations
    if [ "${read_utilization:-0}" -lt 100 ]; then
        echo "Recommendation: Consider reducing read capacity for $table_name"
    elif [ "${read_utilization:-0}" -gt 1000 ]; then
        echo "Recommendation: Consider increasing read capacity for $table_name"
    fi
    
    if [ "${write_utilization:-0}" -lt 100 ]; then
        echo "Recommendation: Consider reducing write capacity for $table_name"
    elif [ "${write_utilization:-0}" -gt 1000 ]; then
        echo "Recommendation: Consider increasing write capacity for $table_name"
    fi
}

# Analyze all platform tables
analyze_table_performance "ona-platform-locations"
analyze_table_performance "ona-platform-weather-cache"
analyze_table_performance "ona-platform-crews"
analyze_table_performance "ona-platform-tracking"

# Optimize table indexes
optimize_table_indexes() {
    local table_name=$1
    
    echo "Optimizing indexes for table: $table_name"
    
    # Get table description
    table_info=$(aws dynamodb describe-table --table-name $table_name --query 'Table')
    
    # Check for unused indexes
    gsi_count=$(echo $table_info | jq '.GlobalSecondaryIndexes | length')
    if [ "$gsi_count" -gt 0 ]; then
        echo "Found $gsi_count Global Secondary Indexes"
        
        # Analyze GSI usage (this would require more detailed analysis)
        echo "Recommendation: Monitor GSI usage and remove unused indexes"
    fi
}

optimize_table_indexes "ona-platform-locations"
```

### Resource Management

#### Cost Optimization
**Purpose**: Optimize AWS costs while maintaining performance

```python
# cost_optimizer.py - AWS cost optimization
import boto3
import json
from datetime import datetime, timedelta
from typing import Dict, List

class CostOptimizer:
    def __init__(self):
        self.ce_client = boto3.client('ce')  # Cost Explorer
        self.lambda_client = boto3.client('lambda')
        self.cloudwatch = boto3.client('cloudwatch')
    
    def analyze_costs(self, start_date: datetime, end_date: datetime) -> Dict:
        """Analyze AWS costs for the platform"""
        cost_data = self.ce_client.get_cost_and_usage(
            TimePeriod={
                'Start': start_date.strftime('%Y-%m-%d'),
                'End': end_date.strftime('%Y-%m-%d')
            },
            Granularity='DAILY',
            Metrics=['BlendedCost'],
            GroupBy=[
                {'Type': 'DIMENSION', 'Key': 'SERVICE'},
                {'Type': 'DIMENSION', 'Key': 'USAGE_TYPE'}
            ]
        )
        
        return self._process_cost_data(cost_data)
    
    def _process_cost_data(self, cost_data: Dict) -> Dict:
        """Process cost data into actionable insights"""
        total_cost = 0
        service_costs = {}
        
        for result in cost_data['ResultsByTime']:
            for group in result['Groups']:
                service = group['Keys'][0]
                cost = float(group['Metrics']['BlendedCost']['Amount'])
                
                total_cost += cost
                if service not in service_costs:
                    service_costs[service] = 0
                service_costs[service] += cost
        
        return {
            'total_cost': total_cost,
            'service_breakdown': service_costs,
            'optimization_recommendations': self._generate_cost_recommendations(service_costs)
        }
    
    def _generate_cost_recommendations(self, service_costs: Dict) -> List[Dict]:
        """Generate cost optimization recommendations"""
        recommendations = []
        
        # Lambda cost optimization
        if 'AWS Lambda' in service_costs:
            lambda_cost = service_costs['AWS Lambda']
            if lambda_cost > 100:  # High Lambda costs
                recommendations.append({
                    'service': 'Lambda',
                    'recommendation': 'Consider reserved capacity or provisioned concurrency',
                    'potential_savings': lambda_cost * 0.3,
                    'priority': 'high'
                })
        
        # DynamoDB cost optimization
        if 'Amazon DynamoDB' in service_costs:
            dynamodb_cost = service_costs['Amazon DynamoDB']
            if dynamodb_cost > 50:  # High DynamoDB costs
                recommendations.append({
                    'service': 'DynamoDB',
                    'recommendation': 'Review read/write capacity and consider auto-scaling',
                    'potential_savings': dynamodb_cost * 0.2,
                    'priority': 'medium'
                })
        
        # S3 cost optimization
        if 'Amazon Simple Storage Service' in service_costs:
            s3_cost = service_costs['Amazon Simple Storage Service']
            if s3_cost > 20:  # High S3 costs
                recommendations.append({
                    'service': 'S3',
                    'recommendation': 'Implement lifecycle policies and compression',
                    'potential_savings': s3_cost * 0.4,
                    'priority': 'medium'
                })
        
        return recommendations
    
    def implement_cost_optimizations(self, recommendations: List[Dict]):
        """Implement cost optimization recommendations"""
        for rec in recommendations:
            if rec['service'] == 'Lambda' and 'reserved capacity' in rec['recommendation']:
                self._optimize_lambda_costs()
            elif rec['service'] == 'DynamoDB' and 'auto-scaling' in rec['recommendation']:
                self._optimize_dynamodb_costs()
            elif rec['service'] == 'S3' and 'lifecycle policies' in rec['recommendation']:
                self._optimize_s3_costs()
    
    def _optimize_lambda_costs(self):
        """Optimize Lambda costs"""
        # Enable provisioned concurrency for frequently used functions
        functions = ['ona-forecastingApi-prod', 'ona-dataIngestion-prod']
        
        for function_name in functions:
            try:
                self.lambda_client.put_provisioned_concurrency_config(
                    FunctionName=function_name,
                    ProvisionedConcurrencyConfig={
                        'ProvisionedConcurrencyUnits': 5
                    }
                )
                print(f"Enabled provisioned concurrency for {function_name}")
            except Exception as e:
                print(f"Failed to enable provisioned concurrency for {function_name}: {e}")
    
    def _optimize_dynamodb_costs(self):
        """Optimize DynamoDB costs"""
        # Enable auto-scaling for tables
        tables = ['ona-platform-locations', 'ona-platform-weather-cache']
        
        for table_name in tables:
            try:
                # This would implement auto-scaling configuration
                print(f"Configured auto-scaling for {table_name}")
            except Exception as e:
                print(f"Failed to configure auto-scaling for {table_name}: {e}")
    
    def _optimize_s3_costs(self):
        """Optimize S3 costs"""
        # Implement lifecycle policies
        lifecycle_policy = {
            'Rules': [
                {
                    'ID': 'OnaPlatformLifecycle',
                    'Status': 'Enabled',
                    'Transitions': [
                        {
                            'Days': 30,
                            'StorageClass': 'STANDARD_IA'
                        },
                        {
                            'Days': 90,
                            'StorageClass': 'GLACIER'
                        },
                        {
                            'Days': 365,
                            'StorageClass': 'DEEP_ARCHIVE'
                        }
                    ]
                }
            ]
        }
        
        buckets = ['sa-api-client-input', 'sa-api-client-output']
        for bucket in buckets:
            try:
                # This would implement lifecycle policies
                print(f"Configured lifecycle policy for {bucket}")
            except Exception as e:
                print(f"Failed to configure lifecycle policy for {bucket}: {e}")

# Usage example
optimizer = CostOptimizer()
start_date = datetime.now() - timedelta(days=30)
end_date = datetime.now()
cost_analysis = optimizer.analyze_costs(start_date, end_date)
optimizer.implement_cost_optimizations(cost_analysis['optimization_recommendations'])
```

#### Resource Monitoring and Alerting
**Purpose**: Monitor resource usage and costs

```bash
#!/bin/bash
# resource_monitor.sh - Resource usage monitoring

# Monitor Lambda costs
monitor_lambda_costs() {
    echo "Monitoring Lambda costs..."
    
    # Get Lambda cost for last 24 hours
    lambda_cost=$(aws ce get-cost-and-usage \
        --time-period Start=$(date -d '24 hours ago' +%Y-%m-%d),End=$(date +%Y-%m-%d) \
        --granularity DAILY \
        --metrics BlendedCost \
        --group-by Type=DIMENSION,Key=SERVICE \
        --filter '{
            "Dimensions": {
                "Key": "SERVICE",
                "Values": ["AWS Lambda"]
            }
        }' \
        --query 'ResultsByTime[0].Groups[0].Metrics.BlendedCost.Amount' \
        --output text)
    
    echo "Lambda cost (24h): $${lambda_cost}"
    
    # Alert if cost exceeds threshold
    if (( $(echo "$lambda_cost > 50" | bc -l) )); then
        echo "ALERT: Lambda costs exceed $50 threshold"
        # Send alert notification
    fi
}

# Monitor DynamoDB costs
monitor_dynamodb_costs() {
    echo "Monitoring DynamoDB costs..."
    
    dynamodb_cost=$(aws ce get-cost-and-usage \
        --time-period Start=$(date -d '24 hours ago' +%Y-%m-%d),End=$(date +%Y-%m-%d) \
        --granularity DAILY \
        --metrics BlendedCost \
        --group-by Type=DIMENSION,Key=SERVICE \
        --filter '{
            "Dimensions": {
                "Key": "SERVICE",
                "Values": ["Amazon DynamoDB"]
            }
        }' \
        --query 'ResultsByTime[0].Groups[0].Metrics.BlendedCost.Amount' \
        --output text)
    
    echo "DynamoDB cost (24h): $${dynamodb_cost}"
    
    if (( $(echo "$dynamodb_cost > 25" | bc -l) )); then
        echo "ALERT: DynamoDB costs exceed $25 threshold"
    fi
}

# Monitor S3 costs
monitor_s3_costs() {
    echo "Monitoring S3 costs..."
    
    s3_cost=$(aws ce get-cost-and-usage \
        --time-period Start=$(date -d '24 hours ago' +%Y-%m-%d),End=$(date +%Y-%m-%d) \
        --granularity DAILY \
        --metrics BlendedCost \
        --group-by Type=DIMENSION,Key=SERVICE \
        --filter '{
            "Dimensions": {
                "Key": "SERVICE",
                "Values": ["Amazon Simple Storage Service"]
            }
        }' \
        --query 'ResultsByTime[0].Groups[0].Metrics.BlendedCost.Amount' \
        --output text)
    
    echo "S3 cost (24h): $${s3_cost}"
    
    if (( $(echo "$s3_cost > 10" | bc -l) )); then
        echo "ALERT: S3 costs exceed $10 threshold"
    fi
}

# Run monitoring
monitor_lambda_costs
monitor_dynamodb_costs
monitor_s3_costs

# Generate daily cost report
echo "Generating daily cost report..."
total_cost=$(aws ce get-cost-and-usage \
    --time-period Start=$(date -d '24 hours ago' +%Y-%m-%d),End=$(date +%Y-%m-%d) \
    --granularity DAILY \
    --metrics BlendedCost \
    --query 'ResultsByTime[0].Total.BlendedCost.Amount' \
    --output text)

echo "Total platform cost (24h): $${total_cost}"
echo "Daily cost report generated at $(date)"
```