#!/usr/bin/env bash
# rollback.sh - Clean rollback of ONA Platform resources (keeps data stores and DNS)
set -euo pipefail
source config/environment.sh
source lib/cloudwatch-logging.sh

# Initialize logging
init_deployment_logging "rollback"

log_info "ONA Platform Rollback/Cleanup"
log_warn "WARNING: This will delete compute, API, IAM, ECR, Events, Alarms, DLQs, and parameters."
log_warn "It will KEEP S3 buckets, DynamoDB tables, Route53, and the SSL certificate."
read -p "Type 'DELETE' to confirm: " CONFIRM
[[ "${CONFIRM}" == "DELETE" ]] || { log_info "Rollback cancelled by user"; exit 0; }

log_info "Starting rollback..."

safe_delete() {
  local cmd="$1"; local desc="$2"
  log_info "${desc}..."
  if eval "${cmd}" >/dev/null 2>&1; then 
    log_success "${desc} completed"
  else 
    log_warn "${desc} skipped (resource may not exist)"
  fi
}

# Lambdas
log_info "Deleting Lambda functions..."
for service in "${SERVICES[@]}"; do
  safe_delete "aws lambda delete-function --function-name ona-${service}-${STAGE} --region ${AWS_REGION}" "Deleting ona-${service}-${STAGE}"
done

# EventBridge rules
log_info "Deleting EventBridge rules..."
safe_delete "aws events remove-targets --rule ona-weatherCache-schedule --ids 1 --region ${AWS_REGION}" "Removing EventBridge targets"
safe_delete "aws events delete-rule --name ona-weatherCache-schedule --region ${AWS_REGION}" "Deleting weatherCache schedule"

# API Gateway
log_info "Deleting API Gateway..."
API_ID=$(aws apigateway get-rest-apis --query "items[?name=='${API_NAME}'].id | [0]" --output text --region "${AWS_REGION}" 2>/dev/null || echo "")
if [[ -n "${API_ID}" && "${API_ID}" != "None" ]]; then
  safe_delete "aws apigateway delete-rest-api --rest-api-id ${API_ID} --region ${AWS_REGION}" "Deleting API Gateway"
fi

# Custom domain mapping removal (keep domain & cert)
log_info "Removing custom domain mappings..."
if aws apigateway get-domain-name --domain-name "${API_DOMAIN}" --region "${AWS_REGION}" >/dev/null 2>&1; then
  MAPPINGS=$(aws apigateway get-base-path-mappings --domain-name "${API_DOMAIN}" --region "${AWS_REGION}" --query 'items[].basePath' --output text 2>/dev/null || echo "")
  for path in ${MAPPINGS}; do
    [[ "${path}" == "(none)" ]] && path=""
    safe_delete "aws apigateway delete-base-path-mapping --domain-name ${API_DOMAIN} --base-path '${path}' --region ${AWS_REGION}" "Removing base path mapping"
  done
  log_info "Keeping custom domain and certificate for future use"
fi

# ECR repositories
log_info "Deleting ECR repositories..."
REPOS=(base "${SERVICES[@]}")
for repo in "${REPOS[@]}"; do
  safe_delete "aws ecr delete-repository --repository-name ona-${repo} --force --region ${AWS_REGION}" "Deleting ECR repo ona-${repo}"
done

# IAM roles and policies
log_info "Deleting IAM roles..."
for service in "${SERVICES[@]}"; do
  role="ona-lambda-${service}-role"
  log_info "Cleaning up role: ${role}"
  
  # Delete inline policies
  policies=$(aws iam list-role-policies --role-name "${role}" --query 'PolicyNames[]' --output text 2>/dev/null || echo "")
  if [[ -n "${policies}" ]]; then
    for p in ${policies}; do
      log_info "  Deleting inline policy ${p}..."
      if aws iam delete-role-policy --role-name "${role}" --policy-name "${p}" >/dev/null 2>&1; then
        log_success "  Inline policy ${p} deleted"
      else
        log_error "  Failed to delete inline policy ${p}"
      fi
    done
  fi
  
  # Detach managed policies
  attached=$(aws iam list-attached-role-policies --role-name "${role}" --query 'AttachedPolicies[].PolicyArn' --output text 2>/dev/null || echo "")
  if [[ -n "${attached}" ]]; then
    for arn in ${attached}; do
      log_info "  Detaching managed policy ${arn}..."
      if aws iam detach-role-policy --role-name "${role}" --policy-arn "${arn}" >/dev/null 2>&1; then
        log_success "  Managed policy ${arn} detached"
      else
        log_error "  Failed to detach managed policy ${arn}"
      fi
    done
  fi
  
  # Delete the role
  log_info "  Deleting role ${role}..."
  if aws iam delete-role --role-name "${role}" >/dev/null 2>&1; then
    log_success "  Role ${role} deleted"
  else
    log_error "  Failed to delete role ${role}"
  fi
done

# Delete SageMaker role
log_info "Cleaning up SageMaker role: ona-sagemaker-execution-role"
policies=$(aws iam list-role-policies --role-name "ona-sagemaker-execution-role" --query 'PolicyNames[]' --output text 2>/dev/null || echo "")
if [[ -n "${policies}" ]]; then
  for p in ${policies}; do
    log_info "  Deleting inline policy ${p}..."
    if aws iam delete-role-policy --role-name "ona-sagemaker-execution-role" --policy-name "${p}" >/dev/null 2>&1; then
      log_success "  Inline policy ${p} deleted"
    else
      log_error "  Failed to delete inline policy ${p}"
    fi
  done
fi
attached=$(aws iam list-attached-role-policies --role-name "ona-sagemaker-execution-role" --query 'AttachedPolicies[].PolicyArn' --output text 2>/dev/null || echo "")
if [[ -n "${attached}" ]]; then
  for arn in ${attached}; do
    log_info "  Detaching managed policy ${arn}..."
    if aws iam detach-role-policy --role-name "ona-sagemaker-execution-role" --policy-arn "${arn}" >/dev/null 2>&1; then
      log_success "  Managed policy ${arn} detached"
    else
      log_error "  Failed to detach managed policy ${arn}"
    fi
  done
fi
log_info "  Deleting SageMaker role..."
if aws iam delete-role --role-name "ona-sagemaker-execution-role" >/dev/null 2>&1; then
  log_success "  SageMaker role deleted"
else
  log_error "  Failed to delete SageMaker role"
fi

# DLQs
log_info "Deleting SQS DLQs..."
for service in "${SERVICES[@]}"; do
  url=$(aws sqs get-queue-url --queue-name "ona-${service}-dlq" --region "${AWS_REGION}" --query 'QueueUrl' --output text 2>/dev/null || echo "")
  if [[ -n "${url}" && "${url}" != "None" ]]; then
    safe_delete "aws sqs delete-queue --queue-url ${url} --region ${AWS_REGION}" "Deleting ona-${service}-dlq"
  fi
 done

# CloudWatch Alarms
log_info "Deleting CloudWatch alarms..."
for service in "${SERVICES[@]}"; do
  safe_delete "aws cloudwatch delete-alarms --alarm-names ona-${service}-error-rate --region ${AWS_REGION}" "Deleting alarm for ${service}"
done

# SNS topic
safe_delete "aws sns delete-topic --topic-arn arn:aws:sns:${AWS_REGION}:${AWS_ACCOUNT_ID}:ona-platform-alerts --region ${AWS_REGION}" "Deleting alerts topic"

# Parameters
log_info "Deleting SSM parameters..."
PARAMS=(
  "/ona-platform/${STAGE}/visual-crossing-api-key"
  "/ona-platform/${STAGE}/sagemaker-execution-role"
  "/ona-platform/${STAGE}/model-bucket-name"
  "/ona-platform/${STAGE}/sns-alert-topic"
  "/ona-platform/${STAGE}/log-level"
  "/ona-platform/${STAGE}/environment"
)
for p in "${PARAMS[@]}"; do
  safe_delete "aws ssm delete-parameter --name ${p} --region ${AWS_REGION}" "Deleting ${p}"
done

# S3 notifications
safe_delete "aws s3api put-bucket-notification-configuration --bucket ${INPUT_BUCKET} --notification-configuration '{}'" "Clearing S3 notifications"

# Log groups
log_info "Deleting CloudWatch log groups..."
for service in "${SERVICES[@]}"; do
  safe_delete "aws logs delete-log-group --log-group-name /aws/lambda/ona-${service}-${STAGE} --region ${AWS_REGION}" "Deleting logs for ${service}"
done

# Local files
rm -f .deployment-info

log_success "Rollback completed"
log_info "Preserved: S3 buckets (${INPUT_BUCKET}, ${OUTPUT_BUCKET}); DynamoDB (${LOCATIONS_TABLE}, ${WEATHER_CACHE_TABLE}); SSL cert; Route53 records"
log_script_completion "rollback.sh" 0
