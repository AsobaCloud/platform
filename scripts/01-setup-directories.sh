#!/usr/bin/env bash
# 01-setup-directories.sh - Create service directories and local structure if missing
set -euo pipefail
source config/environment.sh

echo "Ensuring service directories exist"

# No-ops if repo already has structure; create only if missing
mkdir -p services/base/utils
mkdir -p services/weatherCache
mkdir -p services/interpolationService/models
mkdir -p services/globalTrainingService
mkdir -p services/forecastingApi/utils
mkdir -p services/dataIngestion

echo "Directories ensured"
