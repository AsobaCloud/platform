#!/usr/bin/env bash
# deploy-all.sh - Main orchestrator for ONA Platform deployment
set -euo pipefail

# Config
source config/environment.sh

echo "ONA Platform Deployment"
echo "Account: ${AWS_ACCOUNT_ID}"
echo "Region: ${AWS_REGION}"
echo "Environment: ${ENVIRONMENT}"
echo

echo "Pre-flight checks..."

# Tooling
for bin in aws jq; do
  if command -v "${bin}" >/dev/null 2>&1; then echo "${bin}: OK"; else echo "${bin}: MISSING"; exit 1; fi
done
if command -v docker >/dev/null 2>&1; then
  echo "docker: OK"
else
  echo "docker: not found, will skip local image builds (expect images in ECR)"
  export SKIP_DOCKER_BUILD=1
fi

# Credentials
if aws sts get-caller-identity >/dev/null 2>&1; then echo "AWS credentials: OK"; else echo "AWS credentials: ERROR"; exit 1; fi

# Required environment
if [[ -z "${VISUAL_CROSSING_API_KEY:-}" ]]; then
  echo "ENV: VISUAL_CROSSING_API_KEY missing"
  echo "Set it before running: export VISUAL_CROSSING_API_KEY=YOUR_KEY"
  exit 1
else
  echo "ENV: VISUAL_CROSSING_API_KEY set"
fi

echo
echo "Starting deployment..."

SCRIPTS=(
  "01-setup-directories.sh:Setting up directories"
  "02-create-parameters.sh:Creating parameters"
  "03-create-iam.sh:Creating IAM roles"
  "04-create-error-handling.sh:Creating error handling"
  "05-create-storage.sh:Ensuring storage resources"
  "06-create-ecr-repos.sh:Creating ECR repositories"
  "07-build-and-push-docker.sh:Building Docker images"
  "08-create-lambdas.sh:Creating Lambda functions"
  "09-configure-triggers.sh:Configuring triggers"
  "10-create-api-gateway.sh:Creating API Gateway"
  "11-map-custom-domain.sh:Mapping custom domain"
  "12-validate-deployment.sh:Validating deployment"
)

DEPLOYMENT_START=$(date +%s)
for script_info in "${SCRIPTS[@]}"; do
  IFS=':' read -r script description <<< "${script_info}"
  echo "Running scripts/${script} - ${description}"

  # Skip local Docker build if instructed
  if [[ "${script}" == "07-build-and-push-docker.sh" ]] && [[ "${SKIP_DOCKER_BUILD:-}" == "1" || "${USE_CI_DOCKER:-}" == "1" ]]; then
    echo "Skipping local Docker build (using CI-built images)"
    continue
  fi
  # Note: Custom domain and error handling are optional and not part of minimal flow

  START_TIME=$(date +%s)
  if bash "scripts/${script}"; then
    END_TIME=$(date +%s)
    echo "Done in $((END_TIME-START_TIME))s"
  else
    echo "Failed at: ${script}"
    exit 1
  fi
 done

DEPLOYMENT_END=$(date +%s)
TOTAL_DURATION=$((DEPLOYMENT_END - DEPLOYMENT_START))

API_ID=$(aws apigateway get-rest-apis --query "items[?name=='${API_NAME}'].id | [0]" --output text --region "$AWS_REGION" || true)
API_BASE_URL=""
if [[ -n "${API_ID}" && "${API_ID}" != "None" ]]; then
  API_BASE_URL="https://${API_ID}.execute-api.${AWS_REGION}.amazonaws.com/${STAGE}"
fi

echo "Deployment completed successfully"
echo "Deployment time: ${TOTAL_DURATION} seconds"
echo
echo "API Endpoints:"
if [[ "${SKIP_CUSTOM_DOMAIN:-false}" != "true" ]]; then
  echo "Production URLs:"
  echo "  POST https://api.asoba.co/upload_train"
  echo "  POST https://api.asoba.co/upload_nowcast"
  echo "  GET  https://api.asoba.co/forecast"
  echo
fi

if [[ -n "${API_BASE_URL}" ]]; then
  echo "Direct API Gateway URLs:"
  echo "  POST ${API_BASE_URL}/upload_train"
  echo "  POST ${API_BASE_URL}/upload_nowcast"
  echo "  GET  ${API_BASE_URL}/forecast"
  echo
fi

echo "Next steps:"
echo "1. Update Visual Crossing API key:"
echo "   aws ssm put-parameter --name /ona-platform/${STAGE}/visual-crossing-api-key --value YOUR_KEY --type SecureString --overwrite"
echo "2. Test the endpoints:"
echo "   curl -X POST ${API_BASE_URL}/upload_train"
echo "3. Monitor logs:"
echo "   aws logs tail /aws/lambda/ona-weatherCache-${STAGE} --follow"

cat > .deployment-info << EOF
DEPLOYMENT_DATE=$(date -u +"%Y-%m-%d %H:%M:%S UTC")
API_ID=${API_ID}
API_BASE_URL=${API_BASE_URL}
CUSTOM_DOMAIN_ENABLED=${SKIP_CUSTOM_DOMAIN:-false}
REGION=${AWS_REGION}
ENVIRONMENT=${ENVIRONMENT}
EOF

echo "Deployment information saved to .deployment-info"
