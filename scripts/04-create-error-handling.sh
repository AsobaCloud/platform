#!/usr/bin/env bash
# 04-create-error-handling.sh - Create DLQs, SNS topic, and CloudWatch alarms
set -euo pipefail
source config/environment.sh
source lib/cloudwatch-logging.sh

# Initialize script logging
init_script_logging "04-create-error-handling.sh"

log_info "Configuring error handling (SQS DLQs, SNS, Alarms)"

# SNS topic for alerts
TOPIC_ARN="arn:aws:sns:${AWS_REGION}:${AWS_ACCOUNT_ID}:ona-platform-alerts"
if ! aws sns get-topic-attributes --topic-arn "${TOPIC_ARN}" >/dev/null 2>&1; then
  aws sns create-topic --name ona-platform-alerts --region "${AWS_REGION}" 1>/dev/null
fi

# Create DLQs and alarms per service
for service in "${SERVICES[@]}"; do
  DLQ_NAME="$(get_dlq_name "${service}")"
  DLQ_URL=$(aws sqs get-queue-url --queue-name "${DLQ_NAME}" --region "${AWS_REGION}" --query 'QueueUrl' --output text 2>/dev/null || echo "")
  if [[ -z "${DLQ_URL}" || "${DLQ_URL}" == "None" ]]; then
    DLQ_URL=$(aws sqs create-queue --queue-name "${DLQ_NAME}" --attributes VisibilityTimeout=30 --region "${AWS_REGION}" --query 'QueueUrl' --output text)
  fi
  DLQ_ARN=$(aws sqs get-queue-attributes --queue-url "${DLQ_URL}" --attribute-names QueueArn --query 'Attributes.QueueArn' --output text)

  # Create basic error-rate alarm for Lambda (uses standard AWS metric)
  ALARM_NAME="ona-${service}-error-rate"
  aws cloudwatch put-metric-alarm \
    --alarm-name "${ALARM_NAME}" \
    --metric-name Errors \
    --namespace AWS/Lambda \
    --statistic Sum \
    --period 60 \
    --threshold 1 \
    --comparison-operator GreaterThanOrEqualToThreshold \
    --dimensions Name=FunctionName,Value="$(get_lambda_name "${service}")" \
    --evaluation-periods 1 \
    --alarm-actions "${TOPIC_ARN}" \
    --treat-missing-data notBreaching \
    --region "${AWS_REGION}" 1>/dev/null || true

done

log_success "Error handling configuration complete"
log_script_completion "04-create-error-handling.sh" 0
