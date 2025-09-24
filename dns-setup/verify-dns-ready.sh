#!/usr/bin/env bash
# verify-dns-ready.sh - Non-interactive check for DNS/cert readiness
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
CERT_FILE="${ROOT_DIR}/.certificate-arn"

export API_DOMAIN="${API_DOMAIN:-api.asoba.co}"
export AWS_REGION="${AWS_REGION:-af-south-1}"
export AWS_CERT_REGION="${AWS_CERT_REGION:-${AWS_REGION}}"

# Default: assume skip until proven ready
export SKIP_CUSTOM_DOMAIN=true

if [[ ! -f "${CERT_FILE}" ]]; then
  echo "Certificate ARN file not found at ${CERT_FILE}"
  exit 0
fi

CERT_ARN=$(cat "${CERT_FILE}")

STATUS=$(aws acm describe-certificate \
  --region "${AWS_CERT_REGION}" \
  --certificate-arn "${CERT_ARN}" \
  --query 'Certificate.Status' --output text 2>/dev/null || echo "NOT_FOUND")

if [[ "${STATUS}" == "ISSUED" ]]; then
  export SKIP_CUSTOM_DOMAIN=false
fi

# Export for caller scripts
export CERTIFICATE_ARN="${CERT_ARN}"
