#!/usr/bin/env bash
# 06-create-ecr-repos.sh - Create ECR repositories for base and services
set -euo pipefail
source config/environment.sh
source lib/cloudwatch-logging.sh

# Initialize script logging
init_script_logging "06-create-ecr-repos.sh"

log_info "Creating ECR repositories"

create_repo() {
  local name=$1
  if ! aws ecr describe-repositories --repository-names "${name}" --region "${AWS_REGION}" >/dev/null 2>&1; then
    aws ecr create-repository --repository-name "${name}" --image-scanning-configuration scanOnPush=true --tags ${STANDARD_TAGS} --region "${AWS_REGION}" 1>/dev/null
  fi
}

create_repo "ona-base"
for service in "${SERVICES[@]}"; do
  create_repo "$(get_ecr_repo "${service}")"
done

log_success "ECR repositories ensured"
log_script_completion "06-create-ecr-repos.sh" 0
