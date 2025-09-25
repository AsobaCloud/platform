#!/usr/bin/env bash
# 03-create-iam.sh - Create IAM roles/policies for services
set -euo pipefail
source config/environment.sh
source lib/cloudwatch-logging.sh

# Initialize script logging
init_script_logging "03-create-iam.sh"

log_info "Creating IAM roles and policies"

create_role_if_missing() {
  local role_name=$1
  if aws iam get-role --role-name "${role_name}" >/dev/null 2>&1; then
    return 0
  fi
  aws iam create-role \
    --role-name "${role_name}" \
    --assume-role-policy-document '{
      "Version": "2012-10-17",
      "Statement": [{
        "Effect": "Allow",
        "Principal": {"Service": ["lambda.amazonaws.com"]},
        "Action": "sts:AssumeRole"
      }]
    }' \
    1>/dev/null
}

attach_managed_policies() {
  local role_name=$1
  aws iam attach-role-policy --role-name "${role_name}" --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole 1>/dev/null || error_exit "Failed to attach AWSLambdaBasicExecutionRole to ${role_name}"
  aws iam attach-role-policy --role-name "${role_name}" --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole 1>/dev/null || error_exit "Failed to attach AWSLambdaVPCAccessExecutionRole to ${role_name}"
}

# Add common ECR and SQS permissions to all Lambda roles
add_common_permissions() {
  local role_name=$1
  local dlq_name="$(get_dlq_name "${role_name##*-}")"  # Extract service name from role name
  
  COMMON_POLICY=$(cat <<JSON
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ecr:GetAuthorizationToken",
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "sqs:SendMessage"
      ],
      "Resource": "arn:aws:sqs:${AWS_REGION}:${AWS_ACCOUNT_ID}:${dlq_name}"
    }
  ]
}
JSON
)
  put_inline_policy "${role_name}" "ona-common-permissions" "${COMMON_POLICY}"
}

put_inline_policy() {
  local role_name=$1 policy_name=$2 policy_doc=$3
  aws iam put-role-policy --role-name "${role_name}" --policy-name "${policy_name}" --policy-document "${policy_doc}" 1>/dev/null
}

# Common resource ARNs
ACCOUNT_ARN="arn:aws:iam::${AWS_ACCOUNT_ID}:root"
S3_INPUT_ARN="arn:aws:s3:::${INPUT_BUCKET}"
S3_INPUT_ALL_ARN="arn:aws:s3:::${INPUT_BUCKET}/*"
S3_OUTPUT_ARN="arn:aws:s3:::${OUTPUT_BUCKET}"
S3_OUTPUT_ALL_ARN="arn:aws:s3:::${OUTPUT_BUCKET}/*"
DDB_LOC_ARN="arn:aws:dynamodb:${AWS_REGION}:${AWS_ACCOUNT_ID}:table/${LOCATIONS_TABLE}"
DDB_WEATHER_ARN="arn:aws:dynamodb:${AWS_REGION}:${AWS_ACCOUNT_ID}:table/${WEATHER_CACHE_TABLE}"

# Create per-service roles
for service in "${SERVICES[@]}"; do
  ROLE_NAME="$(get_lambda_role_name "${service}")"
  create_role_if_missing "${ROLE_NAME}"
  attach_managed_policies "${ROLE_NAME}"
  add_common_permissions "${ROLE_NAME}"

  # Inline policy tailored per service
  case "${service}" in
    dataIngestion)
      POLICY=$(cat <<'JSON'
{
  "Version": "2012-10-17",
  "Statement": [
    {"Effect":"Allow","Action":["s3:PutObject","s3:GetObject","s3:ListBucket"],"Resource":["S3_INPUT_ARN","S3_INPUT_ALL_ARN"]}
  ]
}
JSON
)
      ;;
    weatherCache)
      POLICY=$(cat <<'JSON'
{
  "Version": "2012-10-17",
  "Statement": [
    {"Effect":"Allow","Action":["dynamodb:BatchGetItem","dynamodb:GetItem","dynamodb:Scan","dynamodb:Query","dynamodb:PutItem","dynamodb:UpdateItem"],"Resource":["DDB_LOC_ARN","DDB_WEATHER_ARN"]},
    {"Effect":"Allow","Action":["s3:PutObject","s3:GetObject","s3:ListBucket"],"Resource":["S3_INPUT_ARN","S3_INPUT_ALL_ARN"]}
  ]
}
JSON
)
      ;;
    interpolationService)
      POLICY=$(cat <<'JSON'
{
  "Version": "2012-10-17",
  "Statement": [
    {"Effect":"Allow","Action":["dynamodb:GetItem","dynamodb:Scan","dynamodb:Query"],"Resource":["DDB_LOC_ARN"]},
    {"Effect":"Allow","Action":["s3:GetObject","s3:PutObject","s3:ListBucket"],"Resource":["S3_INPUT_ARN","S3_INPUT_ALL_ARN","S3_OUTPUT_ARN","S3_OUTPUT_ALL_ARN"]}
  ]
}
JSON
)
      ;;
    globalTrainingService)
      POLICY=$(cat <<'JSON'
{
  "Version": "2012-10-17",
  "Statement": [
    {"Effect":"Allow","Action":["s3:GetObject","s3:PutObject","s3:ListBucket"],"Resource":["S3_OUTPUT_ARN","S3_OUTPUT_ALL_ARN","S3_INPUT_ARN","S3_INPUT_ALL_ARN"]}
  ]
}
JSON
)
      ;;
    forecastingApi)
      POLICY=$(cat <<'JSON'
{
  "Version": "2012-10-17",
  "Statement": [
    {"Effect":"Allow","Action":["s3:GetObject","s3:ListBucket"],"Resource":["S3_OUTPUT_ARN","S3_OUTPUT_ALL_ARN","S3_INPUT_ARN","S3_INPUT_ALL_ARN"]}
  ]
}
JSON
)
      ;;
  esac

  # Substitute ARNs
  POLICY=${POLICY//S3_INPUT_ARN/${S3_INPUT_ARN}}
  POLICY=${POLICY//S3_INPUT_ALL_ARN/${S3_INPUT_ALL_ARN}}
  POLICY=${POLICY//S3_OUTPUT_ARN/${S3_OUTPUT_ARN}}
  POLICY=${POLICY//S3_OUTPUT_ALL_ARN/${S3_OUTPUT_ALL_ARN}}
  POLICY=${POLICY//DDB_LOC_ARN/${DDB_LOC_ARN}}
  POLICY=${POLICY//DDB_WEATHER_ARN/${DDB_WEATHER_ARN}}

  put_inline_policy "${ROLE_NAME}" "ona-${service}-inline" "${POLICY}"

  # Allow read of parameters path (scoped)
  PARAM_POLICY=$(cat <<JSON
{
  "Version": "2012-10-17",
  "Statement": [
    {"Effect":"Allow","Action":["ssm:GetParameter","ssm:GetParametersByPath"],"Resource":["arn:aws:ssm:${AWS_REGION}:${AWS_ACCOUNT_ID}:parameter/ona-platform/${STAGE}/*"]}
  ]
}
JSON
)
  put_inline_policy "${ROLE_NAME}" "ona-${service}-params" "${PARAM_POLICY}"

done

# SageMaker role (placeholder for future training needs)
if ! aws iam get-role --role-name ona-sagemaker-execution-role >/dev/null 2>&1; then
  aws iam create-role --role-name ona-sagemaker-execution-role --assume-role-policy-document '{
    "Version":"2012-10-17",
    "Statement":[{"Effect":"Allow","Principal":{"Service":["sagemaker.amazonaws.com"]},"Action":"sts:AssumeRole"}]}' 1>/dev/null
  aws iam attach-role-policy --role-name ona-sagemaker-execution-role --policy-arn arn:aws:iam::aws:policy/AmazonS3FullAccess 1>/dev/null || error_exit "Failed to attach AmazonS3FullAccess to ona-sagemaker-execution-role"
fi

log_success "IAM configuration complete"
log_script_completion "03-create-iam.sh" 0
