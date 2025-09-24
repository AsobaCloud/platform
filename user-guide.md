# Customer Onboarding Guide: Ona Platform

This guide walks you through the essential steps to get your Ona Platform up and running with minimum viable usage. Follow these steps to configure all necessary components and start generating insights from your solar assets.

## Prerequisites Checklist

Before starting, ensure you have:

- [ ] **AWS Account** with appropriate permissions
- [ ] **Domain Control** (e.g., api.yourcompany.com)
- [ ] **SCADA/Inverter Access** or data export capabilities
- [ ] **Visual Crossing API Key** for weather data
- [ ] **Asset Inventory** (inverter models, locations, capacities)
- [ ] **Historical Data** (at least 30 days of sensor data)

## Step 1: Initial Platform Setup

### 1.1 Deploy Core Infrastructure

```bash
# Clone the platform repository
git clone <repository-url>
cd ona-platform

# Configure your environment
cp config/environment.sh.example config/environment.sh
# Edit config/environment.sh with your specific settings:
# - AWS_REGION
# - API_DOMAIN (e.g., api.yourcompany.com)
# - INPUT_BUCKET and OUTPUT_BUCKET names
```

### 1.2 Set Up DNS Infrastructure (One-time)

```bash
# Run DNS setup (this may take 10-30 minutes)
cd dns-setup
./setup-dns-infrastructure.sh

# Verify certificate is ready
./check-certificate-status.sh
```

### 1.3 One-Command Build & Deploy (Recommended)

This path requires GitHub CLI (gh) and AWS CLI. No local Docker needed.

```bash
# 1) Put your required secrets into a local env file (gitignored)
cat > .env.local << 'EOF'
VISUAL_CROSSING_API_KEY=5TNNNSTUM59VC7PARY5GDXHPV
EOF

# 2) Run the one-command helper (triggers CI build, waits, then deploys)
bash local-deploy.sh
```

Once the DNS certificate is ISSUED, map the custom domain (optional):
```bash
./scripts/11-map-custom-domain.sh
./scripts/12-validate-deployment.sh
```

### 1.4 Build and Push Service Images (GitHub Actions)

You do NOT need local Docker. Build the container images in CI and push to ECR.

Prerequisites (one-time):
- In the GitHub repo (`AsobaCloud/platform`), add Secrets with ECR permissions for region `af-south-1`:
  - `AWS_ACCESS_KEY_ID`
  - `AWS_SECRET_ACCESS_KEY`

Trigger the workflow via GitHub UI:
1. Open the repo → Actions tab
2. Select "Build and Push ECR Images"
3. Click "Run workflow" (branch: `main`)

Trigger via CLI (example):
```bash
# Ensure you are authenticated with GitHub CLI
gh auth status

# Start the workflow on main
gh workflow run "Build and Push ECR Images" --ref main

# Optional: watch the run until completion
gh run watch
```

Wait for the workflow to complete. You should see these images in ECR with tag `:prod`:
- `ona-base`, `ona-dataingestion`, `ona-weathercache`, `ona-interpolationservice`, `ona-globaltrainingservice`, `ona-forecastingapi`

### 1.5 Deploy Platform Services

```bash
# Deploy all services
./deploy-all.sh

# Validate deployment
./validate.sh
```

## Step 2: Configure Your Assets

### 2.1 Create Asset Inventory

Create your asset configuration file:

```json
{
  "assets": [
    {
      "id": "INV-001",
      "name": "Main Inverter 1",
      "type": "Solar Inverter",
      "capacity_kw": 20.0,
      "location": {
        "latitude": -26.2041,
        "longitude": 28.0473,
        "address": "Your Solar Farm, City"
      },
      "components": [
        {
          "oem": "Sungrow",
          "model": "SG20KTL",
          "serial": "SN123456",
          "type": "inverter",
          "installation_date": "2024-01-15T00:00:00Z"
        }
      ]
    }
  ]
}
```

### 2.2 Upload Asset Configuration

```bash
# Upload asset configuration
aws s3 cp assets.json s3://your-input-bucket/assets.json
```

## Step 3: Configure Data Sources

### 3.1 Set Up Weather API

```bash
# Configure Visual Crossing API key
aws ssm put-parameter \
  --name /ona-platform/prod/visual-crossing-api-key \
  --value "YOUR_VISUAL_CROSSING_API_KEY" \
  --type SecureString \
  --overwrite
```

### 3.2 Configure Data Integration

Choose your integration method:

**Option A: Direct Data Feed (Recommended)**
```bash
# Configure your SCADA system to send data to:
# POST https://api.yourcompany.com/upload_nowcast
```

**Option B: File Upload**
```bash
# Upload historical data for model training
curl -X POST https://api.yourcompany.com/upload_train \
  -H "Content-Type: application/json" \
  -d '{"customer_id": "your-company", "data_type": "historical"}'
```

## Step 4: Upload Historical Data

### 4.1 Prepare Your Data

Format your sensor data as CSV:

```csv
timestamp,asset_id,temperature_c,voltage_v,power_kw
2024-01-01T08:00:00Z,INV-001,45.2,800.5,18.3
2024-01-01T08:15:00Z,INV-001,46.1,799.8,17.9
2024-01-01T08:30:00Z,INV-001,47.3,801.2,19.1
```

### 4.2 Upload Training Data

```bash
# Get presigned URL for upload
curl -X POST https://api.yourcompany.com/upload_train \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "your-company",
    "data_type": "historical",
    "metadata": {
      "site_id": "your-site",
      "start_date": "2024-01-01T00:00:00Z",
      "end_date": "2024-01-31T23:59:59Z"
    }
  }'

# Upload your CSV file to the returned URL
curl -X PUT "PRESIGNED_URL" \
  -H "Content-Type: text/csv" \
  --data-binary @your_sensor_data.csv
```

## Step 5: Configure Monitoring Thresholds

### 5.1 Set Detection Parameters

```bash
# Configure detection sensitivity
aws ssm put-parameter \
  --name /ona-platform/prod/detection-threshold \
  --value "0.7" \
  --type String \
  --overwrite

# Configure loss function weights
aws ssm put-parameter \
  --name /ona-platform/prod/loss-function-weights \
  --value '{"w_energy": 1.0, "w_cost": 0.3, "w_mttr": 0.2}' \
  --type String \
  --overwrite
```

### 5.2 Set Up Alerting

```bash
# Configure email notifications
aws sns subscribe \
  --topic-arn arn:aws:sns:af-south-1:ACCOUNT:ona-platform-alerts \
  --protocol email \
  --notification-endpoint "ops@yourcompany.com"
```

## Step 6: Test Your Setup

### 6.1 Generate Your First Forecast

```bash
# Test forecast generation
curl "https://api.yourcompany.com/forecast?customer_id=your-company&site_id=your-site"
```

### 6.2 Verify Data Processing

```bash
# Check if data is being processed
aws logs tail /aws/lambda/ona-interpolationService-prod --follow

# Check weather cache updates
aws logs tail /aws/lambda/ona-weatherCache-prod --follow
```

## Step 7: Configure Operations & Maintenance

### 7.1 Set Up OODA Workflow

```bash
# Configure fault categories
cat > configs/ooda/categories.yaml << EOF
Weather Damage:
  - hail_impact
  - wind_stress

OEM Fault:
  - inverter_overtemp
  - dc_bus_fault

Ops Fault:
  - wrong_setpoint
  - maintenance_overdue
EOF

# Configure crew information
cat > configs/ooda/loss_function.yaml << EOF
weights:
  w_energy: 1.0
  w_cost: 0.3
  w_mttr: 0.2

crew:
  crews_available: 2
  hours_per_day: 8
EOF
```

### 7.2 Test O&M Workflow

```bash
# Test fault detection
curl -X POST https://api.yourcompany.com/detect \
  -H "Content-Type: application/json" \
  -d '{"asset_id": "INV-001", "severity_threshold": 0.7}'

# Test diagnostics
curl -X POST https://api.yourcompany.com/diagnose \
  -H "Content-Type: application/json" \
  -d '{"asset_id": "INV-001"}'
```

## Step 8: Go Live Checklist

Before going live, verify:

- [ ] **API Endpoints** responding correctly
- [ ] **Weather Data** being cached every 15 minutes
- [ ] **Historical Data** processed and models trained
- [ ] **Real-time Data** flowing from SCADA/inverters
- [ ] **Forecasts** generating with reasonable accuracy
- [ ] **Alerts** configured and tested
- [ ] **O&M Workflow** operational
- [ ] **Team Training** completed

## Step 9: Ongoing Operations

### 9.1 Daily Monitoring

```bash
# Morning health check
./scripts/daily_health_check.sh

# Performance review
./scripts/performance_review.sh
```

### 9.2 Weekly Tasks

```bash
# Generate weekly reports
./scripts/weekly_report.sh

# Review and adjust thresholds
aws ssm get-parameter --name /ona-platform/prod/detection-threshold
```

## Troubleshooting Common Issues

### Issue: No Forecasts Generated
**Solution**: Check if historical data was uploaded and models trained
```bash
aws s3 ls s3://your-output-bucket/models/
```

### Issue: Weather Data Not Updating
**Solution**: Verify Visual Crossing API key
```bash
aws ssm get-parameter --name /ona-platform/prod/visual-crossing-api-key --with-decryption
```

### Issue: High False Positive Rate
**Solution**: Adjust detection threshold
```bash
aws ssm put-parameter \
  --name /ona-platform/prod/detection-threshold \
  --value "0.8" \
  --type String \
  --overwrite
```

## Support and Resources

- **Technical Support**: support@asoba.co
- **Documentation**: [README.md](README.md) for system overview
- **Operations Guide**: [O&M.md](O&M.md) for daily operations
- **System Admin Guide**: [SYSTEM ADMIN.md](SYSTEM%20ADMIN.md) for technical administration

## Next Steps

Once your platform is operational:

1. **Scale Up**: Add more assets and sites
2. **Integrate**: Connect additional data sources
3. **Customize**: Configure site-specific parameters
4. **Extend**: Add insurance automation, fleet analytics, or other services
5. **Optimize**: Fine-tune thresholds and workflows based on your data