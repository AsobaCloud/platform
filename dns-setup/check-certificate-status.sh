#!/usr/bin/env bash
# check-certificate-status.sh - Check ACM certificate validation status for api.asoba.co
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CERT_FILE="${ROOT_DIR}/.certificate-arn"
export AWS_REGION="${AWS_REGION:-af-south-1}"
export AWS_CERT_REGION="${AWS_CERT_REGION:-${AWS_REGION}}"

if [[ -f "${CERT_FILE}" ]]; then
  CERT_ARN=$(cat "${CERT_FILE}")
  STATUS=$(aws acm describe-certificate \
    --certificate-arn "${CERT_ARN}" \
    --region "${AWS_CERT_REGION}" \
    --query 'Certificate.Status' --output text)
  echo "Certificate: ${CERT_ARN}"
  echo "Status: ${STATUS}"
  if [[ "${STATUS}" == "ISSUED" ]]; then
    echo "✓ Certificate is ready!"
  else
    echo "⏳ Certificate is still validating..."
  fi
else
  echo "No certificate ARN found at ${CERT_FILE}. Run dns-setup/setup-dns-infrastructure.sh first."
fi
