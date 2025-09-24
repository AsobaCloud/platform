#!/usr/bin/env bash
# 08-create-lambdas.sh - Create or update Lambda functions from ECR images
set -euo pipefail
source config/environment.sh

echo "Creating/Updating Lambda functions"

# Ensure ECR login for image permissions
aws ecr get-login-password --region "${AWS_REGION}" | docker login --username AWS --password-stdin "${ECR_REGISTRY}" >/dev/null 2>&1 || true

create_or_update_lambda() {
  local service=$1
  local function_name="$(get_lambda_name "${service}")"
  local image_uri="$(get_ecr_image_uri "${service}")"
  local role_arn="arn:aws:iam::${AWS_ACCOUNT_ID}:role/$(get_lambda_role_name "${service}")"
  local memory=$(get_lambda_memory "${service}")
  local timeout=$(get_lambda_timeout "${service}")

  if aws lambda get-function --function-name "${function_name}" --region "${AWS_REGION}" >/dev/null 2>&1; then
    aws lambda update-function-code --function-name "${function_name}" --image-uri "${image_uri}" --region "${AWS_REGION}" 1>/dev/null
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
      --tags ${STANDARD_TAGS} \
      --region "${AWS_REGION}" 1>/dev/null
  fi

  # Set environment variables common to all
  aws lambda update-function-configuration \
    --function-name "${function_name}" \
    --environment "Variables={STAGE=${STAGE},ENVIRONMENT=${ENVIRONMENT},INPUT_BUCKET=${INPUT_BUCKET},OUTPUT_BUCKET=${OUTPUT_BUCKET},LOCATIONS_TABLE=${LOCATIONS_TABLE},WEATHER_CACHE_TABLE=${WEATHER_CACHE_TABLE},LOG_LEVEL=INFO}" \
    --region "${AWS_REGION}" 1>/dev/null

  # Configure DLQ
  local dlq_arn="arn:aws:sqs:${AWS_REGION}:${AWS_ACCOUNT_ID}:$(get_dlq_name "${service}")"
  aws lambda update-function-configuration --function-name "${function_name}" --dead-letter-config TargetArn="${dlq_arn}" --region "${AWS_REGION}" 1>/dev/null || true
}

for service in "${SERVICES[@]}"; do
  create_or_update_lambda "${service}"
done

echo "Lambdas created/updated"
