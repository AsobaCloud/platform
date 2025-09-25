#!/usr/bin/env bash
# 01-setup-directories.sh - Create service directories and local structure if missing
set -euo pipefail
source config/environment.sh
source lib/cloudwatch-logging.sh

# Initialize script logging
init_script_logging "01-setup-directories.sh"

log_info "Ensuring service directories exist"

# No-ops if repo already has structure; create only if missing
mkdir -p services/base/utils
mkdir -p services/weatherCache
mkdir -p services/interpolationService/models
mkdir -p services/globalTrainingService
mkdir -p services/forecastingApi/utils
mkdir -p services/dataIngestion

log_success "Directories ensured"
log_script_completion "01-setup-directories.sh" 0
