#!/usr/bin/env bash
# 07-build-and-push-docker.sh - Build and push Docker images to ECR
set -euo pipefail
source config/environment.sh

echo "Logging in to ECR"
aws ecr get-login-password --region "${AWS_REGION}" | docker login --username AWS --password-stdin "${ECR_REGISTRY}"

# Build base image
echo "Building base image (linux/amd64)"
docker build --platform linux/amd64 -t ona-base:latest -f services/base/Dockerfile services/base

tag_and_push() {
  local local_tag=$1 repo=$2 tag=$3
  docker tag "${local_tag}" "${ECR_REGISTRY}/${repo}:${tag}"
  docker push "${ECR_REGISTRY}/${repo}:${tag}"
}

# Push base
echo "Pushing base image"
tag_and_push ona-base:latest ona-base "${STAGE}"

# Build/push service images
for service in "${SERVICES[@]}"; do
  dir="services/${service}"
  if [[ -f "${dir}/Dockerfile" ]]; then
    echo "Building image for ${service} (linux/amd64)"
    docker build --platform linux/amd64 -t "ona-${service}:${STAGE}" -f "${dir}/Dockerfile" "${dir}"
    echo "Pushing image for ${service}"
    tag_and_push "ona-${service}:${STAGE}" "$(get_ecr_repo "${service}")" "${STAGE}"
  else
    echo "Skipping ${service} (no Dockerfile)"
  fi
done

echo "Docker images built and pushed"
