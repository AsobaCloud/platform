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
  
  local output
  if output=$(eval "${cmd}" 2>&1); then 
    log_success "${desc} completed"
    if [[ -n "${output}" ]]; then
      log_debug "Output: ${output}"
    fi
  else 
    local exit_code=$?
    # Check if it's a "resource not found" error (which is actually success for cleanup)
    if echo "${output}" | grep -q "ResourceNotFoundException\|not found\|does not exist\|NoSuchEntity\|cannot be found\|ParameterNotFound"; then
      log_success "${desc} completed (resource already deleted)"
    else
      log_error "${desc} FAILED with exit code ${exit_code}"
      log_error "Command: ${cmd}"
      log_error "Output: ${output}"
      error_exit "Rollback failed at: ${desc}" ${exit_code}
    fi
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

# Custom domain mapping removal (keep domain & cert) - MUST be done BEFORE deleting API Gateways
log_info "Removing custom domain mappings..."
if aws apigateway get-domain-name --domain-name "${API_DOMAIN}" --region "${AWS_REGION}" >/dev/null 2>&1; then
  # Delete all base path mappings first
  MAPPINGS=$(aws apigateway get-base-path-mappings --domain-name "${API_DOMAIN}" --region "${AWS_REGION}" --query 'items[].basePath' --output text 2>/dev/null || echo "")
  for path in ${MAPPINGS}; do
    safe_delete "aws apigateway delete-base-path-mapping --domain-name ${API_DOMAIN} --base-path '${path}' --region ${AWS_REGION}" "Removing base path mapping '${path}'"
  done
  
  # Delete the custom domain mapping entirely
  safe_delete "aws apigateway delete-domain-name --domain-name ${API_DOMAIN} --region ${AWS_REGION}" "Deleting custom domain mapping"
  log_info "Custom domain mapping deleted (certificate and Route53 records preserved)"
fi

# API Gateway - Delete all ONA-related APIs (after custom domain mappings are removed)
log_info "Deleting API Gateways..."
API_IDS=$(aws apigateway get-rest-apis --query "items[?contains(name, 'ona') || contains(name, 'ONA')].id" --output text --region "${AWS_REGION}" 2>/dev/null || echo "")
if [[ -n "${API_IDS}" && "${API_IDS}" != "None" ]]; then
  for api_id in ${API_IDS}; do
    safe_delete "aws apigateway delete-rest-api --rest-api-id ${api_id} --region ${AWS_REGION}" "Deleting API Gateway ${api_id}"
  done
else
  log_info "No ONA-related API Gateways found to delete"
fi

# ECR repositories
log_info "Deleting ECR repositories..."
# Delete base repo
safe_delete "aws ecr delete-repository --repository-name ona-base --force --region ${AWS_REGION}" "Deleting ECR repo ona-base"
# Delete service repos
for service in "${SERVICES[@]}"; do
  repo_name="$(get_ecr_repo "${service}")"
  safe_delete "aws ecr delete-repository --repository-name ${repo_name} --force --region ${AWS_REGION}" "Deleting ECR repo ${repo_name}"
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
  safe_delete "aws iam delete-role --role-name ${role}" "Deleting role ${role}"
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
safe_delete "aws iam delete-role --role-name ona-sagemaker-execution-role" "Deleting SageMaker role"


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

# SNS topics
log_info "Deleting SNS topics..."
safe_delete "aws sns delete-topic --topic-arn arn:aws:sns:${AWS_REGION}:${AWS_ACCOUNT_ID}:ona-platform-alerts --region ${AWS_REGION}" "Deleting SNS topic"

# SQS DLQs
log_info "Deleting SQS DLQs..."
for service in "${SERVICES[@]}"; do
  dlq_name="ona-${service}-dlq-${STAGE}"
  queue_url=$(aws sqs get-queue-url --queue-name "${dlq_name}" --region "${AWS_REGION}" --query 'QueueUrl' --output text 2>/dev/null || echo "")
  if [[ -n "${queue_url}" && "${queue_url}" != "None" ]]; then
    safe_delete "aws sqs delete-queue --queue-url ${queue_url} --region ${AWS_REGION}" "Deleting DLQ ${dlq_name}"
  else
    log_success "DLQ ${dlq_name} already deleted"
  fi
done

# CloudWatch alarms
log_info "Deleting CloudWatch alarms..."
for service in "${SERVICES[@]}"; do
  alarm_name="ona-${service}-errors-${STAGE}"
  safe_delete "aws cloudwatch delete-alarms --alarm-names ${alarm_name} --region ${AWS_REGION}" "Deleting alarm ${alarm_name}"
done

# Log groups
log_info "Deleting CloudWatch log groups..."
# Delete Lambda log groups
for service in "${SERVICES[@]}"; do
  safe_delete "aws logs delete-log-group --log-group-name /aws/lambda/ona-${service}-${STAGE} --region ${AWS_REGION}" "Deleting logs for ${service}"
done
# Delete platform log groups
safe_delete "aws logs delete-log-group --log-group-name /ona-platform/deployments --region ${AWS_REGION}" "Deleting deployment logs"
safe_delete "aws logs delete-log-group --log-group-name /ona-platform/scripts --region ${AWS_REGION}" "Deleting script logs"
safe_delete "aws logs delete-log-group --log-group-name /ona-platform/dns-setup --region ${AWS_REGION}" "Deleting DNS setup logs"

# Local files
rm -f .deployment-info

log_success "Rollback operations completed"
log_info "Validating rollback results..."

# Validation function
validate_cleanup() {
  local resource_type="$1"
  local check_cmd="$2"
  local expected_count="${3:-0}"
  
  log_info "Validating ${resource_type} cleanup..."
  local actual_count
  actual_count=$(eval "${check_cmd}" 2>/dev/null | wc -l || echo "0")
  
  if [[ "${actual_count}" -eq "${expected_count}" ]]; then
    log_success "${resource_type}: ${actual_count} found (expected ${expected_count}) ✓"
  else
    log_error "${resource_type}: ${actual_count} found (expected ${expected_count}) ✗"
    return 1
  fi
}

# Track validation failures
VALIDATION_ERRORS=0

# Validate API Gateways (should be 0 ONA-related)
validate_cleanup "API Gateways" "aws apigateway get-rest-apis --region ${AWS_REGION} --query 'items[?contains(name, \`ona\`) || contains(name, \`ONA\`)].id' --output text" 0 || ((VALIDATION_ERRORS++))

# Validate Lambda functions (should be 0 ONA-related)
validate_cleanup "Lambda Functions" "aws lambda list-functions --region ${AWS_REGION} --query 'Functions[?contains(FunctionName, \`ona-\`)].FunctionName' --output text" 0 || ((VALIDATION_ERRORS++))

# Validate ECR repositories (should be 0 ONA-related)
validate_cleanup "ECR Repositories" "aws ecr describe-repositories --region ${AWS_REGION} --query 'repositories[?contains(repositoryName, \`ona-\`)].repositoryName' --output text" 0 || ((VALIDATION_ERRORS++))

# Validate custom domain mappings (should not exist)
log_info "Validating custom domain mappings..."
if aws apigateway get-domain-name --domain-name "${API_DOMAIN}" --region "${AWS_REGION}" >/dev/null 2>&1; then
  log_error "Custom domain mapping still exists ✗"
  ((VALIDATION_ERRORS++))
else
  log_success "Custom domain mapping removed ✓"
fi

# Validate IAM roles (should be 0 ONA-related)
validate_cleanup "IAM Roles" "aws iam list-roles --query 'Roles[?contains(RoleName, \`ona-\`)].RoleName' --output text" 0 || ((VALIDATION_ERRORS++))

# Validate EventBridge rules (should be 0 ONA-related)
validate_cleanup "EventBridge Rules" "aws events list-rules --region ${AWS_REGION} --query 'Rules[?contains(Name, \`ona-\`)].Name' --output text" 0 || ((VALIDATION_ERRORS++))

# Validate SNS topics (should be 0 ONA-related)
validate_cleanup "SNS Topics" "aws sns list-topics --region ${AWS_REGION} --query 'Topics[?contains(TopicArn, \`ona-\`)].TopicArn' --output text" 0 || ((VALIDATION_ERRORS++))

# Validate SQS queues (should be 0 ONA-related)
validate_cleanup "SQS Queues" "aws sqs list-queues --region ${AWS_REGION} --query 'QueueUrls[?contains(@, \`ona-\`)]' --output text" 0 || ((VALIDATION_ERRORS++))

# Validate CloudWatch alarms (should be 0 ONA-related)
validate_cleanup "CloudWatch Alarms" "aws cloudwatch describe-alarms --region ${AWS_REGION} --query 'MetricAlarms[?contains(AlarmName, \`ona-\`)].AlarmName' --output text" 0 || ((VALIDATION_ERRORS++))

# Validate SSM parameters (should be 0 ONA-related)
validate_cleanup "SSM Parameters" "aws ssm describe-parameters --region ${AWS_REGION} --query 'Parameters[?contains(Name, \`ona-\`)].Name' --output text" 0 || ((VALIDATION_ERRORS++))

# Validate CloudWatch log groups (should be 0 ONA-related)
validate_cleanup "CloudWatch Log Groups" "aws logs describe-log-groups --region ${AWS_REGION} --query 'logGroups[?contains(logGroupName, \`ona-\`)].logGroupName' --output text" 0 || ((VALIDATION_ERRORS++))

# Final validation summary
log_info "=== ROLLBACK VALIDATION SUMMARY ==="
if [[ ${VALIDATION_ERRORS} -eq 0 ]]; then
  log_success "✓ ROLLBACK SUCCESSFUL - All resources properly cleaned up"
  log_info "Resources preserved: S3 buckets, DynamoDB tables, Route53 records, SSL certificate"
  log_script_completion "rollback.sh" 0
else
  log_error "✗ ROLLBACK INCOMPLETE - ${VALIDATION_ERRORS} validation failures"
  log_error "Some resources were not properly cleaned up"
  log_script_completion "rollback.sh" 1
  exit 1
fi
