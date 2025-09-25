#!/usr/bin/env bash
# CloudWatch Logging Framework for ONA Platform
# Provides centralized logging to AWS CloudWatch Logs

set -euo pipefail

# Configuration
export AWS_REGION="${AWS_REGION:-af-south-1}"
export LOG_GROUP_PREFIX="/ona-platform"

# Log levels
readonly LOG_LEVEL_DEBUG=0
readonly LOG_LEVEL_INFO=1
readonly LOG_LEVEL_WARN=2
readonly LOG_LEVEL_ERROR=3
readonly LOG_LEVEL_SUCCESS=4

# Current log level (can be overridden)
export LOG_LEVEL="${LOG_LEVEL:-${LOG_LEVEL_INFO}}"

# Deployment metadata
export DEPLOYMENT_ID="${DEPLOYMENT_ID:-$(date +%Y%m%d-%H%M%S)-$(uuidgen | cut -d- -f1)}"
if [[ -n "${SCRIPT_NAME:-}" ]]; then
  # SCRIPT_NAME already set
  :
elif [[ "${0:-}" == "--" ]]; then
  export SCRIPT_NAME="sourced-script"
else
  export SCRIPT_NAME="$(basename "${0}")"
fi
export SCRIPT_PID="${SCRIPT_PID:-$$}"

# Log group names
export LOG_GROUP_DEPLOYMENTS="${LOG_GROUP_PREFIX}/deployments"
export LOG_GROUP_SCRIPTS="${LOG_GROUP_PREFIX}/scripts"
export LOG_GROUP_DNS="${LOG_GROUP_PREFIX}/dns-setup"

# Initialize logging
init_cloudwatch_logging() {
    local log_group="$1"
    local log_stream="$2"
    
    # Create log group if it doesn't exist
    if ! aws logs describe-log-groups --log-group-name-prefix "${log_group}" --query "logGroups[?logGroupName=='${log_group}'].logGroupName" --output text | grep -q "${log_group}"; then
        aws logs create-log-group --log-group-name "${log_group}" --region "${AWS_REGION}" 2>/dev/null || true
    fi
    
    # Create log stream
    aws logs create-log-stream --log-group-name "${log_group}" --log-stream-name "${log_stream}" --region "${AWS_REGION}" 2>/dev/null || true
    
    # Export for use by logging functions
    export CURRENT_LOG_GROUP="${log_group}"
    export CURRENT_LOG_STREAM="${log_stream}"
    export LOG_SEQUENCE_TOKEN=""
}

# Get next sequence token for log stream
get_sequence_token() {
    if [[ -z "${LOG_SEQUENCE_TOKEN:-}" ]]; then
        LOG_SEQUENCE_TOKEN=$(aws logs describe-log-streams \
            --log-group-name "${CURRENT_LOG_GROUP}" \
            --log-stream-name "${CURRENT_LOG_STREAM}" \
            --region "${AWS_REGION}" \
            --query 'logStreams[0].uploadSequenceToken' \
            --output text 2>/dev/null || echo "")
    fi
    echo "${LOG_SEQUENCE_TOKEN}"
}

# Send log message to CloudWatch
send_to_cloudwatch() {
    local level="$1"
    local message="$2"
    local timestamp=$(date +%s)000  # milliseconds
    
    # Format log message
    local formatted_message="[$(date -u +'%Y-%m-%dT%H:%M:%SZ')] [${level}] [${SCRIPT_NAME}:${BASH_LINENO[1]}] ${message}"
    
    # Prepare log event
    local log_event="{\"timestamp\":${timestamp},\"message\":\"${formatted_message}\"}"
    
    # Get sequence token
    local sequence_token=$(get_sequence_token)
    
    # Send to CloudWatch
    if [[ -n "${sequence_token}" && "${sequence_token}" != "None" ]]; then
        aws logs put-log-events \
            --log-group-name "${CURRENT_LOG_GROUP}" \
            --log-stream-name "${CURRENT_LOG_STREAM}" \
            --log-events "${log_event}" \
            --sequence-token "${sequence_token}" \
            --region "${AWS_REGION}" >/dev/null 2>&1 || true
    else
        aws logs put-log-events \
            --log-group-name "${CURRENT_LOG_GROUP}" \
            --log-stream-name "${CURRENT_LOG_STREAM}" \
            --log-events "${log_event}" \
            --region "${AWS_REGION}" >/dev/null 2>&1 || true
    fi
    
    # Update sequence token
    LOG_SEQUENCE_TOKEN=$(aws logs describe-log-streams \
        --log-group-name "${CURRENT_LOG_GROUP}" \
        --log-stream-name "${CURRENT_LOG_STREAM}" \
        --region "${AWS_REGION}" \
        --query 'logStreams[0].uploadSequenceToken' \
        --output text 2>/dev/null || echo "")
}

# Logging functions
log_debug() {
    if [[ "${LOG_LEVEL}" -le "${LOG_LEVEL_DEBUG}" ]]; then
        echo "[DEBUG] $*" >&2
        if [[ -n "${CURRENT_LOG_GROUP:-}" ]]; then
            send_to_cloudwatch "DEBUG" "$*"
        fi
    fi
}

log_info() {
    if [[ "${LOG_LEVEL}" -le "${LOG_LEVEL_INFO}" ]]; then
        echo "[INFO] $*"
        if [[ -n "${CURRENT_LOG_GROUP:-}" ]]; then
            send_to_cloudwatch "INFO" "$*"
        fi
    fi
}

log_warn() {
    if [[ "${LOG_LEVEL}" -le "${LOG_LEVEL_WARN}" ]]; then
        echo "[WARN] $*" >&2
        if [[ -n "${CURRENT_LOG_GROUP:-}" ]]; then
            send_to_cloudwatch "WARN" "$*"
        fi
    fi
}

log_error() {
    if [[ "${LOG_LEVEL}" -le "${LOG_LEVEL_ERROR}" ]]; then
        echo "[ERROR] $*" >&2
        if [[ -n "${CURRENT_LOG_GROUP:-}" ]]; then
            send_to_cloudwatch "ERROR" "$*"
        fi
    fi
}

log_success() {
    if [[ "${LOG_LEVEL}" -le "${LOG_LEVEL_SUCCESS}" ]]; then
        echo "[SUCCESS] $*"
        if [[ -n "${CURRENT_LOG_GROUP:-}" ]]; then
            send_to_cloudwatch "SUCCESS" "$*"
        fi
    fi
}

# Error handling with logging
error_exit() {
    local message="$1"
    local exit_code="${2:-1}"
    log_error "Script failed: ${message}"
    log_error "Exit code: ${exit_code}"
    exit "${exit_code}"
}

# AWS command wrapper with logging
aws_with_logging() {
    local command="$1"
    local description="${2:-AWS command}"
    
    log_debug "Executing: ${description}"
    log_debug "Command: aws ${command}"
    
    if output=$(aws ${command} 2>&1); then
        log_debug "Command succeeded: ${description}"
        if [[ -n "${output}" ]]; then
            log_debug "Output: ${output}"
        fi
        echo "${output}"
    else
        local exit_code=$?
        log_error "Command failed: ${description}"
        log_error "Exit code: ${exit_code}"
        log_error "Output: ${output}"
        return ${exit_code}
    fi
}

# Initialize deployment logging
init_deployment_logging() {
    local deployment_type="${1:-deploy}"
    local log_stream="${deployment_type}-${DEPLOYMENT_ID}"
    init_cloudwatch_logging "${LOG_GROUP_DEPLOYMENTS}" "${log_stream}"
    log_info "=== ${deployment_type^} Started ==="
    log_info "Deployment ID: ${DEPLOYMENT_ID}"
    log_info "Script: ${SCRIPT_NAME}"
    log_info "PID: ${SCRIPT_PID}"
    log_info "Region: ${AWS_REGION}"
    log_info "Timestamp: $(date -u +'%Y-%m-%dT%H:%M:%SZ')"
}

# Initialize script logging
init_script_logging() {
    local script_name="${1:-${SCRIPT_NAME}}"
    local log_stream="${script_name}-${DEPLOYMENT_ID}"
    init_cloudwatch_logging "${LOG_GROUP_SCRIPTS}" "${log_stream}"
    log_info "=== ${script_name} Started ==="
    log_info "Deployment ID: ${DEPLOYMENT_ID}"
    log_info "Script: ${script_name}"
    log_info "PID: ${SCRIPT_PID}"
}

# Initialize DNS logging
init_dns_logging() {
    local script_name="${1:-${SCRIPT_NAME}}"
    local log_stream="${script_name}-${DEPLOYMENT_ID}"
    init_cloudwatch_logging "${LOG_GROUP_DNS}" "${log_stream}"
    log_info "=== ${script_name} Started ==="
    log_info "Deployment ID: ${DEPLOYMENT_ID}"
    log_info "Script: ${script_name}"
    log_info "PID: ${SCRIPT_PID}"
}

# Log AWS resource creation
log_resource_creation() {
    local resource_type="$1"
    local resource_name="$2"
    local status="${3:-created}"
    log_success "${resource_type} ${status}: ${resource_name}"
}

# Log AWS resource failure
log_resource_failure() {
    local resource_type="$1"
    local resource_name="$2"
    local error_message="$3"
    log_error "${resource_type} failed: ${resource_name}"
    log_error "Error: ${error_message}"
}

# Log script completion
log_script_completion() {
    local script_name="${1:-${SCRIPT_NAME}}"
    local exit_code="${2:-0}"
    if [[ "${exit_code}" -eq 0 ]]; then
        log_success "=== ${script_name} Completed Successfully ==="
    else
        log_error "=== ${script_name} Failed with exit code ${exit_code} ==="
    fi
}

# Export functions for use by other scripts
export -f init_cloudwatch_logging
export -f log_debug log_info log_warn log_error log_success
export -f error_exit
export -f aws_with_logging
export -f init_deployment_logging init_script_logging init_dns_logging
export -f log_resource_creation log_resource_failure log_script_completion