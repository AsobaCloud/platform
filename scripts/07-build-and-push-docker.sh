#!/usr/bin/env bash
# 07-build-and-push-docker.sh - Build and push Docker images to ECR
set -euo pipefail
source config/environment.sh
source lib/cloudwatch-logging.sh

# Initialize script logging
init_script_logging "07-build-and-push-docker.sh"

log_info "Logging in to ECR"
aws ecr get-login-password --region "${AWS_REGION}" | docker login --username AWS --password-stdin "${ECR_REGISTRY}"

# Build base image
log_info "Building base image (linux/amd64)"
docker build --platform linux/amd64 -t ona-base:latest -f services/base/Dockerfile services/base

tag_and_push() {
  local local_tag=$1 repo=$2 tag=$3
  docker tag "${local_tag}" "${ECR_REGISTRY}/${repo}:${tag}"
  docker push "${ECR_REGISTRY}/${repo}:${tag}"
}

# Push base
log_info "Pushing base image"
tag_and_push ona-base:latest ona-base "${STAGE}"

# Build/push service images
for service in "${SERVICES[@]}"; do
  dir="services/${service}"
  if [[ -f "${dir}/Dockerfile" ]]; then
    log_info "Building image for ${service} (linux/amd64)"
    docker build --platform linux/amd64 -t "ona-${service}:${STAGE}" -f "${dir}/Dockerfile" "${dir}"
    log_info "Pushing image for ${service}"
    tag_and_push "ona-${service}:${STAGE}" "$(get_ecr_repo "${service}")" "${STAGE}"
  else
    log_warn "Skipping ${service} (no Dockerfile)"
  fi
done

log_success "Docker images built and pushed"
log_script_completion "07-build-and-push-docker.sh" 0
