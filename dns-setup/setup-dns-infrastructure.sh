#!/usr/bin/env bash
# setup-dns-infrastructure.sh - One-time DNS and certificate setup for api.asoba.co
set -euo pipefail

# Resolve repo root so we always write/read the same .certificate-arn file
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
CERT_FILE="${ROOT_DIR}/.certificate-arn"

# Configuration
export AWS_REGION="${AWS_REGION:-af-south-1}"
# For REGIONAL API Gateway, ACM certificate must be in the same region
export AWS_CERT_REGION="${AWS_CERT_REGION:-${AWS_REGION}}"
export AWS_ACCOUNT_ID="${AWS_ACCOUNT_ID:-$(aws sts get-caller-identity --query Account --output text)}"
export API_DOMAIN="${API_DOMAIN:-api.asoba.co}"
export HOSTED_ZONE_ID="${HOSTED_ZONE_ID:-Z02057713AMAS6GXTEGNR}"

log() { echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*"; }

echo "ONA Platform DNS Infrastructure Setup"
echo "Domain: ${API_DOMAIN}"
echo "Hosted Zone: ${HOSTED_ZONE_ID}"
echo "Account: ${AWS_ACCOUNT_ID}"
echo "ACM Region: ${AWS_CERT_REGION}"
echo ""

# Prereqs
command -v aws >/dev/null || { echo "AWS CLI not found"; exit 1; }

# Hosted zone check
log "Verifying Route53 hosted zone..."
aws route53 get-hosted-zone --id "${HOSTED_ZONE_ID}" >/dev/null

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
log "Upserting CNAME record in Route53..."
cat > /tmp/validation-record.json <<EOF
{
  "Changes": [{
    "Action": "UPSERT",
    "ResourceRecordSet": {
      "Name": "${RECORD_NAME}",
      "Type": "CNAME",
      "TTL": 300,
      "ResourceRecords": [{"Value": "${RECORD_VALUE}"}]
    }
  }]
}
EOF

CHANGE_ID=$(aws route53 change-resource-record-sets \
  --hosted-zone-id "${HOSTED_ZONE_ID}" \
  --change-batch file:///tmp/validation-record.json \
  --query 'ChangeInfo.Id' --output text)

echo "DNS change submitted: ${CHANGE_ID}"
log "Waiting for DNS propagation..."
aws route53 wait resource-record-sets-changed --id "${CHANGE_ID}"

# Wait for ISSUED
echo ""
echo "Waiting for certificate validation (this can take several minutes)..."
ATTEMPTS=0
while (( ATTEMPTS < 60 )); do
  STATUS=$(aws acm describe-certificate --region "${AWS_CERT_REGION}" --certificate-arn "${CERT_ARN}" --query 'Certificate.Status' --output text)
  if [[ "${STATUS}" == "ISSUED" ]]; then
    echo "Certificate validated"
    exit 0
  fi
  printf "\rStatus: %s (elapsed ~%dm)" "${STATUS}" "$((ATTEMPTS/2))"
  sleep 30
  ((ATTEMPTS++))
done

echo -e "\nCertificate still pending. It should complete once DNS propagates."
exit 0
