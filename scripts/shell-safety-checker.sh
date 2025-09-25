#!/usr/bin/env bash
# shell-safety-checker.sh - Safety checker for shell scripts
# Based on ui/js-safety-checker.js pattern

set -euo pipefail

function checkShellFile() {
    local filePath="$1"
    local issues=()
    
    # Check for silent failures (|| true) - CRITICAL
    if grep -q "|| true" "$filePath"; then
        issues+=("Silent failure detected: || true")
    fi
    
    # Check for missing set -euo pipefail - CRITICAL
    if ! head -5 "$filePath" | grep -q "set -euo pipefail"; then
        issues+=("Missing 'set -euo pipefail'")
    fi
    
    # Check for proper shebang - CRITICAL
    if ! head -1 "$filePath" | grep -q "^#!/.*bash"; then
        issues+=("Missing or incorrect shebang")
    fi
    
    # Check for hardcoded credentials - SECURITY (more specific patterns)
    if grep -qi "password\s*=\s*[a-zA-Z0-9]\|secret\s*=\s*[a-zA-Z0-9]\|api_key\s*=\s*[a-zA-Z0-9]" "$filePath"; then
        issues+=("Potential hardcoded credential detected")
    fi
    
    # Check for unquoted variables - BUG RISK (exclude jq variables)
    if grep -q "\$[A-Z_][A-Z0-9_]*[^\"'[:space:]]" "$filePath" && ! grep -q "jq.*--arg.*\$[A-Z_]" "$filePath"; then
        issues+=("Unquoted variable usage detected")
    fi
    
    # Check for required file sourcing patterns - CONSISTENCY
    if [[ "$filePath" == *"scripts/"* ]] && [[ "$filePath" != "scripts/shell-safety-checker.sh" ]]; then
        if ! grep -q "source config/environment.sh" "$filePath"; then
            issues+=("Missing 'source config/environment.sh'")
        fi
        if ! grep -q "source lib/cloudwatch-logging.sh" "$filePath"; then
            issues+=("Missing 'source lib/cloudwatch-logging.sh'")
        fi
    fi
    
    # Check for proper logging function usage - CONSISTENCY
    if [[ "$filePath" == *"scripts/"* ]] && [[ "$filePath" != "scripts/shell-safety-checker.sh" ]]; then
        if ! grep -q "init_script_logging" "$filePath"; then
            issues+=("Missing 'init_script_logging' call")
        fi
        if ! grep -q "log_script_completion" "$filePath"; then
            issues+=("Missing 'log_script_completion' call")
        fi
    fi
    
    # Check for AWS CLI error handling - RELIABILITY
    if grep -q "aws " "$filePath"; then
        if ! grep -q ">/dev/null" "$filePath" && ! grep -q "2>&1" "$filePath"; then
            issues+=("AWS CLI commands should redirect output for cleaner logs")
        fi
    fi
    
    # Check for environment variable validation - RELIABILITY
    if grep -q "aws ssm put-parameter" "$filePath"; then
        if ! grep -q "\[\[ -z" "$filePath"; then
            issues+=("SSM parameter scripts should validate required environment variables")
        fi
    fi
    
    # Return issues
    if [[ ${#issues[@]} -gt 0 ]]; then
        echo "ERROR: $filePath"
        for issue in "${issues[@]}"; do
            echo "  - $issue"
        done
        return 1
    else
        echo "OK: $filePath"
        return 0
    fi
}

# Main execution - only run if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    # Temporarily disable strict mode for main execution
    set +euo pipefail
    
    echo "Shell Script Safety Checker"
    echo "=========================="

    totalIssues=0
    fileCount=0

    # Check all shell scripts except this safety checker
    while IFS= read -r -d '' file; do
        # Skip the safety checker itself
        if [[ "$file" != "./scripts/shell-safety-checker.sh" ]]; then
            ((fileCount++))
            checkShellFile "$file" || ((totalIssues++))
        fi
    done < <(find . -name "*.sh" -type f -print0)

    echo ""
    echo "Safety Check Summary"
    echo "==================="
    echo "Files checked: $fileCount"
    echo "Files with issues: $totalIssues"

    if [[ $totalIssues -eq 0 ]]; then
        echo "✓ All checks passed!"
        exit 0
    else
        echo "✗ Safety check failed"
        exit 1
    fi
fi