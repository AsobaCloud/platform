#!/usr/bin/env bash
# 08-create-lambdas.sh - Create or update Lambda functions from ECR images
set -euo pipefail
source config/environment.sh
source lib/cloudwatch-logging.sh

# Initialize script logging
init_script_logging "08-create-lambdas.sh"

log_info "Creating/Updating Lambda functions"

# Ensure ECR login for image permissions
aws ecr get-login-password --region "${AWS_REGION}" | docker login --username AWS --password-stdin "${ECR_REGISTRY}" >/dev/null 2>&1 || error_exit "Failed to login to ECR"

create_or_update_lambda() {
  local service=$1
  local function_name="$(get_lambda_name "${service}")"
  local image_uri="$(get_ecr_image_uri "${service}")"
  local role_arn="arn:aws:iam::${AWS_ACCOUNT_ID}:role/$(get_lambda_role_name "${service}")"
  local memory=$(get_lambda_memory "${service}")
  local timeout=$(get_lambda_timeout "${service}")

  if aws lambda get-function --function-name "${function_name}" --region "${AWS_REGION}" >/dev/null 2>&1; then
    # Wait for any pending updates
    aws lambda wait function-active-v2 --function-name "${function_name}" --region "${AWS_REGION}" 2>/dev/null || log_warn "Lambda function ${function_name} may not be in active state"
    aws lambda wait function-updated-v2 --function-name "${function_name}" --region "${AWS_REGION}" 2>/dev/null || log_warn "Lambda function ${function_name} may not be in updated state"
    
    # Update code first
    aws lambda update-function-code --function-name "${function_name}" --image-uri "${image_uri}" --region "${AWS_REGION}" 1>/dev/null
    aws lambda wait function-updated-v2 --function-name "${function_name}" --region "${AWS_REGION}" 2>/dev/null || log_warn "Lambda function ${function_name} update may not be complete"
    
    # Then update configuration
    aws lambda update-function-configuration --function-name "${function_name}" --timeout "${timeout}" --memory-size "${memory}" --region "${AWS_REGION}" 1>/dev/null
  else
    aws lambda create-function \
      --function-name "${function_name}" \
      --package-type Image \
      --code ImageUri="${image_uri}" \
      --role "${role_arn}" \
      --architectures x86_64 \
      --timeout "${timeout}" \
      --memory-size "${memory}" \
      --tags Project=ona-platform,Environment=${ENVIRONMENT} \
      --region "${AWS_REGION}" 1>/dev/null
    
    # Wait for function to be active
    echo -n "Waiting for ${function_name} to be active..."
    aws lambda wait function-active --function-name "${function_name}" --region "${AWS_REGION}"
    echo " done"
  fi

  # Wait before updating environment variables
  aws lambda wait function-updated-v2 --function-name "${function_name}" --region "${AWS_REGION}" 2>/dev/null || log_warn "Lambda function ${function_name} may not be ready for environment updates"
  
  # Set environment variables common to all
  aws lambda update-function-configuration \
    --function-name "${function_name}" \
    --environment "Variables={STAGE=${STAGE},ENVIRONMENT=${ENVIRONMENT},INPUT_BUCKET=${INPUT_BUCKET},OUTPUT_BUCKET=${OUTPUT_BUCKET},LOCATIONS_TABLE=${LOCATIONS_TABLE},WEATHER_CACHE_TABLE=${WEATHER_CACHE_TABLE},LOG_LEVEL=INFO}" \
    --region "${AWS_REGION}" 1>/dev/null
  
  aws lambda wait function-updated-v2 --function-name "${function_name}" --region "${AWS_REGION}" 2>/dev/null || log_warn "Lambda function ${function_name} environment update may not be complete"

  # Configure DLQ (optional - may fail if permissions not ready)
  local dlq_arn="arn:aws:sqs:${AWS_REGION}:${AWS_ACCOUNT_ID}:$(get_dlq_name "${service}")"
  if aws lambda update-function-configuration --function-name "${function_name}" --dead-letter-config TargetArn="${dlq_arn}" --region "${AWS_REGION}" 1>/dev/null 2>&1; then
    echo "DLQ configured for ${function_name}"
  else
    echo "Warning: DLQ configuration failed for ${function_name} (permissions may not be ready)"
  fi
}

for service in "${SERVICES[@]}"; do
  create_or_update_lambda "${service}"
done

log_success "Lambdas created/updated"
log_script_completion "08-create-lambdas.sh" 0
