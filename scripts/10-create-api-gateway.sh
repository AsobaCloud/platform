#!/usr/bin/env bash
# 10-create-api-gateway.sh - Create API Gateway REST API and integrate Lambdas
set -euo pipefail
source config/environment.sh

echo "Creating/Updating API Gateway: ${API_NAME}"

# Get or create API
echo -n "Resolving API... "
API_ID=$(aws apigateway get-rest-apis --region "${AWS_REGION}" --query "items[?name=='${API_NAME}'].id | [0]" --output text)
if [[ -z "${API_ID}" || "${API_ID}" == "None" ]]; then
  API_ID=$(aws apigateway create-rest-api --name "${API_NAME}" --region "${AWS_REGION}" --tags Project=ona-platform,Environment=${ENVIRONMENT} --query id --output text)
  echo "created ${API_ID}"
else
  echo "found ${API_ID}"
fi

# Root resource ID
ROOT_ID=$(aws apigateway get-resources --rest-api-id "${API_ID}" --region "${AWS_REGION}" --query 'items[?path==`/`].id' --output text)

# Helper to (re)create method+integration
create_method_integration() {
  local path=$1 method=$2 fn_name=$3
  # Ensure resource exists
  local res_id=$(aws apigateway get-resources --rest-api-id "${API_ID}" --region "${AWS_REGION}" --query "items[?path==\`/${path}\`].id | [0]" --output text)
  if [[ -z "${res_id}" || "${res_id}" == "None" ]]; then
    res_id=$(aws apigateway create-resource --rest-api-id "${API_ID}" --parent-id "${ROOT_ID}" --path-part "${path}" --region "${AWS_REGION}" --query id --output text)
  fi

  # Put method (no auth)
  aws apigateway put-method --rest-api-id "${API_ID}" --resource-id "${res_id}" --http-method "${method}" --authorization-type "NONE" --region "${AWS_REGION}" 1>/dev/null || true

  # Lambda permission
  local fn_arn=$(aws lambda get-function --function-name "${fn_name}" --region "${AWS_REGION}" --query 'Configuration.FunctionArn' --output text)
  aws lambda add-permission --function-name "${fn_name}" --statement-id "apigw-${path}-${method}" --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:${AWS_REGION}:${AWS_ACCOUNT_ID}:${API_ID}/*/${method}/$path" --region "${AWS_REGION}" 2>/dev/null || true

  # Integration (Lambda proxy)
  aws apigateway put-integration \
    --rest-api-id "${API_ID}" \
    --resource-id "${res_id}" \
    --http-method "${method}" \
    --type AWS_PROXY \
    --integration-http-method POST \
    --uri "arn:aws:apigateway:${AWS_REGION}:lambda:path/2015-03-31/functions/${fn_arn}/invocations" \
    --region "${AWS_REGION}" 1>/dev/null
}

# Map endpoints to functions
create_method_integration "upload_train" "POST" "$(get_lambda_name dataIngestion)"
create_method_integration "upload_nowcast" "POST" "$(get_lambda_name dataIngestion)"
create_method_integration "forecast" "GET" "$(get_lambda_name forecastingApi)"

# Deploy stage
aws apigateway create-deployment --rest-api-id "${API_ID}" --stage-name "${STAGE}" --region "${AWS_REGION}" 1>/dev/null

echo "API Gateway deployed (id=${API_ID}, stage=${STAGE})"
