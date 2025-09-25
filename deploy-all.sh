#!/usr/bin/env bash
# deploy-all.sh - Main orchestrator for ONA Platform deployment
set -euo pipefail

# Config
source config/environment.sh
source lib/cloudwatch-logging.sh

# Load environment variables from .env.local if it exists
if [[ -f .env.local ]]; then
  set -a
  source .env.local
  set +a
  log_info "Loaded environment from .env.local"
fi

# Initialize logging
init_deployment_logging "deploy"

log_info "ONA Platform Deployment"
log_info "Account: ${AWS_ACCOUNT_ID}"
log_info "Region: ${AWS_REGION}"
log_info "Environment: ${ENVIRONMENT}"

log_info "Pre-flight checks..."

# Tooling
for bin in aws jq; do
  if command -v "${bin}" >/dev/null 2>&1; then 
    log_info "${bin}: OK"
  else 
    log_error "${bin}: MISSING"
    error_exit "Required tool ${bin} not found"
  fi
done
if command -v docker >/dev/null 2>&1; then
  log_info "docker: OK"
else
  log_warn "docker: not found, will skip local image builds (expect images in ECR)"
  export SKIP_DOCKER_BUILD=1
fi

# Credentials
if aws sts get-caller-identity >/dev/null 2>&1; then 
  log_info "AWS credentials: OK"
else 
  log_error "AWS credentials: ERROR"
  error_exit "AWS credentials not configured"
fi

# Required environment
if [[ -z "${VISUAL_CROSSING_API_KEY:-}" ]]; then
  log_error "ENV: VISUAL_CROSSING_API_KEY missing"
  log_error "Set it in .env.local or export it: export VISUAL_CROSSING_API_TOKEN=your_value"
  error_exit "Required environment variable VISUAL_CROSSING_API_KEY not set"
else
  log_info "ENV: VISUAL_CROSSING_API_KEY set"
fi

log_info "Starting deployment..."

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
  log_info "Running scripts/${script} - ${description}"

  # Skip local Docker build if instructed
  if [[ "${script}" == "07-build-and-push-docker.sh" ]] && [[ "${SKIP_DOCKER_BUILD:-}" == "1" || "${USE_CI_DOCKER:-}" == "1" ]]; then
    log_info "Skipping local Docker build (using CI-built images)"
    continue
  fi
  # Note: Custom domain and error handling are optional and not part of minimal flow

  START_TIME=$(date +%s)
  if bash "scripts/${script}"; then
    END_TIME=$(date +%s)
    log_success "scripts/${script} completed in $((END_TIME-START_TIME))s"
  else
    log_error "Failed at: ${script}"
    error_exit "Script ${script} failed"
  fi
 done

DEPLOYMENT_END=$(date +%s)
TOTAL_DURATION=$((DEPLOYMENT_END - DEPLOYMENT_START))

API_ID=$(aws apigateway get-rest-apis --query "items[?name=='${API_NAME}'].id | [0]" --output text --region "${AWS_REGION}")
API_BASE_URL=""
if [[ -n "${API_ID}" && "${API_ID}" != "None" ]]; then
  API_BASE_URL="https://${API_ID}.execute-api.${AWS_REGION}.amazonaws.com/${STAGE}"
  log_success "API Gateway created: ${API_ID}"
else
  log_warn "API Gateway not found: ${API_NAME}"
fi

log_success "Deployment completed successfully"
log_info "Deployment time: ${TOTAL_DURATION} seconds"

log_info "API Endpoints:"
if [[ "${SKIP_CUSTOM_DOMAIN:-false}" != "true" ]]; then
  log_info "Production URLs:"
  log_info "  POST https://api.asoba.co/upload_train"
  log_info "  POST https://api.asoba.co/upload_nowcast"
  log_info "  GET  https://api.asoba.co/forecast"
fi

if [[ -n "${API_BASE_URL}" ]]; then
  log_info "Direct API Gateway URLs:"
  log_info "  POST ${API_BASE_URL}/upload_train"
  log_info "  POST ${API_BASE_URL}/upload_nowcast"
  log_info "  GET  ${API_BASE_URL}/forecast"
fi

log_info "Next steps:"
log_info "1. Update Visual Crossing API key:"
log_info "   aws ssm put-parameter --name /ona-platform/${STAGE}/visual-crossing-api-key --value YOUR_KEY --type SecureString --overwrite"
log_info "2. Test the endpoints:"
log_info "   curl -X POST ${API_BASE_URL}/upload_train"
log_info "3. Monitor logs:"
log_info "   aws logs tail /aws/lambda/ona-weatherCache-${STAGE} --follow"

cat > .deployment-info << EOF
DEPLOYMENT_DATE=$(date -u +"%Y-%m-%d %H:%M:%S UTC")
API_ID=${API_ID}
API_BASE_URL=${API_BASE_URL}
CUSTOM_DOMAIN_ENABLED=${SKIP_CUSTOM_DOMAIN:-false}
REGION=${AWS_REGION}
ENVIRONMENT=${ENVIRONMENT}
EOF

log_info "Deployment information saved to .deployment-info"
log_script_completion "deploy-all.sh" 0
