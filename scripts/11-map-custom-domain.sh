#!/usr/bin/env bash
# 11-map-custom-domain.sh - Map pre-validated certificate to API Gateway (REGIONAL)
set -euo pipefail
source config/environment.sh

echo "Configuring custom domain mapping..."

if [[ "${SKIP_CUSTOM_DOMAIN:-false}" == "true" ]]; then
  echo "Skipping custom domain setup (certificate not ready)"
  exit 0
fi

ROOT_DIR="$(pwd)"
CERT_FILE="${ROOT_DIR}/.certificate-arn"
if [[ ! -f "${CERT_FILE}" ]]; then
  echo "WARNING: Certificate ARN file not found at ${CERT_FILE}"
  echo "Custom domain will not be configured"
  exit 0
fi

CERTIFICATE_ARN=$(cat "${CERT_FILE}")

# Check if certificate is ready
CERT_STATUS=$(aws acm describe-certificate --certificate-arn "${CERTIFICATE_ARN}" --region "${AWS_REGION}" --query 'Certificate.Status' --output text 2>/dev/null || echo "UNKNOWN")
if [[ "${CERT_STATUS}" != "ISSUED" ]]; then
  echo "WARNING: Certificate status is ${CERT_STATUS}, not ISSUED"
  echo "Custom domain will not be configured until certificate is ready"
  exit 0
fi

API_ID=$(aws apigateway get-rest-apis --query "items[?name=='${API_NAME}'].id | [0]" --output text --region "$AWS_REGION")
if [[ -z "${API_ID}" || "${API_ID}" == "None" ]]; then
  echo "ERROR: API Gateway not found"
  exit 1
fi

echo "Using API ID: ${API_ID}"

DOMAIN_EXISTS=$(aws apigateway get-domain-name --domain-name "${API_DOMAIN}" --region "$AWS_REGION" 2>&1 || true)
if [[ "${DOMAIN_EXISTS}" != *"NotFoundException"* && -n "${DOMAIN_EXISTS}" ]]; then
  echo "Custom domain ${API_DOMAIN} already exists"
  DOMAIN_INFO=$(aws apigateway get-domain-name --domain-name "${API_DOMAIN}" --region "$AWS_REGION")
else
  echo "Creating custom domain ${API_DOMAIN}..."
  DOMAIN_INFO=$(aws apigateway create-domain-name \
    --domain-name "${API_DOMAIN}" \
    --regional-certificate-arn "${CERTIFICATE_ARN}" \
    --endpoint-configuration types=REGIONAL \
    --tags Project=ona-platform,Environment=${ENVIRONMENT} \
    --region "$AWS_REGION")
fi

TARGET_DOMAIN=$(echo "$DOMAIN_INFO" | jq -r '.regionalDomainName')
HOSTED_ZONE_ID_ALIAS=$(echo "$DOMAIN_INFO" | jq -r '.regionalHostedZoneId')

echo "Target domain: ${TARGET_DOMAIN}"
echo "Alias hosted zone: ${HOSTED_ZONE_ID_ALIAS}"

# Recreate base path mapping to ensure it points to current API/stage
MAPPINGS=$(aws apigateway get-base-path-mappings --domain-name "${API_DOMAIN}" --region "$AWS_REGION" --query 'items[].basePath' --output text 2>/dev/null || echo "")
for path in ${MAPPINGS}; do
  [[ "${path}" == "(none)" ]] && path=""
  echo "Removing existing mapping: ${path:-'(root)'}"
  aws apigateway delete-base-path-mapping --domain-name "${API_DOMAIN}" --base-path "${path}" --region "$AWS_REGION" 2>/dev/null || true
done

echo "Creating base path mapping to ${API_NAME}:${STAGE}"
aws apigateway create-base-path-mapping --domain-name "${API_DOMAIN}" --rest-api-id "${API_ID}" --stage "${STAGE}" --region "$AWS_REGION" >/dev/null

# Route53 A alias record
echo "Updating Route53 A record for ${API_DOMAIN}"
cat > /tmp/api-a-record.json <<EOF
{
  "Changes": [{
    "Action": "UPSERT",
    "ResourceRecordSet": {
      "Name": "${API_DOMAIN}",
      "Type": "A",
      "AliasTarget": {
        "DNSName": "${TARGET_DOMAIN}",
        "EvaluateTargetHealth": false,
        "HostedZoneId": "${HOSTED_ZONE_ID_ALIAS}"
      }
    }
  }]
}
EOF

CHANGE_ID=$(aws route53 change-resource-record-sets --hosted-zone-id "${HOSTED_ZONE_ID}" --change-batch file:///tmp/api-a-record.json --query 'ChangeInfo.Id' --output text)
echo "DNS change submitted: ${CHANGE_ID}"
echo "Waiting for DNS propagation..."
aws route53 wait resource-record-sets-changed --id "${CHANGE_ID}"
echo "DNS propagation complete"

rm -f /tmp/api-a-record.json

echo "Custom domain mapping completed"
echo "Note: DNS propagation worldwide may take 5-15 minutes"
