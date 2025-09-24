#!/usr/bin/env bash
# Global environment configuration for ONA Platform deployment
# shellcheck disable=SC2034
set -euo pipefail

# Logging helper
log() {
  echo "[$(date -u +'%Y-%m-%dT%H:%M:%SZ')] $*"
}

# Core config
export AWS_REGION="${AWS_REGION:-af-south-1}"
export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-$AWS_REGION}"
export STAGE="${STAGE:-prod}"
export ENVIRONMENT="${ENVIRONMENT:-$STAGE}"

# Account and registry
export AWS_ACCOUNT_ID="${AWS_ACCOUNT_ID:-$(aws sts get-caller-identity --query Account --output text 2>/dev/null || echo '000000000000')}"
export ECR_REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

# API and domain
export API_NAME="${API_NAME:-ona-api-${STAGE}}"
export API_DOMAIN="${API_DOMAIN:-api.asoba.co}"
# Route53 hosted zone ID for asoba.co (update if different)
export HOSTED_ZONE_ID="${HOSTED_ZONE_ID:-Z02057713AMAS6GXTEGNR}"

# Buckets (existing per doc)
export INPUT_BUCKET="${INPUT_BUCKET:-sa-api-client-input}"
export OUTPUT_BUCKET="${OUTPUT_BUCKET:-sa-api-client-output}"

# DynamoDB tables
export LOCATIONS_TABLE="${LOCATIONS_TABLE:-ona-platform-locations}"
export WEATHER_CACHE_TABLE="${WEATHER_CACHE_TABLE:-ona-platform-weather-cache}"

# Services (single source of truth)
# - dataIngestion: POST /upload_train, POST /upload_nowcast (presigned URLs)
#   memory=1024, timeout=300
# - weatherCache: Scheduled every 15 minutes; updates S3 cache
#   memory=512, timeout=300
# - interpolationService: Processes uploads; enrich + interpolate; writes training/
#   memory=3008, timeout=900
# - globalTrainingService: Trains model from training/ -> saves to output
#   memory=1024, timeout=300
# - forecastingApi: GET /forecast; loads model + nowcast + weather
#   memory=3008, timeout=60
# Edit the SERVICES array below to add/remove services.
# Memory/timeout mappings set in get_lambda_memory/get_lambda_timeout.
SERVICES=(
  dataIngestion
  weatherCache
  interpolationService
  globalTrainingService
  forecastingApi
)
export SERVICES

# Standard tags
STANDARD_TAGS="Key=Project,Value=ona-platform Key=Environment,Value=${ENVIRONMENT}"
STANDARD_TAGS_JSON='[{"Key":"Project","Value":"ona-platform"},{"Key":"Environment","Value":"'"${ENVIRONMENT}"'"}]'
export STANDARD_TAGS STANDARD_TAGS_JSON

# Helpers
get_lambda_memory() {
  case "$1" in
    dataIngestion) echo 1024 ;;
    weatherCache) echo 512 ;;
    interpolationService) echo 3008 ;;
    globalTrainingService) echo 1024 ;;
    forecastingApi) echo 3008 ;;
    *) echo 1024 ;;
  esac
}

get_lambda_timeout() {
  case "$1" in
    dataIngestion) echo 300 ;;
    weatherCache) echo 300 ;;
    interpolationService) echo 900 ;;
    globalTrainingService) echo 300 ;;
    forecastingApi) echo 60 ;;
    *) echo 300 ;;
  esac
}

get_lambda_role_name() { echo "ona-lambda-$1-role"; }
get_dlq_name() { echo "ona-$1-dlq"; }
get_lambda_name() { echo "ona-$1-${STAGE}"; }
get_ecr_repo() {
  local svc="$1"
  # Ensure lowercase for Docker/ECR repository naming rules
  svc="${svc,,}"
  echo "ona-${svc}"
}
get_ecr_image_uri() { echo "${ECR_REGISTRY}/$(get_ecr_repo "$1"):${STAGE}"; }
