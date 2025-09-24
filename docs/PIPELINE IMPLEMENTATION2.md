
## Step-by-Step Setup Guide for New Pipeline Components


### 1. Establish Naming Convention First

```
SERVICE NAMES:
- weatherCache
- interpolationService  
- globalTrainingService
- forecastingApi
- nowcastingService
- dataIngestion
- modelTraining
- predictionEngine
- alertService
- dataValidation
- reportGeneration
- systemHealth

NAMING PATTERN:
- Lambda: ona-{serviceName}-{stage}
- Logs: /aws/lambda/ona-{serviceName}-{stage}
- API Gateway: ona-api-{stage}
```

### 2. Standard Tags for Everything

```json
{
  "Project": "ona-platform",
  "Environment": "prod",
  "Service": "{serviceName}",
  "Owner": "engineering",
  "CostCenter": "solar-forecasting"
}
```

### 3. Docker-Based Lambda Implementation

#### A. Create Base Docker Image for Data Science Dependencies

**Create base/Dockerfile:**
```dockerfile
# base/Dockerfile
FROM public.ecr.aws/lambda/python:3.9

# Install system dependencies
RUN yum update -y && \
    yum install -y \
    gcc \
    gcc-c++ \
    cmake \
    python3-devel \
    atlas-devel \
    atlas-sse3-devel \
    lapack-devel \
    openblas-devel \
    libpng-devel \
    freetype-devel \
    && yum clean all

# Install Python dependencies
COPY requirements-base.txt .
RUN pip install --no-cache-dir -r requirements-base.txt

# Copy shared utilities
COPY utils/ /opt/python/utils/
ENV PYTHONPATH=/opt/python:$PYTHONPATH
```

**Create base/requirements-base.txt:**
```txt
pandas==2.0.3
numpy==1.24.3
scipy==1.10.1
scikit-learn==1.3.0
boto3==1.28.0
requests==2.31.0
pytz==2023.3
python-dateutil==2.8.2
aws-lambda-powertools==2.25.0
```

#### B. Create Service-Specific Docker Images

**weatherCache/Dockerfile:**
```dockerfile
FROM ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/ona-base:latest

# Install weather-specific dependencies
RUN pip install --no-cache-dir \
    aiohttp==3.8.5 \
    asyncio==3.4.3

# Copy function code
COPY app.py ${LAMBDA_TASK_ROOT}

CMD [ "app.lambda_handler" ]
```

**interpolationService/Dockerfile:**
```dockerfile
FROM ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/ona-base:latest

# Install ML dependencies
RUN pip install --no-cache-dir \
    lightgbm==3.3.5 \
    xgboost==1.7.6 \
    joblib==1.3.1

# Copy function code and models
COPY app.py ${LAMBDA_TASK_ROOT}
COPY models/ ${LAMBDA_TASK_ROOT}/models/

CMD [ "app.lambda_handler" ]
```

**forecastingApi/Dockerfile:**
```dockerfile
FROM ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/ona-base:latest

# Install inference dependencies (lightweight)
RUN pip install --no-cache-dir \
    tensorflow-lite==2.13.0 \
    onnxruntime==1.15.1

COPY app.py ${LAMBDA_TASK_ROOT}
COPY utils/ ${LAMBDA_TASK_ROOT}/utils/

CMD [ "app.lambda_handler" ]
```

#### C. Create ECR Repositories
```bash
# Create ECR repositories for all services
SERVICES=("base" "weatherCache" "interpolationService" "globalTrainingService" "forecastingApi" "dataIngestion" "modelTraining" "predictionEngine" "alertService" "dataValidation" "reportGeneration" "systemHealth")

for SERVICE in "${SERVICES[@]}"; do
    aws ecr create-repository \
        --repository-name ona-${SERVICE} \
        --region af-south-1 \
        --tags Key=Project,Value=ona-platform Key=Environment,Value=prod Key=Service,Value=${SERVICE} || true
done
```

#### B. Create IAM Roles for Docker Lambdas
```bash
# Create trust policy for Lambda
cat > lambda-trust-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

# Create service-specific IAM roles
aws iam create-role \
  --role-name ona-lambda-interpolationService-role \
  --assume-role-policy-document file://lambda-trust-policy.json \
  --tags Key=Project,Value=ona-platform Key=Environment,Value=prod Key=Service,Value=interpolationService

aws iam create-role \
  --role-name ona-lambda-weatherCache-role \
  --assume-role-policy-document file://lambda-trust-policy.json \
  --tags Key=Project,Value=ona-platform Key=Environment,Value=prod Key=Service,Value=weatherCache
```

#### C. Attach IAM Policies
```bash
# Create interpolation service policy
cat > interpolation-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:*:*:*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": [
        "arn:aws:s3:::sa-api-client-input/*",
        "arn:aws:s3:::sa-api-client-output/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:Query",
        "dynamodb:Scan"
      ],
      "Resource": "arn:aws:dynamodb:*:*:table/ona-platform-locations"
    }
  ]
}
EOF

# Create weatherCache policy
cat > weatherCache-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:*:*:*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject"
      ],
      "Resource": [
        "arn:aws:s3:::sa-api-client-input/*",
        "arn:aws:s3:::sa-api-client-output/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:Query"
      ],
      "Resource": "arn:aws:dynamodb:*:*:table/ona-platform-locations"
    }
  ]
}
EOF

# Attach policies to roles
aws iam put-role-policy \
  --role-name ona-lambda-interpolationService-role \
  --policy-name S3DynamoAccess \
  --policy-document file://interpolation-policy.json

aws iam put-role-policy \
  --role-name ona-lambda-weatherCache-role \
  --policy-name S3DynamoAccess \
  --policy-document file://weatherCache-policy.json
```

#### D. Create Lambda Function (Docker)
```bash
# Create Lambda function with Docker image
aws lambda create-function \
  --function-name ona-interpolationService-prod \
  --package-type Image \
  --code ImageUri=${ACCOUNT_ID}.dkr.ecr.af-south-1.amazonaws.com/ona-interpolationService:latest \
  --role arn:aws:iam::${ACCOUNT_ID}:role/ona-lambda-interpolationService-role \
  --timeout 900 \
  --memory-size 2048 \
  --environment Variables="{S3_INPUT_BUCKET=sa-api-client-input,S3_OUTPUT_BUCKET=sa-api-client-output,DYNAMODB_TABLE=ona-platform-locations}" \
  --tags Project=ona-platform,Environment=prod,Service=interpolationService

aws lambda create-function \
  --function-name ona-weatherCache-prod \
  --package-type Image \
  --code ImageUri=${ACCOUNT_ID}.dkr.ecr.af-south-1.amazonaws.com/ona-weatherCache:latest \
  --role arn:aws:iam::${ACCOUNT_ID}:role/ona-lambda-weatherCache-role \
  --timeout 300 \
  --memory-size 1024 \
  --environment Variables="{VISUAL_CROSSING_API_KEY=xxx,S3_INPUT_BUCKET=sa-api-client-input,DYNAMODB_TABLE=ona-platform-locations}" \
  --tags Project=ona-platform,Environment=prod,Service=weatherCache
```

#### G. Build and Deploy Docker Images

**Create build-and-deploy.sh:**
```bash
#!/bin/bash
# build-and-deploy.sh

set -euo pipefail

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION="af-south-1"
ECR_REGISTRY="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"

echo "Building and deploying Docker images for account: ${ACCOUNT_ID}"

# Login to ECR
aws ecr get-login-password --region ${REGION} | docker login --username AWS --password-stdin ${ECR_REGISTRY}

# Build base image first
echo "Building base image..."
docker build -t ona-base:latest ./base
docker tag ona-base:latest ${ECR_REGISTRY}/ona-base:latest
docker push ${ECR_REGISTRY}/ona-base:latest

# Build service images
SERVICES=("weatherCache" "interpolationService" "globalTrainingService" "forecastingApi" "dataIngestion" "modelTraining" "predictionEngine" "alertService" "dataValidation" "reportGeneration" "systemHealth")

for SERVICE in "${SERVICES[@]}"; do
    echo "Building ${SERVICE}..."
    
    # Build and push
    docker build \
        --build-arg AWS_ACCOUNT_ID=${ACCOUNT_ID} \
        --build-arg AWS_REGION=${REGION} \
        -t ona-${SERVICE}:latest \
        ./${SERVICE}
    
    docker tag ona-${SERVICE}:latest ${ECR_REGISTRY}/ona-${SERVICE}:latest
    docker push ${ECR_REGISTRY}/ona-${SERVICE}:latest
    
    # Update Lambda function
    echo "Updating Lambda function ona-${SERVICE}-prod..."
    aws lambda update-function-code \
        --function-name ona-${SERVICE}-prod \
        --image-uri ${ECR_REGISTRY}/ona-${SERVICE}:latest \
        --region ${REGION}
done

echo "Build and deployment completed!"
```

**Create create-docker-lambdas.sh:**
```bash
#!/bin/bash
# create-docker-lambdas.sh

set -euo pipefail

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION="af-south-1"
ECR_REGISTRY="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"

# Create Lambda functions with container images
SERVICES=(
    "weatherCache:512:300"
    "interpolationService:3008:900"
    "globalTrainingService:1024:300"
    "forecastingApi:3008:60"
    "dataIngestion:1024:300"
    "modelTraining:3008:900"
    "predictionEngine:2048:60"
    "alertService:512:60"
    "dataValidation:1024:300"
    "reportGeneration:1024:300"
    "systemHealth:512:60"
)

for SERVICE_CONFIG in "${SERVICES[@]}"; do
    IFS=':' read -r SERVICE MEMORY TIMEOUT <<< "$SERVICE_CONFIG"
    
    echo "Creating Lambda function ona-${SERVICE}-prod..."
    
    aws lambda create-function \
        --function-name ona-${SERVICE}-prod \
        --package-type Image \
        --code ImageUri=${ECR_REGISTRY}/ona-${SERVICE}:latest \
        --role arn:aws:iam::${ACCOUNT_ID}:role/ona-lambda-${SERVICE}-role \
        --timeout ${TIMEOUT} \
        --memory-size ${MEMORY} \
        --environment Variables="{
            ENVIRONMENT=prod,
            SERVICE_NAME=${SERVICE},
            LOG_LEVEL=INFO,
            S3_INPUT_BUCKET=sa-api-client-input,
            S3_OUTPUT_BUCKET=sa-api-client-output,
            DYNAMODB_TABLE=ona-platform-locations
        }" \
        --tags \
            Project=ona-platform \
            Environment=prod \
            Service=${SERVICE} \
            Owner=engineering \
            CostCenter=solar-forecasting \
        --region ${REGION}
done
```

#### H. Sample Lambda Function Code

**weatherCache/app.py:**
```python
import json
import boto3
import pandas as pd
from datetime import datetime, timedelta
import asyncio
import aiohttp
import os
from aws_lambda_powertools import Metrics
from aws_lambda_powertools.metrics import MetricUnit

metrics = Metrics(namespace="OnaPlatform", service="weatherCache")
dynamodb = boto3.resource('dynamodb')
s3 = boto3.client('s3')

@metrics.log_metrics
def lambda_handler(event, context):
    """
    Docker Lambda handler for weather cache updates
    """
    try:
        # Initialize asyncio for concurrent API calls
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        # Get all active locations
        locations = get_all_active_locations()
        
        # Batch fetch weather data
        weather_results = loop.run_until_complete(
            fetch_all_weather_async(locations)
        )
        
        # Update S3 cache
        update_weather_cache(locations, weather_results)
        
        # Update forecast if it's 6 AM
        if datetime.now().hour == 6:
            forecast_results = loop.run_until_complete(
                fetch_all_forecasts_async(locations)
            )
            update_forecast_cache(locations, forecast_results)
        
        metrics.add_metric(name="LocationsUpdated", unit=MetricUnit.Count, value=len(locations))
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': f'Weather updated for {len(locations)} locations',
                'timestamp': datetime.now().isoformat()
            })
        }
        
    except Exception as e:
        print(f"Error in weather cache: {str(e)}")
        metrics.add_metric(name="Errors", unit=MetricUnit.Count, value=1)
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }

async def fetch_all_weather_async(locations):
    """Asynchronously fetch weather for all locations"""
    async with aiohttp.ClientSession() as session:
        tasks = [fetch_weather_async(session, loc) for loc in locations]
        return await asyncio.gather(*tasks, return_exceptions=True)

async def fetch_weather_async(session, location):
    """Fetch weather data from Visual Crossing API"""
    api_key = os.environ['VISUAL_CROSSING_API_KEY']
    url = f"https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/{location}"
    
    params = {
        'unitGroup': 'metric',
        'key': api_key,
        'include': 'current',
        'elements': 'datetime,temp,humidity,windspeed,cloudcover,solarradiation,solarenergy,uvindex'
    }
    
    try:
        async with session.get(url, params=params) as response:
            data = await response.json()
            return process_weather_data(data, location)
    except Exception as e:
        print(f"Error fetching weather for {location}: {str(e)}")
        return None

def get_all_active_locations():
    """Get all active locations from DynamoDB"""
    table = dynamodb.Table(os.environ['DYNAMODB_TABLE'])
    response = table.scan()
    return [item['location'] for item in response['Items']]

def process_weather_data(data, location):
    """Process weather data from API response"""
    if 'currentConditions' in data:
        current = data['currentConditions']
        return {
            'location': location,
            'timestamp': datetime.now().isoformat(),
            'temperature': current.get('temp'),
            'humidity': current.get('humidity'),
            'wind_speed': current.get('windspeed'),
            'cloud_cover': current.get('cloudcover'),
            'solar_radiation': current.get('solarradiation'),
            'uv_index': current.get('uvindex')
        }
    return None

def update_weather_cache(locations, weather_results):
    """Update weather cache in S3"""
    bucket = os.environ['S3_INPUT_BUCKET']
    timestamp = datetime.now().strftime('%Y%m%d_%H%M')
    
    for i, location in enumerate(locations):
        if weather_results[i] and not isinstance(weather_results[i], Exception):
            key = f"weather-cache/{location}/{timestamp}.json"
            s3.put_object(
                Bucket=bucket,
                Key=key,
                Body=json.dumps(weather_results[i]),
                ContentType='application/json'
            )
```

**interpolationService/app.py:**
```python
import json
import boto3
import pandas as pd
import numpy as np
from datetime import datetime
import joblib
import os
from aws_lambda_powertools import Metrics
from aws_lambda_powertools.metrics import MetricUnit

metrics = Metrics(namespace="OnaPlatform", service="interpolationService")
s3 = boto3.client('s3')

@metrics.log_metrics
def lambda_handler(event, context):
    """
    Docker Lambda handler for ML-based interpolation with weather enrichment
    """
    try:
        # Parse S3 event
        records = event.get('Records', [])
        if not records:
            return handle_direct_invocation(event)
        
        # Process S3 event
        bucket = records[0]['s3']['bucket']['name']
        key = records[0]['s3']['object']['key']
        
        # Download data from S3
        response = s3.get_object(Bucket=bucket, Key=key)
        df = pd.read_csv(response['Body'])
        
        # Extract metadata from key
        metadata = extract_metadata_from_key(key)
        location = metadata['location']
        inverter_brand = detect_inverter_brand(df)
        
        # Normalize data format
        normalized_df = normalize_data_format(df, inverter_brand)
        
        # Enrich with weather data
        weather_enriched_df = enrich_with_weather(
            normalized_df, 
            location, 
            'historical' in key
        )
        
        # Perform ML interpolation
        interpolated_df = perform_ml_interpolation(weather_enriched_df)
        
        # Calculate performance metrics for nowcast data
        if 'nowcast' in key:
            interpolated_df = calculate_performance_metrics(
                interpolated_df, 
                metadata.get('site_capacity', 100)
            )
        
        # Save processed data
        output_key = construct_output_key(key, metadata)
        save_to_s3(interpolated_df, bucket, output_key)
        
        metrics.add_metric(name="RecordsProcessed", unit=MetricUnit.Count, value=len(interpolated_df))
        metrics.add_metric(name="GapsFilled", unit=MetricUnit.Count, value=interpolated_df['interpolated'].sum())
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Interpolation completed',
                'input_key': key,
                'output_key': output_key,
                'records_processed': len(interpolated_df),
                'weather_enriched': True
            })
        }
        
    except Exception as e:
        print(f"Error in interpolation: {str(e)}")
        metrics.add_metric(name="Errors", unit=MetricUnit.Count, value=1)
        send_to_dlq(event, str(e))
        raise

def perform_ml_interpolation(df):
    """Use pre-trained LightGBM model for interpolation"""
    # Load pre-trained model
    model = joblib.load('models/interpolation_lgbm.pkl')
    
    # Identify gaps
    gaps = df['load_mw'].isna()
    
    if not gaps.any():
        df['interpolated'] = False
        return df
    
    # Feature engineering for interpolation
    features = prepare_interpolation_features(df)
    
    # Predict missing values
    predictions = model.predict(features[gaps])
    
    # Fill gaps
    df.loc[gaps, 'load_mw'] = predictions
    df['interpolated'] = gaps
    
    return df

def enrich_with_weather(df, location, is_historical):
    """Enrich data with weather information"""
    # Implementation for weather enrichment
    # This would fetch weather data and merge with the dataframe
    return df

def detect_inverter_brand(df):
    """Detect inverter brand from data patterns"""
    # Implementation for brand detection
    return "unknown"

def normalize_data_format(df, inverter_brand):
    """Normalize data format based on inverter brand"""
    # Implementation for data normalization
    return df
```

#### I. Local Testing Setup

**Create docker-compose.yml:**
```yaml
version: '3.8'

services:
  localstack:
    image: localstack/localstack:latest
    environment:
      - SERVICES=s3,lambda,dynamodb,ssm,events
      - DEBUG=1
      - DATA_DIR=/tmp/localstack/data
    ports:
      - "4566:4566"
    volumes:
      - "${TMPDIR:-/tmp}/localstack:/tmp/localstack"
      - "/var/run/docker.sock:/var/run/docker.sock"

  weathercache:
    build:
      context: ./weatherCache
      args:
        - AWS_ACCOUNT_ID=000000000000
        - AWS_REGION=us-east-1
    environment:
      - AWS_ENDPOINT_URL=http://localstack:4566
      - VISUAL_CROSSING_API_KEY=test-key
      - DYNAMODB_TABLE=ona-platform-locations
      - S3_INPUT_BUCKET=sa-api-client-input
    depends_on:
      - localstack

  interpolation:
    build:
      context: ./interpolationService
      args:
        - AWS_ACCOUNT_ID=000000000000
        - AWS_REGION=us-east-1
    environment:
      - AWS_ENDPOINT_URL=http://localstack:4566
      - S3_INPUT_BUCKET=sa-api-client-input
      - S3_OUTPUT_BUCKET=sa-api-client-output
      - DYNAMODB_TABLE=ona-platform-locations
    depends_on:
      - localstack

  test-runner:
    build: ./tests
    depends_on:
      - localstack
      - weathercache
      - interpolation
    command: pytest -v
```

#### E. CloudWatch Logs (Auto-created, but set retention)
```bash
aws logs put-retention-policy \
  --log-group-name /aws/lambda/ona-interpolationService-prod \
  --retention-in-days 30

aws logs put-retention-policy \
  --log-group-name /aws/lambda/ona-weatherCache-prod \
  --retention-in-days 30
```

#### F. Tag the Log Groups
```bash
aws logs tag-log-group \
  --log-group-name /aws/lambda/ona-interpolationService-prod \
  --tags Project=ona-platform,Environment=prod,Service=interpolationService

aws logs tag-log-group \
  --log-group-name /aws/lambda/ona-weatherCache-prod \
  --tags Project=ona-platform,Environment=prod,Service=weatherCache
```

### 3.5. Critical Infrastructure Components

#### A. Create DynamoDB Tables
```bash
# Location registry table
aws dynamodb create-table \
  --table-name ona-platform-locations \
  --attribute-definitions \
    AttributeName=customerId,AttributeType=S \
    AttributeName=location,AttributeType=S \
  --key-schema \
    AttributeName=customerId,KeyType=HASH \
    AttributeName=location,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --region af-south-1 \
  --tags \
    Key=Project,Value=ona-platform \
    Key=Environment,Value=prod \
    Key=Service,Value=database

# Weather cache table
aws dynamodb create-table \
  --table-name ona-platform-weather-cache \
  --attribute-definitions \
    AttributeName=location,AttributeType=S \
    AttributeName=timestamp,AttributeType=S \
  --key-schema \
    AttributeName=location,KeyType=HASH \
    AttributeName=timestamp,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --region af-south-1 \
  --tags \
    Key=Project,Value=ona-platform \
    Key=Environment,Value=prod \
    Key=Service,Value=weatherCache
```

#### B. Configure S3 Event Notifications (CRITICAL)
```bash
# Create S3 event configuration for interpolationService
cat > s3-events.json << EOF
{
  "LambdaFunctionConfigurations": [
    {
      "Id": "TriggerInterpolationOnHistoricalUpload",
      "LambdaFunctionArn": "arn:aws:lambda:af-south-1:${ACCOUNT_ID}:function:ona-interpolationService-prod",
      "Events": ["s3:ObjectCreated:*"],
      "Filter": {
        "Key": {
          "FilterRules": [
            {"Name": "prefix", "Value": "historical/"}
          ]
        }
      }
    },
    {
      "Id": "TriggerInterpolationOnNowcastUpload",
      "LambdaFunctionArn": "arn:aws:lambda:af-south-1:${ACCOUNT_ID}:function:ona-interpolationService-prod",
      "Events": ["s3:ObjectCreated:*"],
      "Filter": {
        "Key": {
          "FilterRules": [
            {"Name": "prefix", "Value": "nowcast/"}
          ]
        }
      }
    }
  ]
}
EOF

# Configure S3 to trigger interpolationService
aws s3api put-bucket-notification-configuration \
  --bucket sa-api-client-input \
  --notification-configuration file://s3-events.json

# Add S3 permission to invoke Lambda
aws lambda add-permission \
  --function-name ona-interpolationService-prod \
  --statement-id s3-invoke-interpolation \
  --action lambda:InvokeFunction \
  --principal s3.amazonaws.com \
  --source-arn arn:aws:s3:::sa-api-client-input
```

#### C. Create EventBridge Rules for Scheduled Tasks
```bash
# Create scheduled rule for weatherCache (every 15 minutes)
aws events put-rule \
  --name ona-weatherCache-schedule \
  --schedule-expression "rate(15 minutes)" \
  --state ENABLED \
  --region af-south-1 \
  --tags Key=Project,Value=ona-platform Key=Environment,Value=prod Key=Service,Value=weatherCache

# Add Lambda permission for EventBridge
aws lambda add-permission \
  --function-name ona-weatherCache-prod \
  --statement-id scheduled-invoke \
  --action lambda:InvokeFunction \
  --principal events.amazonaws.com \
  --source-arn arn:aws:events:af-south-1:${ACCOUNT_ID}:rule/ona-weatherCache-schedule

# Create target for EventBridge rule
aws events put-targets \
  --rule ona-weatherCache-schedule \
  --targets "Id"="1","Arn"="arn:aws:lambda:af-south-1:${ACCOUNT_ID}:function:ona-weatherCache-prod" \
  --region af-south-1

# Create scheduled rule for dataIngestion (daily at 2 AM)
aws events put-rule \
  --name ona-dataIngestion-schedule \
  --schedule-expression "cron(0 2 * * ? *)" \
  --state ENABLED \
  --region af-south-1 \
  --tags Key=Project,Value=ona-platform Key=Environment,Value=prod Key=Service,Value=dataIngestion

# Add Lambda permission for dataIngestion
aws lambda add-permission \
  --function-name ona-dataIngestion-prod \
  --statement-id scheduled-ingestion \
  --action lambda:InvokeFunction \
  --principal events.amazonaws.com \
  --source-arn arn:aws:events:af-south-1:${ACCOUNT_ID}:rule/ona-dataIngestion-schedule

# Create target for dataIngestion
aws events put-targets \
  --rule ona-dataIngestion-schedule \
  --targets "Id"="1","Arn"="arn:aws:lambda:af-south-1:${ACCOUNT_ID}:function:ona-dataIngestion-prod" \
  --region af-south-1
```

#### D. Create S3 Buckets (if they don't exist)
```bash
# Create input bucket
aws s3 mb s3://sa-api-client-input --region af-south-1
aws s3api put-bucket-tagging \
  --bucket sa-api-client-input \
  --tagging 'TagSet=[{Key=Project,Value=ona-platform},{Key=Environment,Value=prod},{Key=Service,Value=data-storage}]'

# Create output bucket
aws s3 mb s3://sa-api-client-output --region af-south-1
aws s3api put-bucket-tagging \
  --bucket sa-api-client-output \
  --tagging 'TagSet=[{Key=Project,Value=ona-platform},{Key=Environment,Value=prod},{Key=Service,Value=data-storage}]'
```

### 4. Setup API Gateway with Custom Domain

#### A. Create ONE API Gateway for all services
```bash
aws apigateway create-rest-api \
  --name ona-api-prod \
  --description "Ona Platform API" \
  --endpoint-configuration types=REGIONAL
```

#### B. Add Each Service as a Resource
```bash
# Get root resource ID
ROOT_ID=$(aws apigateway get-resources --rest-api-id $API_ID --query 'items[0].id' --output text)

# Add forecast resource
aws apigateway create-resource \
  --rest-api-id $API_ID \
  --parent-id $ROOT_ID \
  --path-part forecast
```

#### C. Connect to Custom Domain (api.asoba.co)

**Step 1: Create SSL Certificate**
```bash
# Request SSL certificate for api.asoba.co
aws acm request-certificate \
  --domain-name api.asoba.co \
  --validation-method DNS \
  --region us-east-1 \
  --tags Key=Project,Value=ona-platform Key=Environment,Value=prod Key=Service,Value=api-gateway
```

**Step 2: Add DNS Validation Record**
```bash
# Get certificate ARN
CERT_ARN=$(aws acm list-certificates --query 'CertificateSummaryList[?DomainName==`api.asoba.co`].CertificateArn' --output text)

# Get validation record
aws acm describe-certificate --certificate-arn $CERT_ARN --query 'DomainValidationOptions[0].ResourceRecord'

# Add the CNAME record to Route53 hosted zone Z02057713AMAS6GXTEGNR
aws route53 change-resource-record-sets \
  --hosted-zone-id Z02057713AMAS6GXTEGNR \
  --change-batch file://validation-record.json
```

**Step 3: Create Custom Domain Name**
```bash
# Wait for certificate validation (check status)
aws acm describe-certificate --certificate-arn $CERT_ARN --query 'Status'

# Create custom domain name
aws apigateway create-domain-name \
  --domain-name api.asoba.co \
  --certificate-arn $CERT_ARN \
  --endpoint-configuration types=REGIONAL \
  --tags Project=ona-platform,Environment=prod,Service=api-gateway
```

**Step 4: Create Base Path Mapping**

**4A. Create API Gateway Stage**
```bash
# Deploy the API to create a stage
aws apigateway create-deployment \
  --rest-api-id $API_ID \
  --stage-name prod \
  --stage-description "Production stage" \
  --description "Initial deployment"
```

**4B. Create Resources for Each Service**
```bash
# Get root resource ID
ROOT_ID=$(aws apigateway get-resources --rest-api-id $API_ID --query 'items[0].id' --output text)

# Create all service resources
aws apigateway create-resource --rest-api-id $API_ID --parent-id $ROOT_ID --path-part forecast
aws apigateway create-resource --rest-api-id $API_ID --parent-id $ROOT_ID --path-part weatherCache
aws apigateway create-resource --rest-api-id $API_ID --parent-id $ROOT_ID --path-part nowcasting
aws apigateway create-resource --rest-api-id $API_ID --parent-id $ROOT_ID --path-part interpolation
aws apigateway create-resource --rest-api-id $API_ID --parent-id $ROOT_ID --path-part training
aws apigateway create-resource --rest-api-id $API_ID --parent-id $ROOT_ID --path-part prediction
aws apigateway create-resource --rest-api-id $API_ID --parent-id $ROOT_ID --path-part ingestion
aws apigateway create-resource --rest-api-id $API_ID --parent-id $ROOT_ID --path-part alerts
aws apigateway create-resource --rest-api-id $API_ID --parent-id $ROOT_ID --path-part validation
aws apigateway create-resource --rest-api-id $API_ID --parent-id $ROOT_ID --path-part reports
aws apigateway create-resource --rest-api-id $API_ID --parent-id $ROOT_ID --path-part health

# Get all resource IDs
FORECAST_ID=$(aws apigateway get-resources --rest-api-id $API_ID --query 'items[?pathPart==`forecast`].id' --output text)
WEATHER_ID=$(aws apigateway get-resources --rest-api-id $API_ID --query 'items[?pathPart==`weatherCache`].id' --output text)
NOWCASTING_ID=$(aws apigateway get-resources --rest-api-id $API_ID --query 'items[?pathPart==`nowcasting`].id' --output text)
INTERPOLATION_ID=$(aws apigateway get-resources --rest-api-id $API_ID --query 'items[?pathPart==`interpolation`].id' --output text)
TRAINING_ID=$(aws apigateway get-resources --rest-api-id $API_ID --query 'items[?pathPart==`training`].id' --output text)
PREDICTION_ID=$(aws apigateway get-resources --rest-api-id $API_ID --query 'items[?pathPart==`prediction`].id' --output text)
INGESTION_ID=$(aws apigateway get-resources --rest-api-id $API_ID --query 'items[?pathPart==`ingestion`].id' --output text)
ALERTS_ID=$(aws apigateway get-resources --rest-api-id $API_ID --query 'items[?pathPart==`alerts`].id' --output text)
VALIDATION_ID=$(aws apigateway get-resources --rest-api-id $API_ID --query 'items[?pathPart==`validation`].id' --output text)
REPORTS_ID=$(aws apigateway get-resources --rest-api-id $API_ID --query 'items[?pathPart==`reports`].id' --output text)
HEALTH_ID=$(aws apigateway get-resources --rest-api-id $API_ID --query 'items[?pathPart==`health`].id' --output text)
```

**4C. Create Methods for Each Resource**
```bash
# Add methods to all services
aws apigateway put-method --rest-api-id $API_ID --resource-id $FORECAST_ID --http-method GET --authorization-type NONE
aws apigateway put-method --rest-api-id $API_ID --resource-id $WEATHER_ID --http-method GET --authorization-type NONE
aws apigateway put-method --rest-api-id $API_ID --resource-id $NOWCASTING_ID --http-method GET --authorization-type NONE
aws apigateway put-method --rest-api-id $API_ID --resource-id $INTERPOLATION_ID --http-method POST --authorization-type NONE
aws apigateway put-method --rest-api-id $API_ID --resource-id $TRAINING_ID --http-method POST --authorization-type NONE
aws apigateway put-method --rest-api-id $API_ID --resource-id $PREDICTION_ID --http-method GET --authorization-type NONE
aws apigateway put-method --rest-api-id $API_ID --resource-id $INGESTION_ID --http-method POST --authorization-type NONE
aws apigateway put-method --rest-api-id $API_ID --resource-id $ALERTS_ID --http-method GET --authorization-type NONE
aws apigateway put-method --rest-api-id $API_ID --resource-id $VALIDATION_ID --http-method POST --authorization-type NONE
aws apigateway put-method --rest-api-id $API_ID --resource-id $REPORTS_ID --http-method GET --authorization-type NONE
aws apigateway put-method --rest-api-id $API_ID --resource-id $HEALTH_ID --http-method GET --authorization-type NONE
```

**4D. Create Lambda Integration for Each Method**
```bash
# Integrate all services with their Lambda functions
aws apigateway put-integration --rest-api-id $API_ID --resource-id $FORECAST_ID --http-method GET --type AWS_PROXY --integration-http-method POST --uri arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/arn:aws:lambda:us-east-1:${ACCOUNT_ID}:function:ona-forecastingApi-prod/invocations

aws apigateway put-integration --rest-api-id $API_ID --resource-id $WEATHER_ID --http-method GET --type AWS_PROXY --integration-http-method POST --uri arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/arn:aws:lambda:us-east-1:${ACCOUNT_ID}:function:ona-weatherCache-prod/invocations

aws apigateway put-integration --rest-api-id $API_ID --resource-id $NOWCASTING_ID --http-method GET --type AWS_PROXY --integration-http-method POST --uri arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/arn:aws:lambda:us-east-1:${ACCOUNT_ID}:function:ona-nowcastingService-prod/invocations

aws apigateway put-integration --rest-api-id $API_ID --resource-id $INTERPOLATION_ID --http-method POST --type AWS_PROXY --integration-http-method POST --uri arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/arn:aws:lambda:us-east-1:${ACCOUNT_ID}:function:ona-interpolationService-prod/invocations

aws apigateway put-integration --rest-api-id $API_ID --resource-id $TRAINING_ID --http-method POST --type AWS_PROXY --integration-http-method POST --uri arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/arn:aws:lambda:us-east-1:${ACCOUNT_ID}:function:ona-globalTrainingService-prod/invocations

aws apigateway put-integration --rest-api-id $API_ID --resource-id $PREDICTION_ID --http-method GET --type AWS_PROXY --integration-http-method POST --uri arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/arn:aws:lambda:us-east-1:${ACCOUNT_ID}:function:ona-predictionEngine-prod/invocations

aws apigateway put-integration --rest-api-id $API_ID --resource-id $INGESTION_ID --http-method POST --type AWS_PROXY --integration-http-method POST --uri arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/arn:aws:lambda:us-east-1:${ACCOUNT_ID}:function:ona-dataIngestion-prod/invocations

aws apigateway put-integration --rest-api-id $API_ID --resource-id $ALERTS_ID --http-method GET --type AWS_PROXY --integration-http-method POST --uri arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/arn:aws:lambda:us-east-1:${ACCOUNT_ID}:function:ona-alertService-prod/invocations

aws apigateway put-integration --rest-api-id $API_ID --resource-id $VALIDATION_ID --http-method POST --type AWS_PROXY --integration-http-method POST --uri arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/arn:aws:lambda:us-east-1:${ACCOUNT_ID}:function:ona-dataValidation-prod/invocations

aws apigateway put-integration --rest-api-id $API_ID --resource-id $REPORTS_ID --http-method GET --type AWS_PROXY --integration-http-method POST --uri arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/arn:aws:lambda:us-east-1:${ACCOUNT_ID}:function:ona-reportGeneration-prod/invocations

aws apigateway put-integration --rest-api-id $API_ID --resource-id $HEALTH_ID --http-method GET --type AWS_PROXY --integration-http-method POST --uri arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/arn:aws:lambda:us-east-1:${ACCOUNT_ID}:function:ona-systemHealth-prod/invocations
```

**4E. Add Lambda Permissions**
```bash
# Allow API Gateway to invoke all Lambda functions
aws lambda add-permission --function-name ona-forecastingApi-prod --statement-id apigateway-forecast --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn arn:aws:execute-api:us-east-1:${ACCOUNT_ID}:${API_ID}/*/GET/forecast

aws lambda add-permission --function-name ona-weatherCache-prod --statement-id apigateway-weather --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn arn:aws:execute-api:us-east-1:${ACCOUNT_ID}:${API_ID}/*/GET/weatherCache

aws lambda add-permission --function-name ona-nowcastingService-prod --statement-id apigateway-nowcasting --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn arn:aws:execute-api:us-east-1:${ACCOUNT_ID}:${API_ID}/*/GET/nowcasting

aws lambda add-permission --function-name ona-interpolationService-prod --statement-id apigateway-interpolation --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn arn:aws:execute-api:us-east-1:${ACCOUNT_ID}:${API_ID}/*/POST/interpolation

aws lambda add-permission --function-name ona-globalTrainingService-prod --statement-id apigateway-training --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn arn:aws:execute-api:us-east-1:${ACCOUNT_ID}:${API_ID}/*/POST/training

aws lambda add-permission --function-name ona-predictionEngine-prod --statement-id apigateway-prediction --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn arn:aws:execute-api:us-east-1:${ACCOUNT_ID}:${API_ID}/*/GET/prediction

aws lambda add-permission --function-name ona-dataIngestion-prod --statement-id apigateway-ingestion --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn arn:aws:execute-api:us-east-1:${ACCOUNT_ID}:${API_ID}/*/POST/ingestion

aws lambda add-permission --function-name ona-alertService-prod --statement-id apigateway-alerts --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn arn:aws:execute-api:us-east-1:${ACCOUNT_ID}:${API_ID}/*/GET/alerts

aws lambda add-permission --function-name ona-dataValidation-prod --statement-id apigateway-validation --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn arn:aws:execute-api:us-east-1:${ACCOUNT_ID}:${API_ID}/*/POST/validation

aws lambda add-permission --function-name ona-reportGeneration-prod --statement-id apigateway-reports --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn arn:aws:execute-api:us-east-1:${ACCOUNT_ID}:${API_ID}/*/GET/reports

aws lambda add-permission --function-name ona-systemHealth-prod --statement-id apigateway-health --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn arn:aws:execute-api:us-east-1:${ACCOUNT_ID}:${API_ID}/*/GET/health
```

**4F. Redeploy API**
```bash
# Redeploy with all resources and methods
aws apigateway create-deployment \
  --rest-api-id $API_ID \
  --stage-name prod \
  --stage-description "Production stage with all services" \
  --description "Deployment with forecast, weatherCache, and upload services"
```

**4G. Create Base Path Mapping**
```bash
# Create base path mapping
aws apigateway create-base-path-mapping \
  --domain-name api.asoba.co \
  --rest-api-id $API_ID \
  --stage prod

# Your endpoints will be:
# https://api.asoba.co/forecast
# https://api.asoba.co/weatherCache
# https://api.asoba.co/nowcasting
# https://api.asoba.co/interpolation
# https://api.asoba.co/training
# https://api.asoba.co/prediction
# https://api.asoba.co/ingestion
# https://api.asoba.co/alerts
# https://api.asoba.co/validation
# https://api.asoba.co/reports
# https://api.asoba.co/health
```

**4H. Test Each Endpoint**
```bash
# Test all GET endpoints
curl -X GET https://api.asoba.co/forecast
curl -X GET https://api.asoba.co/weatherCache
curl -X GET https://api.asoba.co/nowcasting
curl -X GET https://api.asoba.co/prediction
curl -X GET https://api.asoba.co/alerts
curl -X GET https://api.asoba.co/reports
curl -X GET https://api.asoba.co/health

# Test all POST endpoints
curl -X POST https://api.asoba.co/interpolation -H "Content-Type: application/json" -d '{"test": "data"}'
curl -X POST https://api.asoba.co/training -H "Content-Type: application/json" -d '{"test": "data"}'
curl -X POST https://api.asoba.co/ingestion -H "Content-Type: application/json" -d '{"test": "data"}'
curl -X POST https://api.asoba.co/validation -H "Content-Type: application/json" -d '{"test": "data"}'
```

**Step 5: Add DNS Record for Custom Domain**
```bash
# Get the API Gateway domain name target
TARGET_DOMAIN=$(aws apigateway get-domain-name --domain-name api.asoba.co --query 'distributionDomainName' --output text)

# Create A record alias pointing to API Gateway
aws route53 change-resource-record-sets \
  --hosted-zone-id Z02057713AMAS6GXTEGNR \
  --change-batch file://api-dns-record.json
```

**DNS Record JSON (api-dns-record.json):**
```json
{
  "Changes": [
    {
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "api.asoba.co",
        "Type": "A",
        "AliasTarget": {
          "DNSName": "TARGET_DOMAIN_PLACEHOLDER",
          "EvaluateTargetHealth": false,
          "HostedZoneId": "Z1D633PJN98FT9"
        }
      }
    }
  ]
}
```

**Validation Record JSON (validation-record.json):**
```json
{
  "Changes": [
    {
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "_validation_record_name_from_acm",
        "Type": "CNAME",
        "TTL": 300,
        "ResourceRecords": [
          {
            "Value": "_validation_record_value_from_acm"
          }
        ]
      }
    }
  ]
}
```

**Step 6: Verify Setup**
```bash
# Test the endpoint
curl -I https://api.asoba.co/forecast

# Check certificate status
aws acm describe-certificate --certificate-arn $CERT_ARN --query 'Status'

# Verify DNS resolution
dig api.asoba.co @8.8.8.8
```

### 5. For Each New Service

1. **Create the Lambda** with standard naming
2. **Set log retention** to 30 days
3. **Tag everything** with the 5 standard tags
4. **Add to API Gateway** as a new resource
5. **Test the endpoint** at api.asoba.co/{serviceName}

### 6. Cost Tracking Setup

```bash
# Enable cost allocation tags in billing console
# Go to: Billing → Cost allocation tags → Activate:
# - Project
# - Environment  
# - Service
# - CostCenter
# - Owner

# Create a budget
aws budgets create-budget \
  --account-id ${ACCOUNT_ID} \
  --budget file://budget.json
```

Budget file:
```json
{
  "BudgetName": "ona-platform-prod",
  "BudgetLimit": {
    "Amount": "1000",
    "Unit": "USD"
  },
  "TimeUnit": "MONTHLY",
  "BudgetType": "COST",
  "CostFilters": {
    "TagKeyValue": ["Project$ona-platform"]
  }
}
```

### 7. Deployment Checklist for Each Service

**Infrastructure Setup:**
- [ ] ECR repository created for Docker images
- [ ] IAM role created with proper trust policy
- [ ] IAM policies attached (S3, DynamoDB, CloudWatch)
- [ ] DynamoDB tables created (locations, weather-cache)
- [ ] S3 buckets created and tagged
- [ ] Lambda created with Docker image
- [ ] CloudWatch logs retention set to 30 days
- [ ] Log group tagged

**Event Triggers (if applicable):**
- [ ] S3 event notifications configured (for interpolationService)
- [ ] EventBridge rules created (for scheduled services)
- [ ] Lambda permissions added for S3/EventBridge
- [ ] Test event triggers working

**API Gateway Integration:**
- [ ] Added to API Gateway as resource
- [ ] HTTP method created (GET/POST)
- [ ] Lambda integration configured
- [ ] API Gateway permissions added
- [ ] Endpoint works at `api.asoba.co/{serviceName}`

**Verification:**
- [ ] All 5 tags applied to all resources
- [ ] Environment variables set correctly
- [ ] Lambda can access required S3 buckets
- [ ] Lambda can access DynamoDB tables
- [ ] Shows up in cost allocation reports
- [ ] Test upload triggers interpolationService
- [ ] Test scheduled weatherCache execution

### 8. Parameter Store Setup (CRITICAL MISSING COMPONENT)

**Create scripts/02-create-parameters.sh:**
```bash
#!/bin/bash
# scripts/02-create-parameters.sh

set -euo pipefail

echo "Creating SSM Parameters for ONA Platform..."

# Create all required parameters
aws ssm put-parameter \
  --name /ona-platform/prod/visual-crossing-api-key \
  --value "YOUR_ACTUAL_API_KEY" \
  --type SecureString \
  --description "Visual Crossing Weather API Key" \
  --tags Key=Project,Value=ona-platform Key=Environment,Value=prod Key=Service,Value=weatherCache \
  --region af-south-1 || echo "Parameter already exists"

aws ssm put-parameter \
  --name /ona-platform/prod/sagemaker-execution-role \
  --value "arn:aws:iam::${ACCOUNT_ID}:role/ona-sagemaker-execution-role" \
  --type String \
  --description "SageMaker execution role for model training" \
  --tags Key=Project,Value=ona-platform Key=Environment,Value=prod Key=Service,Value=globalTrainingService \
  --region af-south-1 || echo "Parameter already exists"

aws ssm put-parameter \
  --name /ona-platform/prod/model-bucket-name \
  --value "ona-platform-models" \
  --type String \
  --description "S3 bucket for storing ML models" \
  --tags Key=Project,Value=ona-platform Key=Environment,Value=prod Key=Service,Value=forecastingApi \
  --region af-south-1 || echo "Parameter already exists"

aws ssm put-parameter \
  --name /ona-platform/prod/sns-alert-topic \
  --value "arn:aws:sns:af-south-1:${ACCOUNT_ID}:ona-platform-alerts" \
  --type String \
  --description "SNS topic for alert notifications" \
  --tags Key=Project,Value=ona-platform Key=Environment,Value=prod Key=Service,Value=alertService \
  --region af-south-1 || echo "Parameter already exists"

aws ssm put-parameter \
  --name /ona-platform/prod/log-level \
  --value "INFO" \
  --type String \
  --description "Default log level for all services" \
  --tags Key=Project,Value=ona-platform Key=Environment,Value=prod Key=Service,Value=shared \
  --region af-south-1 || echo "Parameter already exists"

aws ssm put-parameter \
  --name /ona-platform/prod/environment \
  --value "prod" \
  --type String \
  --description "Environment identifier" \
  --tags Key=Project,Value=ona-platform Key=Environment,Value=prod Key=Service,Value=shared \
  --region af-south-1 || echo "Parameter already exists"

echo "SSM Parameters created successfully!"
```

### 9. Complete IAM Policies for All Services

**Create scripts/03-create-iam.sh:**
```bash
#!/bin/bash
# scripts/03-create-iam.sh

set -euo pipefail

echo "Creating IAM roles and policies for all services..."

# Create trust policy for Lambda
cat > lambda-trust-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

# Create SageMaker trust policy
cat > sagemaker-trust-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "sagemaker.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

# Create IAM policies for each service
create_service_policy() {
    local service=$1
    local permissions=$2
    
    cat > ${service}-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:*:*:*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "ssm:GetParameter",
        "ssm:GetParameters"
      ],
      "Resource": "arn:aws:ssm:*:*:parameter/ona-platform/*"
    },
    ${permissions}
  ]
}
EOF
}

# Define service-specific permissions
create_service_policy "weatherCache" '{
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject"
      ],
      "Resource": [
        "arn:aws:s3:::sa-api-client-input/*",
        "arn:aws:s3:::sa-api-client-output/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:Query"
      ],
      "Resource": "arn:aws:dynamodb:*:*:table/ona-platform-locations"
    }'

create_service_policy "interpolationService" '{
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": [
        "arn:aws:s3:::sa-api-client-input/*",
        "arn:aws:s3:::sa-api-client-output/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:Query",
        "dynamodb:Scan"
      ],
      "Resource": "arn:aws:dynamodb:*:*:table/ona-platform-locations"
    }'

create_service_policy "globalTrainingService" '{
      "Effect": "Allow",
      "Action": [
        "sagemaker:CreateTrainingJob",
        "sagemaker:DescribeTrainingJob",
        "sagemaker:StopTrainingJob",
        "sagemaker:CreateModel",
        "sagemaker:DescribeModel"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::ona-platform-models/*",
        "arn:aws:s3:::ona-platform-models"
      ]
    }'

create_service_policy "forecastingApi" '{
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::ona-platform-models/*",
        "arn:aws:s3:::ona-platform-models"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:Query"
      ],
      "Resource": "arn:aws:dynamodb:*:*:table/ona-platform-locations"
    }'

create_service_policy "alertService" '{
      "Effect": "Allow",
      "Action": [
        "sns:Publish",
        "sns:GetTopicAttributes"
      ],
      "Resource": "arn:aws:sns:*:*:ona-platform-alerts"
    },
    {
      "Effect": "Allow",
      "Action": [
        "cloudwatch:GetMetricStatistics",
        "cloudwatch:ListMetrics"
      ],
      "Resource": "*"
    }'

create_service_policy "dataIngestion" '{
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::sa-api-client-input/*",
        "arn:aws:s3:::sa-api-client-input"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:PutItem",
        "dynamodb:UpdateItem"
      ],
      "Resource": "arn:aws:dynamodb:*:*:table/ona-platform-locations"
    }'

create_service_policy "modelTraining" '{
      "Effect": "Allow",
      "Action": [
        "sagemaker:CreateTrainingJob",
        "sagemaker:DescribeTrainingJob",
        "sagemaker:StopTrainingJob"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject"
      ],
      "Resource": [
        "arn:aws:s3:::ona-platform-models/*",
        "arn:aws:s3:::sa-api-client-input/*"
      ]
    }'

create_service_policy "predictionEngine" '{
      "Effect": "Allow",
      "Action": [
        "s3:GetObject"
      ],
      "Resource": "arn:aws:s3:::ona-platform-models/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:Query"
      ],
      "Resource": "arn:aws:dynamodb:*:*:table/ona-platform-locations"
    }'

create_service_policy "dataValidation" '{
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject"
      ],
      "Resource": [
        "arn:aws:s3:::sa-api-client-input/*",
        "arn:aws:s3:::sa-api-client-output/*"
      ]
    }'

create_service_policy "reportGeneration" '{
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject"
      ],
      "Resource": [
        "arn:aws:s3:::sa-api-client-output/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:Scan",
        "dynamodb:Query"
      ],
      "Resource": "arn:aws:dynamodb:*:*:table/ona-platform-locations"
    }'

create_service_policy "systemHealth" '{
      "Effect": "Allow",
      "Action": [
        "cloudwatch:GetMetricStatistics",
        "cloudwatch:ListMetrics",
        "cloudwatch:DescribeAlarms"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "lambda:ListFunctions",
        "lambda:GetFunction"
      ],
      "Resource": "*"
    }'

# Create IAM roles for all services
SERVICES=("weatherCache" "interpolationService" "globalTrainingService" "forecastingApi" "dataIngestion" "modelTraining" "predictionEngine" "alertService" "dataValidation" "reportGeneration" "systemHealth")

for SERVICE in "${SERVICES[@]}"; do
    echo "Creating IAM role for ${SERVICE}..."
    
    # Create role
    aws iam create-role \
      --role-name ona-lambda-${SERVICE}-role \
      --assume-role-policy-document file://lambda-trust-policy.json \
      --tags Key=Project,Value=ona-platform Key=Environment,Value=prod Key=Service,Value=${SERVICE} \
      --region af-south-1 || echo "Role already exists"
    
    # Attach policy
    aws iam put-role-policy \
      --role-name ona-lambda-${SERVICE}-role \
      --policy-name ${SERVICE}Policy \
      --policy-document file://${SERVICE}-policy.json \
      --region af-south-1
done

# Create SageMaker execution role
aws iam create-role \
  --role-name ona-sagemaker-execution-role \
  --assume-role-policy-document file://sagemaker-trust-policy.json \
  --tags Key=Project,Value=ona-platform Key=Environment,Value=prod Key=Service,Value=sagemaker \
  --region af-south-1 || echo "SageMaker role already exists"

# Attach SageMaker execution policy
aws iam attach-role-policy \
  --role-name ona-sagemaker-execution-role \
  --policy-arn arn:aws:iam::aws:policy/AmazonSageMakerFullAccess \
  --region af-south-1

echo "IAM roles and policies created successfully!"
```

### 10. Directory Structure Setup

**Create scripts/01-setup-directories.sh:**
```bash
#!/bin/bash
# scripts/01-setup-directories.sh

set -euo pipefail

echo "Creating directory structure for ONA Platform..."

# Create main service directories
mkdir -p {base,weatherCache,interpolationService,globalTrainingService,forecastingApi,dataIngestion,modelTraining,predictionEngine,alertService,dataValidation,reportGeneration,systemHealth}/

# Create base utilities directory
mkdir -p base/utils

# Create models directory for interpolation service
mkdir -p interpolationService/models

# Create utils directory for forecasting API
mkdir -p forecastingApi/utils

# Create tests directory
mkdir -p tests

# Create scripts directory
mkdir -p scripts

# Create config directory
mkdir -p config

# Create sample app.py files for all services
create_service_app() {
    local service=$1
    local description=$2
    
    cat > ${service}/app.py << EOF
import json
import boto3
import os
from aws_lambda_powertools import Metrics
from aws_lambda_powertools.metrics import MetricUnit

metrics = Metrics(namespace="OnaPlatform", service="${service}")

@metrics.log_metrics
def lambda_handler(event, context):
    """
    Docker Lambda handler for ${description}
    """
    try:
        # TODO: Implement ${service} logic
        print(f"Processing ${service} request...")
        
        # Example environment variable access
        environment = os.environ.get('ENVIRONMENT', 'dev')
        log_level = os.environ.get('LOG_LEVEL', 'INFO')
        
        metrics.add_metric(name="RequestsProcessed", unit=MetricUnit.Count, value=1)
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': '${service} processed successfully',
                'service': '${service}',
                'environment': environment,
                'timestamp': context.aws_request_id
            })
        }
        
    except Exception as e:
        print(f"Error in ${service}: {str(e)}")
        metrics.add_metric(name="Errors", unit=MetricUnit.Count, value=1)
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }
EOF
}

# Create app.py for each service
create_service_app "weatherCache" "weather data caching and updates"
create_service_app "interpolationService" "ML-based data interpolation with weather enrichment"
create_service_app "globalTrainingService" "global model training orchestration"
create_service_app "forecastingApi" "solar forecasting API endpoints"
create_service_app "dataIngestion" "data ingestion and preprocessing"
create_service_app "modelTraining" "individual model training jobs"
create_service_app "predictionEngine" "real-time prediction engine"
create_service_app "alertService" "alert generation and notification"
create_service_app "dataValidation" "data quality validation"
create_service_app "reportGeneration" "report generation and export"
create_service_app "systemHealth" "system health monitoring"

# Create requirements files for each service
create_requirements() {
    local service=$1
    local extra_deps=$2
    
    cat > ${service}/requirements.txt << EOF
# Base dependencies
boto3==1.28.0
aws-lambda-powertools==2.25.0
pandas==2.0.3
numpy==1.24.3
requests==2.31.0
python-dateutil==2.8.2
pytz==2023.3

# Service-specific dependencies
${extra_deps}
EOF
}

# Create requirements files
create_requirements "weatherCache" "aiohttp==3.8.5\nasyncio==3.4.3"
create_requirements "interpolationService" "lightgbm==3.3.5\nxgboost==1.7.6\njoblib==1.3.1\nscikit-learn==1.3.0"
create_requirements "globalTrainingService" "sagemaker==2.150.0\nscikit-learn==1.3.0"
create_requirements "forecastingApi" "tensorflow-lite==2.13.0\nonnxruntime==1.15.1"
create_requirements "dataIngestion" "pandas==2.0.3\nnumpy==1.24.3"
create_requirements "modelTraining" "sagemaker==2.150.0\nscikit-learn==1.3.0\nlightgbm==3.3.5"
create_requirements "predictionEngine" "tensorflow-lite==2.13.0\nonnxruntime==1.15.1"
create_requirements "alertService" "boto3==1.28.0"
create_requirements "dataValidation" "pandas==2.0.3\nnumpy==1.24.3"
create_requirements "reportGeneration" "pandas==2.0.3\nmatplotlib==3.7.2"
create_requirements "systemHealth" "boto3==1.28.0"

# Create Dockerfiles for each service
create_dockerfile() {
    local service=$1
    local extra_install=$2
    
    cat > ${service}/Dockerfile << EOF
FROM \${AWS_ACCOUNT_ID}.dkr.ecr.\${AWS_REGION}.amazonaws.com/ona-base:latest

# Install service-specific dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy function code
COPY app.py \${LAMBDA_TASK_ROOT}/
EOF

    if [ -n "$extra_install" ]; then
        echo "$extra_install" >> ${service}/Dockerfile
    fi
    
    echo "CMD [ \"app.lambda_handler\" ]" >> ${service}/Dockerfile
}

# Create Dockerfiles
create_dockerfile "weatherCache" ""
create_dockerfile "interpolationService" "COPY models/ \${LAMBDA_TASK_ROOT}/models/"
create_dockerfile "globalTrainingService" ""
create_dockerfile "forecastingApi" "COPY utils/ \${LAMBDA_TASK_ROOT}/utils/"
create_dockerfile "dataIngestion" ""
create_dockerfile "modelTraining" ""
create_dockerfile "predictionEngine" ""
create_dockerfile "alertService" ""
create_dockerfile "dataValidation" ""
create_dockerfile "reportGeneration" ""
create_dockerfile "systemHealth" ""

echo "Directory structure created successfully!"
echo "Created:"
echo "  - 11 service directories with app.py files"
echo "  - Requirements files for each service"
echo "  - Dockerfiles for each service"
echo "  - Base utilities directory"
echo "  - Tests and scripts directories"
```

### 11. Error Handling Infrastructure

**Create scripts/04-create-error-handling.sh:**
```bash
#!/bin/bash
# scripts/04-create-error-handling.sh

set -euo pipefail

echo "Creating error handling infrastructure..."

# Create Dead Letter Queues for each service
SERVICES=("weatherCache" "interpolationService" "globalTrainingService" "forecastingApi" "dataIngestion" "modelTraining" "predictionEngine" "alertService" "dataValidation" "reportGeneration" "systemHealth")

for SERVICE in "${SERVICES[@]}"; do
    echo "Creating DLQ for ${SERVICE}..."
    
    aws sqs create-queue \
      --queue-name ona-${SERVICE}-dlq \
      --attributes MessageRetentionPeriod=1209600 \
      --tags Key=Project,Value=ona-platform Key=Environment,Value=prod Key=Service,Value=${SERVICE} \
      --region af-south-1 || echo "DLQ already exists"
done

# Create CloudWatch Alarms for error rates
create_error_alarm() {
    local service=$1
    
    aws cloudwatch put-metric-alarm \
      --alarm-name "ona-${service}-error-rate" \
      --alarm-description "High error rate for ${service}" \
      --metric-name Errors \
      --namespace AWS/Lambda \
      --statistic Sum \
      --period 300 \
      --threshold 5 \
      --comparison-operator GreaterThanThreshold \
      --evaluation-periods 2 \
      --alarm-actions "arn:aws:sns:af-south-1:${ACCOUNT_ID}:ona-platform-alerts" \
      --dimensions Name=FunctionName,Value=ona-${service}-prod \
      --tags Key=Project,Value=ona-platform Key=Environment,Value=prod Key=Service,Value=${service} \
      --region af-south-1 || echo "Alarm already exists"
}

# Create error alarms for all services
for SERVICE in "${SERVICES[@]}"; do
    create_error_alarm "${SERVICE}"
done

# Create SNS topic for alerts
aws sns create-topic \
  --name ona-platform-alerts \
  --tags Key=Project,Value=ona-platform Key=Environment,Value=prod Key=Service,Value=alerts \
  --region af-south-1 || echo "SNS topic already exists"

echo "Error handling infrastructure created successfully!"
```

### 12. Master Deployment Script

**Create deploy-ona-platform.sh:**
```bash
#!/bin/bash
# deploy-ona-platform.sh - Master deployment script

set -euo pipefail

# Configuration
export AWS_REGION="af-south-1"
export ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export PROJECT_NAME="ona-platform"
export ENVIRONMENT="prod"

echo "=========================================="
echo "Deploying ONA Platform"
echo "Account: ${ACCOUNT_ID}"
echo "Region: ${AWS_REGION}"
echo "Environment: ${ENVIRONMENT}"
echo "=========================================="

# Function to check prerequisites
check_prerequisites() {
    echo "Checking prerequisites..."
    
    # Check AWS CLI
    if ! command -v aws &> /dev/null; then
        echo "ERROR: AWS CLI not found"
        exit 1
    fi
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        echo "ERROR: Docker not found"
        exit 1
    fi
    
    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        echo "ERROR: AWS credentials not configured"
        exit 1
    fi
    
    echo "✓ Prerequisites check passed"
}

# Function to run script with error handling
run_script() {
    local script_name=$1
    local description=$2
    
    echo ""
    echo "Step: ${description}"
    echo "Running: ${script_name}"
    echo "----------------------------------------"
    
    if [ -f "${script_name}" ]; then
        chmod +x "${script_name}"
        if ./"${script_name}"; then
            echo "✓ ${description} completed successfully"
        else
            echo "✗ ${description} failed"
            exit 1
        fi
    else
        echo "✗ Script ${script_name} not found"
        exit 1
    fi
}

# Main deployment flow
main() {
    # Step 1: Prerequisites
    check_prerequisites
    
    # Step 2: Setup directories
    run_script "scripts/01-setup-directories.sh" "Directory Structure Setup"
    
    # Step 3: Create Parameters
    run_script "scripts/02-create-parameters.sh" "Parameter Store Setup"
    
    # Step 4: Create IAM Roles and Policies
    run_script "scripts/03-create-iam.sh" "IAM Roles and Policies"
    
    # Step 5: Create Error Handling Infrastructure
    run_script "scripts/04-create-error-handling.sh" "Error Handling Infrastructure"
    
    # Step 6: Create Storage (S3, DynamoDB)
    run_script "scripts/05-create-storage.sh" "Storage Infrastructure"
    
    # Step 7: Build and Push Docker Images
    run_script "scripts/06-build-docker.sh" "Docker Image Build and Push"
    
    # Step 8: Create Lambda Functions
    run_script "scripts/07-create-lambdas.sh" "Lambda Functions Creation"
    
    # Step 9: Configure Event Triggers
    run_script "scripts/08-configure-triggers.sh" "Event Triggers Configuration"
    
    # Step 10: Setup API Gateway
    run_script "scripts/09-setup-api-gateway.sh" "API Gateway Setup"
    
    # Step 11: Configure DNS
    run_script "scripts/10-configure-dns.sh" "DNS Configuration"
    
    # Step 12: Run Tests
    run_script "scripts/11-run-tests.sh" "Deployment Tests"
    
    echo ""
    echo "=========================================="
    echo "🎉 Deployment completed successfully!"
    echo "=========================================="
    echo ""
    echo "API Endpoints:"
    echo "  https://api.asoba.co/forecast"
    echo "  https://api.asoba.co/weatherCache"
    echo "  https://api.asoba.co/nowcasting"
    echo "  https://api.asoba.co/interpolation"
    echo "  https://api.asoba.co/training"
    echo "  https://api.asoba.co/prediction"
    echo "  https://api.asoba.co/ingestion"
    echo "  https://api.asoba.co/alerts"
    echo "  https://api.asoba.co/validation"
    echo "  https://api.asoba.co/reports"
    echo "  https://api.asoba.co/health"
    echo ""
}

# Run main function
main "$@"
```

### 13. Service Configuration File

**Create services.yaml:**
```yaml
# services.yaml - Service configuration for ONA Platform
services:
  weatherCache:
    memory: 512
    timeout: 300
    schedule: "rate(15 minutes)"
    environment:
      LOG_LEVEL: INFO
      SERVICE_NAME: weatherCache
    secrets:
      - /ona-platform/prod/visual-crossing-api-key
    iam_permissions:
      - s3:GetObject
      - s3:PutObject
      - dynamodb:GetItem
      - dynamodb:PutItem
      - dynamodb:Query
      - ssm:GetParameter
    
  interpolationService:
    memory: 3008
    timeout: 900
    s3_triggers:
      - prefix: "historical/"
      - prefix: "nowcast/"
    environment:
      LOG_LEVEL: INFO
      SERVICE_NAME: interpolationService
    iam_permissions:
      - s3:GetObject
      - s3:PutObject
      - s3:DeleteObject
      - dynamodb:Query
      - dynamodb:Scan
      - ssm:GetParameter
    
  globalTrainingService:
    memory: 1024
    timeout: 300
    environment:
      LOG_LEVEL: INFO
      SERVICE_NAME: globalTrainingService
    iam_permissions:
      - sagemaker:CreateTrainingJob
      - sagemaker:DescribeTrainingJob
      - sagemaker:StopTrainingJob
      - sagemaker:CreateModel
      - sagemaker:DescribeModel
      - s3:GetObject
      - s3:PutObject
      - s3:ListBucket
      - ssm:GetParameter
    
  forecastingApi:
    memory: 3008
    timeout: 60
    environment:
      LOG_LEVEL: INFO
      SERVICE_NAME: forecastingApi
    iam_permissions:
      - s3:GetObject
      - s3:ListBucket
      - dynamodb:GetItem
      - dynamodb:Query
      - ssm:GetParameter
    
  dataIngestion:
    memory: 1024
    timeout: 300
    schedule: "cron(0 2 * * ? *)"
    environment:
      LOG_LEVEL: INFO
      SERVICE_NAME: dataIngestion
    iam_permissions:
      - s3:GetObject
      - s3:PutObject
      - s3:ListBucket
      - dynamodb:PutItem
      - dynamodb:UpdateItem
      - ssm:GetParameter
    
  modelTraining:
    memory: 3008
    timeout: 900
    environment:
      LOG_LEVEL: INFO
      SERVICE_NAME: modelTraining
    iam_permissions:
      - sagemaker:CreateTrainingJob
      - sagemaker:DescribeTrainingJob
      - sagemaker:StopTrainingJob
      - s3:GetObject
      - s3:PutObject
      - ssm:GetParameter
    
  predictionEngine:
    memory: 2048
    timeout: 60
    environment:
      LOG_LEVEL: INFO
      SERVICE_NAME: predictionEngine
    iam_permissions:
      - s3:GetObject
      - dynamodb:GetItem
      - dynamodb:Query
      - ssm:GetParameter
    
  alertService:
    memory: 512
    timeout: 60
    environment:
      LOG_LEVEL: INFO
      SERVICE_NAME: alertService
    iam_permissions:
      - sns:Publish
      - sns:GetTopicAttributes
      - cloudwatch:GetMetricStatistics
      - cloudwatch:ListMetrics
      - ssm:GetParameter
    
  dataValidation:
    memory: 1024
    timeout: 300
    environment:
      LOG_LEVEL: INFO
      SERVICE_NAME: dataValidation
    iam_permissions:
      - s3:GetObject
      - s3:PutObject
      - ssm:GetParameter
    
  reportGeneration:
    memory: 1024
    timeout: 300
    environment:
      LOG_LEVEL: INFO
      SERVICE_NAME: reportGeneration
    iam_permissions:
      - s3:GetObject
      - s3:PutObject
      - dynamodb:Scan
      - dynamodb:Query
      - ssm:GetParameter
    
  systemHealth:
    memory: 512
    timeout: 60
    schedule: "rate(5 minutes)"
    environment:
      LOG_LEVEL: INFO
      SERVICE_NAME: systemHealth
    iam_permissions:
      - cloudwatch:GetMetricStatistics
      - cloudwatch:ListMetrics
      - cloudwatch:DescribeAlarms
      - lambda:ListFunctions
      - lambda:GetFunction
      - ssm:GetParameter

# Global configuration
global:
  region: af-south-1
  environment: prod
  project: ona-platform
  tags:
    Project: ona-platform
    Environment: prod
    Owner: engineering
    CostCenter: solar-forecasting
```

### 14. Rollback Script

**Create rollback.sh:**
```bash
#!/bin/bash
# rollback.sh - Rollback script for failed deployments

set -euo pipefail

echo "=========================================="
echo "ONA Platform Rollback Script"
echo "=========================================="

# Configuration
export AWS_REGION="af-south-1"
export ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# Function to rollback Lambda functions
rollback_lambdas() {
    echo "Rolling back Lambda functions..."
    
    SERVICES=("weatherCache" "interpolationService" "globalTrainingService" "forecastingApi" "dataIngestion" "modelTraining" "predictionEngine" "alertService" "dataValidation" "reportGeneration" "systemHealth")
    
    for SERVICE in "${SERVICES[@]}"; do
        echo "Rolling back ${SERVICE}..."
        
        # Get previous version
        PREVIOUS_VERSION=$(aws lambda list-versions-by-function \
            --function-name ona-${SERVICE}-prod \
            --query 'Versions[-2].Version' \
            --output text \
            --region ${AWS_REGION} 2>/dev/null || echo "1")
        
        if [ "$PREVIOUS_VERSION" != "1" ]; then
            # Update alias to previous version
            aws lambda update-alias \
                --function-name ona-${SERVICE}-prod \
                --name prod \
                --function-version ${PREVIOUS_VERSION} \
                --region ${AWS_REGION} || echo "No alias found for ${SERVICE}"
        fi
    done
}

# Function to rollback API Gateway
rollback_api_gateway() {
    echo "Rolling back API Gateway..."
    
    # Get API ID
    API_ID=$(aws apigateway get-rest-apis \
        --query 'items[?name==`ona-api-prod`].id' \
        --output text \
        --region ${AWS_REGION})
    
    if [ -n "$API_ID" ]; then
        # Get previous deployment
        PREVIOUS_DEPLOYMENT=$(aws apigateway get-deployments \
            --rest-api-id ${API_ID} \
            --query 'items[-2].id' \
            --output text \
            --region ${AWS_REGION} 2>/dev/null || echo "")
        
        if [ -n "$PREVIOUS_DEPLOYMENT" ]; then
            # Update stage to previous deployment
            aws apigateway update-stage \
                --rest-api-id ${API_ID} \
                --stage-name prod \
                --patch-ops op=replace,path=/deploymentId,value=${PREVIOUS_DEPLOYMENT} \
                --region ${AWS_REGION}
        fi
    fi
}

# Function to rollback Docker images
rollback_docker_images() {
    echo "Rolling back Docker images..."
    
    SERVICES=("weatherCache" "interpolationService" "globalTrainingService" "forecastingApi" "dataIngestion" "modelTraining" "predictionEngine" "alertService" "dataValidation" "reportGeneration" "systemHealth")
    
    for SERVICE in "${SERVICES[@]}"; do
        echo "Rolling back ${SERVICE} image..."
        
        # Get previous image tag
        PREVIOUS_TAG=$(aws ecr describe-images \
            --repository-name ona-${SERVICE} \
            --query 'imageDetails[-2].imageTags[0]' \
            --output text \
            --region ${AWS_REGION} 2>/dev/null || echo "latest")
        
        if [ "$PREVIOUS_TAG" != "latest" ]; then
            # Update Lambda function to use previous image
            aws lambda update-function-code \
                --function-name ona-${SERVICE}-prod \
                --image-uri ${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/ona-${SERVICE}:${PREVIOUS_TAG} \
                --region ${AWS_REGION}
        fi
    done
}

# Function to clean up failed resources
cleanup_failed_resources() {
    echo "Cleaning up failed resources..."
    
    # Delete any failed Lambda functions
    SERVICES=("weatherCache" "interpolationService" "globalTrainingService" "forecastingApi" "dataIngestion" "modelTraining" "predictionEngine" "alertService" "dataValidation" "reportGeneration" "systemHealth")
    
    for SERVICE in "${SERVICES[@]}"; do
        # Check if function exists and is in failed state
        FUNCTION_STATE=$(aws lambda get-function \
            --function-name ona-${SERVICE}-prod \
            --query 'Configuration.State' \
            --output text \
            --region ${AWS_REGION} 2>/dev/null || echo "NotFound")
        
        if [ "$FUNCTION_STATE" = "Failed" ]; then
            echo "Deleting failed function: ${SERVICE}"
            aws lambda delete-function \
                --function-name ona-${SERVICE}-prod \
                --region ${AWS_REGION}
        fi
    done
}

# Main rollback function
main() {
    echo "Starting rollback process..."
    
    # Ask for confirmation
    read -p "Are you sure you want to rollback the deployment? (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
        echo "Rollback cancelled"
        exit 0
    fi
    
    # Execute rollback steps
    rollback_lambdas
    rollback_api_gateway
    rollback_docker_images
    cleanup_failed_resources
    
    echo ""
    echo "=========================================="
    echo "✓ Rollback completed successfully!"
    echo "=========================================="
    echo ""
    echo "Please verify the following:"
    echo "  1. Lambda functions are working correctly"
    echo "  2. API endpoints are responding"
    echo "  3. No error metrics in CloudWatch"
    echo ""
}

# Run main function
main "$@"
```

### 15. Environment-Specific Configurations

**Create config/prod.env:**
```bash
# config/prod.env - Production environment configuration

# AWS Configuration
AWS_REGION=af-south-1
AWS_ACCOUNT_ID=${ACCOUNT_ID}

# S3 Buckets
S3_INPUT_BUCKET=sa-api-client-input
S3_OUTPUT_BUCKET=sa-api-client-output
S3_MODELS_BUCKET=ona-platform-models

# DynamoDB Tables
DYNAMODB_TABLE=ona-platform-locations
DYNAMODB_WEATHER_CACHE_TABLE=ona-platform-weather-cache

# API Gateway
API_GATEWAY_NAME=ona-api-prod
API_GATEWAY_STAGE=prod
API_DOMAIN=api.asoba.co

# SNS Topics
SNS_ALERT_TOPIC=ona-platform-alerts

# Logging
LOG_LEVEL=INFO
LOG_RETENTION_DAYS=30

# Service Configuration
WEATHER_CACHE_SCHEDULE="rate(15 minutes)"
DATA_INGESTION_SCHEDULE="cron(0 2 * * ? *)"
SYSTEM_HEALTH_SCHEDULE="rate(5 minutes)"

# External APIs
VISUAL_CROSSING_API_KEY_PARAM=/ona-platform/prod/visual-crossing-api-key

# Monitoring
CLOUDWATCH_NAMESPACE=OnaPlatform
ALARM_THRESHOLD_ERRORS=5
ALARM_THRESHOLD_DURATION=300
```

**Create config/dev.env:**
```bash
# config/dev.env - Development environment configuration

# AWS Configuration
AWS_REGION=af-south-1
AWS_ACCOUNT_ID=${ACCOUNT_ID}

# S3 Buckets
S3_INPUT_BUCKET=sa-api-client-input-dev
S3_OUTPUT_BUCKET=sa-api-client-output-dev
S3_MODELS_BUCKET=ona-platform-models-dev

# DynamoDB Tables
DYNAMODB_TABLE=ona-platform-locations-dev
DYNAMODB_WEATHER_CACHE_TABLE=ona-platform-weather-cache-dev

# API Gateway
API_GATEWAY_NAME=ona-api-dev
API_GATEWAY_STAGE=dev
API_DOMAIN=api-dev.asoba.co

# SNS Topics
SNS_ALERT_TOPIC=ona-platform-alerts-dev

# Logging
LOG_LEVEL=DEBUG
LOG_RETENTION_DAYS=7

# Service Configuration
WEATHER_CACHE_SCHEDULE="rate(1 hour)"
DATA_INGESTION_SCHEDULE="cron(0 2 * * ? *)"
SYSTEM_HEALTH_SCHEDULE="rate(15 minutes)"

# External APIs
VISUAL_CROSSING_API_KEY_PARAM=/ona-platform/dev/visual-crossing-api-key

# Monitoring
CLOUDWATCH_NAMESPACE=OnaPlatform-Dev
ALARM_THRESHOLD_ERRORS=3
ALARM_THRESHOLD_DURATION=300
```

### 16. Quick Validation Script

```bash
#!/bin/bash
SERVICE=$1  # e.g., "weatherCache"

echo "Checking $SERVICE..."

# Check Lambda exists and is tagged
aws lambda get-function --function-name ona-${SERVICE}-prod --query 'Tags.Project' --output text

# Check logs exist
aws logs describe-log-groups --log-group-name-prefix /aws/lambda/ona-${SERVICE}-prod

# Check API endpoint
curl -I https://api.asoba.co/${SERVICE}

echo "Done!"
```

### 17. Complete Deployment Checklist

**Infrastructure Setup:**
- [ ] Directory structure created (`scripts/01-setup-directories.sh`)
- [ ] SSM Parameters created (`scripts/02-create-parameters.sh`)
- [ ] IAM roles and policies created (`scripts/03-create-iam.sh`)
- [ ] Error handling infrastructure created (`scripts/04-create-error-handling.sh`)
- [ ] ECR repositories created for all services
- [ ] DynamoDB tables created (locations, weather-cache)
- [ ] S3 buckets created and tagged
- [ ] Dead Letter Queues created for all services
- [ ] CloudWatch alarms created for error monitoring
- [ ] SNS topic created for alerts

**Docker and Lambda:**
- [ ] Base Docker image built and pushed
- [ ] Service-specific Docker images built and pushed
- [ ] Lambda functions created with Docker images
- [ ] CloudWatch logs retention set to 30 days
- [ ] Log groups tagged with standard tags

**Event Triggers:**
- [ ] S3 event notifications configured (for interpolationService)
- [ ] EventBridge rules created (for scheduled services)
- [ ] Lambda permissions added for S3/EventBridge
- [ ] Test event triggers working

**API Gateway Integration:**
- [ ] API Gateway created with custom domain
- [ ] SSL certificate requested and validated
- [ ] All services added as API Gateway resources
- [ ] HTTP methods created (GET/POST)
- [ ] Lambda integrations configured
- [ ] API Gateway permissions added
- [ ] DNS records created for custom domain
- [ ] All endpoints working at `api.asoba.co/{serviceName}`

**Verification:**
- [ ] All 5 tags applied to all resources
- [ ] Environment variables set correctly from Parameter Store
- [ ] Lambda functions can access required S3 buckets
- [ ] Lambda functions can access DynamoDB tables
- [ ] Lambda functions can access SSM parameters
- [ ] Shows up in cost allocation reports
- [ ] Test upload triggers interpolationService
- [ ] Test scheduled weatherCache execution
- [ ] Error monitoring and alerting working
- [ ] Rollback script tested and functional

That's it. Complete, automated, trackable, and rollback-capable.