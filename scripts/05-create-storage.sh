#!/usr/bin/env bash
# 05-create-storage.sh - Ensure S3 and DynamoDB resources exist
set -euo pipefail
source config/environment.sh
source lib/cloudwatch-logging.sh

# Initialize script logging
init_script_logging "05-create-storage.sh"

log_info "Ensuring S3 buckets exist: ${INPUT_BUCKET}, ${OUTPUT_BUCKET}"

ensure_bucket() {
  local bucket=$1
  if ! aws s3api head-bucket --bucket "${bucket}" >/dev/null 2>&1; then
    aws s3api create-bucket --bucket "${bucket}" --region "${AWS_REGION}" --create-bucket-configuration LocationConstraint="${AWS_REGION}" 1>/dev/null || true
  fi
}

ensure_bucket "${INPUT_BUCKET}"
ensure_bucket "${OUTPUT_BUCKET}"

log_info "Ensuring DynamoDB tables exist"

ensure_table() {
  local table=$1 key=$2
  if ! aws dynamodb describe-table --table-name "${table}" --region "${AWS_REGION}" >/dev/null 2>&1; then
    aws dynamodb create-table \
      --table-name "${table}" \
      --attribute-definitions AttributeName="${key}",AttributeType=S \
      --key-schema AttributeName="${key}",KeyType=HASH \
      --billing-mode PAY_PER_REQUEST \
      --tags ${STANDARD_TAGS} \
      --region "${AWS_REGION}" 1>/dev/null
    aws dynamodb wait table-exists --table-name "${table}" --region "${AWS_REGION}"
  fi
}

# Locations table: partition key customer_id (example)
ensure_table "${LOCATIONS_TABLE}" "customer_id"
# Weather cache table: partition key location_key (example)
ensure_table "${WEATHER_CACHE_TABLE}" "location_key"

log_success "Storage resources ensured"
log_script_completion "05-create-storage.sh" 0
