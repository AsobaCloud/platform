#!/usr/bin/env bash
# rollback.sh - Clean rollback of ONA Platform resources (keeps data stores and DNS)
set -euo pipefail
source config/environment.sh

echo "ONA Platform Rollback/Cleanup"
echo
echo "WARNING: This will delete compute, API, IAM, ECR, Events, Alarms, DLQs, and parameters."
echo "It will KEEP S3 buckets, DynamoDB tables, Route53, and the SSL certificate."
echo ""
read -p "Type 'DELETE' to confirm: " CONFIRM
[[ "${CONFIRM}" == "DELETE" ]] || { echo "Cancelled"; exit 0; }

echo ""
log "Starting rollback..."

safe_delete() {
  local cmd="$1"; local desc="$2"
  echo -n "${desc}... "
  if eval "${cmd}" >/dev/null 2>&1; then echo "OK"; else echo "skipped"; fi
}

# Lambdas
echo "\nDeleting Lambda functions..."
for service in "${SERVICES[@]}"; do
  safe_delete "aws lambda delete-function --function-name ona-${service}-${STAGE} --region ${AWS_REGION}" "Deleting ona-${service}-${STAGE}"
done

# EventBridge rules
echo "\nDeleting EventBridge rules..."
safe_delete "aws events remove-targets --rule ona-weatherCache-schedule --ids 1 --region ${AWS_REGION}" "Removing EventBridge targets"
safe_delete "aws events delete-rule --name ona-weatherCache-schedule --region ${AWS_REGION}" "Deleting weatherCache schedule"

# API Gateway
echo "\nDeleting API Gateway..."
API_ID=$(aws apigateway get-rest-apis --query "items[?name=='${API_NAME}'].id | [0]" --output text --region "${AWS_REGION}" 2>/dev/null || echo "")
if [[ -n "${API_ID}" && "${API_ID}" != "None" ]]; then
  safe_delete "aws apigateway delete-rest-api --rest-api-id ${API_ID} --region ${AWS_REGION}" "Deleting API Gateway"
fi

# Custom domain mapping removal (keep domain & cert)
echo "\nRemoving custom domain mappings..."
if aws apigateway get-domain-name --domain-name "${API_DOMAIN}" --region "${AWS_REGION}" >/dev/null 2>&1; then
  MAPPINGS=$(aws apigateway get-base-path-mappings --domain-name "${API_DOMAIN}" --region "${AWS_REGION}" --query 'items[].basePath' --output text 2>/dev/null || echo "")
  for path in ${MAPPINGS}; do
    [[ "${path}" == "(none)" ]] && path=""
    safe_delete "aws apigateway delete-base-path-mapping --domain-name ${API_DOMAIN} --base-path '${path}' --region ${AWS_REGION}" "Removing base path mapping"
  done
  echo -e "${YELLOW}Keeping custom domain and certificate for future use${NC}"
fi

# ECR repositories
echo "\nDeleting ECR repositories..."
REPOS=(base "${SERVICES[@]}")
for repo in "${REPOS[@]}"; do
  safe_delete "aws ecr delete-repository --repository-name ona-${repo} --force --region ${AWS_REGION}" "Deleting ECR repo ona-${repo}"
done

# IAM roles and policies
echo "\nDeleting IAM roles..."
for service in "${SERVICES[@]}"; do
  role="ona-lambda-${service}-role"
  policies=$(aws iam list-role-policies --role-name "${role}" --query 'PolicyNames[]' --output text 2>/dev/null || echo "")
  for p in ${policies}; do
    safe_delete "aws iam delete-role-policy --role-name ${role} --policy-name ${p}" "Removing policy ${p}"
  done
  attached=$(aws iam list-attached-role-policies --role-name "${role}" --query 'AttachedPolicies[].PolicyArn' --output text 2>/dev/null || echo "")
  for arn in ${attached}; do
    safe_delete "aws iam detach-role-policy --role-name ${role} --policy-arn ${arn}" "Detaching managed policy"
  done
  safe_delete "aws iam delete-role --role-name ${role}" "Deleting role ${role}"
done

safe_delete "aws iam delete-role --role-name ona-sagemaker-execution-role" "Deleting SageMaker role"

# DLQs
echo "\nDeleting SQS DLQs..."
for service in "${SERVICES[@]}"; do
  url=$(aws sqs get-queue-url --queue-name "ona-${service}-dlq" --region "${AWS_REGION}" --query 'QueueUrl' --output text 2>/dev/null || echo "")
  if [[ -n "${url}" && "${url}" != "None" ]]; then
    safe_delete "aws sqs delete-queue --queue-url ${url} --region ${AWS_REGION}" "Deleting ona-${service}-dlq"
  fi
 done

# CloudWatch Alarms
echo "\nDeleting CloudWatch alarms..."
for service in "${SERVICES[@]}"; do
  safe_delete "aws cloudwatch delete-alarms --alarm-names ona-${service}-error-rate --region ${AWS_REGION}" "Deleting alarm for ${service}"
done

# SNS topic
safe_delete "aws sns delete-topic --topic-arn arn:aws:sns:${AWS_REGION}:${AWS_ACCOUNT_ID}:ona-platform-alerts --region ${AWS_REGION}" "Deleting alerts topic"

# Parameters
echo "\nDeleting SSM parameters..."
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
echo "\nDeleting CloudWatch log groups..."
for service in "${SERVICES[@]}"; do
  safe_delete "aws logs delete-log-group --log-group-name /aws/lambda/ona-${service}-${STAGE} --region ${AWS_REGION}" "Deleting logs for ${service}"
done

# Local files
rm -f .deployment-info

echo
echo "Rollback completed"
echo

echo "Preserved: S3 buckets (${INPUT_BUCKET}, ${OUTPUT_BUCKET}); DynamoDB (${LOCATIONS_TABLE}, ${WEATHER_CACHE_TABLE}); SSL cert; Route53 records"
