#!/usr/bin/env bash
# setup-dns-infrastructure.sh - One-time DNS and certificate setup for api.asoba.co
set -euo pipefail

# Resolve repo root so we always write/read the same .certificate-arn file
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
CERT_FILE="${ROOT_DIR}/.certificate-arn"
LOG_FILE="${ROOT_DIR}/dns-setup.log"

# Configuration
export AWS_REGION="${AWS_REGION:-af-south-1}"
# For REGIONAL API Gateway, ACM certificate must be in the same region
export AWS_CERT_REGION="${AWS_CERT_REGION:-${AWS_REGION}}"
export AWS_ACCOUNT_ID="${AWS_ACCOUNT_ID:-$(aws sts get-caller-identity --query Account --output text)}"
export API_DOMAIN="${API_DOMAIN:-api.asoba.co}"
export HOSTED_ZONE_ID="${HOSTED_ZONE_ID:-Z02057713AMAS6GXTEGNR}"

# Enhanced logging function
log() { 
  local msg="[$(date +'%Y-%m-%d %H:%M:%S')] $*"
  echo "$msg" | tee -a "$LOG_FILE"
}

# Error handling function
error_exit() {
  log "ERROR: $1"
  log "Script failed at line $2"
  exit 1
}

# Success logging function
success() {
  log "SUCCESS: $1"
}

# Start logging
log "=== DNS Infrastructure Setup Started ==="
log "Domain: ${API_DOMAIN}"
log "Hosted Zone: ${HOSTED_ZONE_ID}"
log "Account: ${AWS_ACCOUNT_ID}"
log "ACM Region: ${AWS_CERT_REGION}"
log "Log file: ${LOG_FILE}"

# Prereqs
command -v aws >/dev/null || error_exit "AWS CLI not found" "${LINENO}"
command -v jq >/dev/null || error_exit "jq not found - required for JSON generation" "${LINENO}"

# Hosted zone check
log "Verifying Route53 hosted zone..."
if ! aws route53 get-hosted-zone --id "${HOSTED_ZONE_ID}" >/dev/null 2>&1; then
  error_exit "Failed to access Route53 hosted zone ${HOSTED_ZONE_ID}" "${LINENO}"
fi
success "Route53 hosted zone verified"

# Check for existing ISSUED certificate
log "Checking for existing certificate..."
EXISTING_CERT=$(aws acm list-certificates \
  --region "${AWS_CERT_REGION}" \
  --query "CertificateSummaryList[?DomainName=='${API_DOMAIN}' && Status=='ISSUED'].CertificateArn | [0]" \
  --output text || true)

if [[ -n "${EXISTING_CERT}" && "${EXISTING_CERT}" != "None" ]]; then
  echo "Certificate already ISSUED"
  echo "${EXISTING_CERT}" > "${CERT_FILE}"
  echo "Saved ARN to ${CERT_FILE}"
  exit 0
fi

# Check for pending certificate
PENDING_CERT=$(aws acm list-certificates \
  --region "${AWS_CERT_REGION}" \
  --query "CertificateSummaryList[?DomainName=='${API_DOMAIN}' && Status=='PENDING_VALIDATION'].CertificateArn | [0]" \
  --output text || true)

if [[ -n "${PENDING_CERT}" && "${PENDING_CERT}" != "None" ]]; then
  echo "Found pending certificate: ${PENDING_CERT}"
  CERT_ARN="${PENDING_CERT}"
else
  # Request new certificate (DNS validation)
  log "Requesting SSL certificate for ${API_DOMAIN} in ${AWS_CERT_REGION}..."
  CERT_ARN=$(aws acm request-certificate \
    --region "${AWS_CERT_REGION}" \
    --domain-name "${API_DOMAIN}" \
    --validation-method DNS \
    --subject-alternative-names "${API_DOMAIN}" \
    --tags Key=Project,Value=ona-platform Key=Environment,Value=prod Key=Service,Value=api-gateway \
    --query 'CertificateArn' --output text)
  echo "Requested certificate: ${CERT_ARN}"
fi

echo "${CERT_ARN}" > "${CERT_FILE}"
echo "Saved ARN to ${CERT_FILE}"

# Get DNS validation record
log "Fetching DNS validation record..."
ATTEMPTS=0
RECORD_NAME=""
RECORD_VALUE=""
while (( ATTEMPTS < 12 )); do
  RECORD_NAME=$(aws acm describe-certificate --region "${AWS_CERT_REGION}" --certificate-arn "${CERT_ARN}" \
    --query 'Certificate.DomainValidationOptions[0].ResourceRecord.Name' --output text 2>/dev/null || echo '')
  RECORD_VALUE=$(aws acm describe-certificate --region "${AWS_CERT_REGION}" --certificate-arn "${CERT_ARN}" \
    --query 'Certificate.DomainValidationOptions[0].ResourceRecord.Value' --output text 2>/dev/null || echo '')
  if [[ -n "${RECORD_NAME}" && "${RECORD_NAME}" != "None" && -n "${RECORD_VALUE}" && "${RECORD_VALUE}" != "None" ]]; then
    break
  fi
  ((ATTEMPTS++))
  sleep 5
  log "Waiting for validation record (${ATTEMPTS})..."
done

if [[ -z "${RECORD_NAME}" || -z "${RECORD_VALUE}" ]]; then
  echo "ERROR: Could not retrieve validation record"
  exit 1
fi

echo "Validation CNAME:"
echo "  Name: ${RECORD_NAME}"
echo "  Value: ${RECORD_VALUE}"

# Upsert CNAME in Route53
log "Creating DNS validation record: ${RECORD_NAME} -> ${RECORD_VALUE}"

# Create JSON file with proper error handling using jq
log "Creating Route53 change batch JSON using jq..."
if ! jq -n --arg name "${RECORD_NAME}" --arg value "${RECORD_VALUE}" '{
  "Changes": [{
    "Action": "UPSERT",
    "ResourceRecordSet": {
      "Name": $name,
      "Type": "CNAME",
      "TTL": 300,
      "ResourceRecords": [{"Value": $value}]
    }
  }]
}' > /tmp/validation-record.json; then
  error_exit "Failed to create validation record JSON with jq" "${LINENO}"
fi

# Verify JSON file was created successfully
if [[ ! -f /tmp/validation-record.json ]]; then
  error_exit "Failed to create validation record JSON file" "${LINENO}"
fi

log "JSON file created successfully. Contents:"
cat /tmp/validation-record.json | tee -a "$LOG_FILE"

# Submit Route53 change with error handling
log "Submitting Route53 change..."
if ! CHANGE_ID=$(aws route53 change-resource-record-sets \
  --hosted-zone-id "${HOSTED_ZONE_ID}" \
  --change-batch file:///tmp/validation-record.json \
  --query 'ChangeInfo.Id' --output text 2>&1); then
  error_exit "Route53 API call failed: ${CHANGE_ID}" "${LINENO}"
fi

# Verify we got a valid change ID
if [[ -z "${CHANGE_ID}" || "${CHANGE_ID}" == "None" ]]; then
  error_exit "Route53 returned empty change ID" "${LINENO}"
fi

log "DNS change submitted successfully: ${CHANGE_ID}"

# Wait for DNS propagation with error handling
log "Waiting for DNS propagation..."
if ! aws route53 wait resource-record-sets-changed --id "${CHANGE_ID}"; then
  error_exit "DNS propagation wait failed" "${LINENO}"
fi

success "DNS record created and propagated successfully"

# Verify the record actually exists
log "Verifying DNS record exists..."
if ! aws route53 list-resource-record-sets \
  --hosted-zone-id "${HOSTED_ZONE_ID}" \
  --query "ResourceRecordSets[?Name=='${RECORD_NAME}']" \
  --output text | grep -q "${RECORD_NAME}"; then
  error_exit "DNS record verification failed - record not found" "${LINENO}"
fi

success "DNS record verified and exists in Route53"

# Wait for certificate validation
log "Waiting for certificate validation (this can take several minutes)..."
ATTEMPTS=0
while (( ATTEMPTS < 60 )); do
  STATUS=$(aws acm describe-certificate --region "${AWS_CERT_REGION}" --certificate-arn "${CERT_ARN}" --query 'Certificate.Status' --output text)
  
  if [[ "${STATUS}" == "ISSUED" ]]; then
    success "Certificate validated successfully!"
    log "Certificate ARN: ${CERT_ARN}"
    log "Certificate status: ${STATUS}"
    log "=== DNS Infrastructure Setup Completed Successfully ==="
    exit 0
  elif [[ "${STATUS}" == "FAILED" ]]; then
    error_exit "Certificate validation failed. Check DNS records and try again." "${LINENO}"
  fi
  
  log "Certificate status: ${STATUS} (elapsed ~$((ATTEMPTS/2))m)"
  sleep 30
  ((ATTEMPTS++))
done

log "Certificate still pending after 30 minutes. This may indicate:"
log "1. DNS propagation is slow"
log "2. DNS record was not created correctly"
log "3. Certificate validation is taking longer than expected"
log "Check the DNS record manually and retry if needed."
log "=== DNS Infrastructure Setup Completed with Warnings ==="
exit 0
