#!/usr/bin/env bash
# 12-validate-deployment.sh - Validate core resources and endpoints
set -euo pipefail
source config/environment.sh
source lib/cloudwatch-logging.sh

# Initialize script logging
init_script_logging "12-validate-deployment.sh"

log_info "Running deployment validation..."

ERRORS=0; WARNINGS=0

check() {
  local name=$1; shift
  local cmd="$*"
  echo -n "Checking ${name}... "
  if eval "${cmd}" >/dev/null 2>&1; then echo "OK"; else echo "ERROR"; ((ERRORS++)); fi
}

test_endpoint() {
  local method=$1 path=$2 url=$3 expected=${4:-200}
  echo -n "  ${method} ${path}... "
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" -X "${method}" "${url}" --connect-timeout 5 || echo 000)
  if [[ "${code}" == "${expected}" ]]; then echo "OK (${code})"; else echo "ERROR (${code} != ${expected})"; ((ERRORS++)); fi
}

# Lambdas
echo "Lambda Functions:"
for service in "${SERVICES[@]}"; do
  check "ona-${service}-${STAGE}" "aws lambda get-function --function-name ona-${service}-${STAGE} --region ${AWS_REGION}"
done
echo ""

# Buckets
echo "S3 Buckets:"
check "${INPUT_BUCKET}" "aws s3api head-bucket --bucket ${INPUT_BUCKET}"
check "${OUTPUT_BUCKET}" "aws s3api head-bucket --bucket ${OUTPUT_BUCKET}"
echo ""

# DynamoDB
echo "DynamoDB Tables:"
check "${LOCATIONS_TABLE}" "aws dynamodb describe-table --table-name ${LOCATIONS_TABLE} --region ${AWS_REGION}"
check "${WEATHER_CACHE_TABLE}" "aws dynamodb describe-table --table-name ${WEATHER_CACHE_TABLE} --region ${AWS_REGION}"
echo ""

# API Gateway
echo "API Gateway:"
API_ID=$(aws apigateway get-rest-apis --query "items[?name=='${API_NAME}'].id | [0]" --output text --region "$AWS_REGION" || echo "None")
if [[ -n "${API_ID}" && "${API_ID}" != "None" ]]; then
  echo "API exists: OK (ID: ${API_ID})"
  API_BASE_URL="https://${API_ID}.execute-api.${AWS_REGION}.amazonaws.com/${STAGE}"
else
  echo "API exists: ERROR"; ((ERRORS++))
fi

echo ""
if [[ -n "${API_ID}" && "${API_ID}" != "None" ]]; then
  echo "Testing API Gateway Endpoints:"
  test_endpoint POST "/upload_train" "${API_BASE_URL}/upload_train"
  test_endpoint POST "/upload_nowcast" "${API_BASE_URL}/upload_nowcast"
  test_endpoint GET "/forecast" "${API_BASE_URL}/forecast"
  echo ""
fi

# Custom domain
if [[ "${SKIP_CUSTOM_DOMAIN:-false}" != "true" ]]; then
  echo "Testing Custom Domain:"
  echo -n "DNS for ${API_DOMAIN}... "
  if nslookup "${API_DOMAIN}" >/dev/null 2>&1 || dig "${API_DOMAIN}" >/dev/null 2>&1; then
    echo "OK"
    test_endpoint POST "/upload_train" "https://${API_DOMAIN}/upload_train"
    test_endpoint POST "/upload_nowcast" "https://${API_DOMAIN}/upload_nowcast"
    test_endpoint GET "/forecast" "https://${API_DOMAIN}/forecast"
  else
    echo "WARN (DNS may be propagating)"; ((WARNINGS++))
  fi
else
  echo "Custom domain skipped (certificate not ready)"
fi

echo ""
# EventBridge
echo "Scheduled Tasks:"
check "weatherCache schedule" "aws events describe-rule --name ona-weatherCache-schedule --region ${AWS_REGION}"

echo ""
# S3 event notifications
echo "S3 Notifications:"
NOTIFS=$(aws s3api get-bucket-notification-configuration --bucket "${INPUT_BUCKET}" 2>/dev/null || echo '{"LambdaFunctionConfigurations":[]}')
if echo "${NOTIFS}" | grep -q "LambdaFunctionConfigurations"; then echo "OK"; else echo "ERROR"; ((ERRORS++)); fi

echo ""
# Logs
echo "CloudWatch Logs:"
COUNT=$(aws logs describe-log-groups --log-group-name-prefix "/aws/lambda/ona-" --region "${AWS_REGION}" --query 'length(logGroups)' --output text || echo "0")
if [[ "${COUNT}" =~ ^[0-9]+$ && ${COUNT} -ge 5 ]]; then echo "OK (${COUNT} groups)"; else echo "WARN (${COUNT})"; ((WARNINGS++)); fi

echo ""
# Parameters
echo "Parameter Store:"
echo -n "Visual Crossing API key... "
if aws ssm get-parameter --name "/ona-platform/${STAGE}/visual-crossing-api-key" --region "${AWS_REGION}" >/dev/null 2>&1; then
  VALUE=$(aws ssm get-parameter --name "/ona-platform/${STAGE}/visual-crossing-api-key" --with-decryption --query 'Parameter.Value' --output text --region "${AWS_REGION}")
  if [[ "${VALUE}" == "YOUR_ACTUAL_API_KEY" ]]; then echo "WARN placeholder"; ((WARNINGS++)); else echo "OK"; fi
else
  echo -e "${RED}✗${NC}"; ((ERRORS++))
fi

log_info "Validation Summary:"
if [[ ${ERRORS} -eq 0 ]]; then
  if [[ ${WARNINGS} -eq 0 ]]; then 
    log_success "All checks passed"
  else 
    log_warn "Success with ${WARNINGS} warnings"
  fi
  if [[ -n "${API_BASE_URL:-}" ]]; then
    log_info "API: ${API_BASE_URL}"
    if [[ "${SKIP_CUSTOM_DOMAIN:-false}" != "true" ]]; then log_info "Custom Domain: https://${API_DOMAIN}"; fi
  fi
else
  log_error "${ERRORS} errors, ${WARNINGS} warnings"
fi

log_script_completion "12-validate-deployment.sh" ${ERRORS}
exit ${ERRORS}
