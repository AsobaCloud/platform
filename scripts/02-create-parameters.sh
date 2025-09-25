#!/usr/bin/env bash
# 02-create-parameters.sh - Create SSM parameters needed by services
set -euo pipefail
source config/environment.sh
source lib/cloudwatch-logging.sh

# Initialize script logging
init_script_logging "02-create-parameters.sh"

log_info "Creating SSM parameters"

# Visual Crossing API key via environment variable only (single approach)
if [[ -z "${VISUAL_CROSSING_API_KEY:-}" ]]; then
  log_error "VISUAL_CROSSING_API_KEY is not set."
  log_error "Set it before running deployment, e.g.:"
  log_error "  export VISUAL_CROSSING_API_KEY=YOUR_KEY"
  error_exit "Required environment variable VISUAL_CROSSING_API_KEY not set"
fi
VC_KEY="${VISUAL_CROSSING_API_KEY}"

# Visual Crossing API key (placeholder; user must update)
aws ssm put-parameter \
  --name "/ona-platform/${STAGE}/visual-crossing-api-key" \
  --value "${VC_KEY}" \
  --type SecureString \
  --overwrite \
  --region "${AWS_REGION}" 1>/dev/null

# General environment parameters
aws ssm put-parameter --name "/ona-platform/${STAGE}/environment" --value "${ENVIRONMENT}" --type String --overwrite --region "${AWS_REGION}" 1>/dev/null
aws ssm put-parameter --name "/ona-platform/${STAGE}/log-level" --value "INFO" --type String --overwrite --region "${AWS_REGION}" 1>/dev/null

# SNS alert topic name (created in error-handling step)
aws ssm put-parameter --name "/ona-platform/${STAGE}/sns-alert-topic" --value "arn:aws:sns:${AWS_REGION}:${AWS_ACCOUNT_ID}:ona-platform-alerts" --type String --overwrite --region "${AWS_REGION}" 1>/dev/null

# Model bucket (if used by training/forecasting)
aws ssm put-parameter --name "/ona-platform/${STAGE}/model-bucket-name" --value "${OUTPUT_BUCKET}" --type String --overwrite --region "${AWS_REGION}" 1>/dev/null

# SageMaker execution role ARN placeholder
aws ssm put-parameter --name "/ona-platform/${STAGE}/sagemaker-execution-role" --value "arn:aws:iam::${AWS_ACCOUNT_ID}:role/ona-sagemaker-execution-role" --type String --overwrite --region "${AWS_REGION}" 1>/dev/null

log_success "Parameters created/updated"
log_script_completion "02-create-parameters.sh" 0
