#!/usr/bin/env bash
# 09-configure-triggers.sh - Configure S3 and EventBridge triggers
set -euo pipefail
source config/environment.sh

echo "Configuring S3 event notifications and schedules"

# Permission for S3 to invoke interpolationService and globalTrainingService
INTERP_FN="$(get_lambda_name interpolationService)"
INTERP_ARN=$(aws lambda get-function --function-name "${INTERP_FN}" --region "${AWS_REGION}" --query 'Configuration.FunctionArn' --output text)
GT_FN="$(get_lambda_name globalTrainingService)"
GT_ARN=$(aws lambda get-function --function-name "${GT_FN}" --region "${AWS_REGION}" --query 'Configuration.FunctionArn' --output text)

aws lambda add-permission \
  --function-name "${INTERP_FN}" \
  --statement-id s3invoke-interpolation \
  --action lambda:InvokeFunction \
  --principal s3.amazonaws.com \
  --source-arn "arn:aws:s3:::${INPUT_BUCKET}" \
  --source-account "${AWS_ACCOUNT_ID}" \
  --region "${AWS_REGION}" 2>/dev/null || true

aws lambda add-permission \
  --function-name "${GT_FN}" \
  --statement-id s3invoke-training \
  --action lambda:InvokeFunction \
  --principal s3.amazonaws.com \
  --source-arn "arn:aws:s3:::${INPUT_BUCKET}" \
  --source-account "${AWS_ACCOUNT_ID}" \
  --region "${AWS_REGION}" 2>/dev/null || true

# Configure S3 notifications for prefixes
aws s3api put-bucket-notification-configuration \
  --bucket "${INPUT_BUCKET}" \
  --notification-configuration "{\
    \"LambdaFunctionConfigurations\":[\
      {\
        \"LambdaFunctionArn\":\"${INTERP_ARN}\",\
        \"Events\":[\"s3:ObjectCreated:*\"],\
        \"Filter\":{\"Key\":{\"FilterRules\":[{\"Name\":\"prefix\",\"Value\":\"historical/\"}]}}\
      },\
      {\
        \"LambdaFunctionArn\":\"${INTERP_ARN}\",\
        \"Events\":[\"s3:ObjectCreated:*\"],\
        \"Filter\":{\"Key\":{\"FilterRules\":[{\"Name\":\"prefix\",\"Value\":\"nowcast/\"}]}}\
      },\
      {\
        \"LambdaFunctionArn\":\"${GT_ARN}\",\
        \"Events\":[\"s3:ObjectCreated:*\"],\
        \"Filter\":{\"Key\":{\"FilterRules\":[{\"Name\":\"prefix\",\"Value\":\"training/\"}]}}\
      }\
    ]\
  }" \
  --region "${AWS_REGION}"

# EventBridge schedule for weatherCache every 15 minutes
WC_FN="$(get_lambda_name weatherCache)"
WC_ARN=$(aws lambda get-function --function-name "${WC_FN}" --region "${AWS_REGION}" --query 'Configuration.FunctionArn' --output text)
RULE_NAME="ona-weatherCache-schedule"
aws events put-rule --name "${RULE_NAME}" --schedule-expression 'rate(15 minutes)' --state ENABLED --tags ${STANDARD_TAGS} --region "${AWS_REGION}" 1>/dev/null

# Add target
aws events put-targets --rule "${RULE_NAME}" --targets "Id=1,Arn=${WC_ARN}" --region "${AWS_REGION}" 1>/dev/null

# Allow events to invoke lambda
aws lambda add-permission \
  --function-name "${WC_FN}" \
  --statement-id eventsinvoke \
  --action lambda:InvokeFunction \
  --principal events.amazonaws.com \
  --source-arn "arn:aws:events:${AWS_REGION}:${AWS_ACCOUNT_ID}:rule/${RULE_NAME}" \
  --region "${AWS_REGION}" 2>/dev/null || true

echo "Triggers configured"
