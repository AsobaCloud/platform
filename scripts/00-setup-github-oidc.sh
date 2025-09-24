#!/usr/bin/env bash
# 00-setup-github-oidc.sh - Configure IAM OIDC role for GitHub Actions (no long-lived secrets)
# Creates (if missing):
# - OIDC provider for https://token.actions.githubusercontent.com
# - IAM role ona-github-actions-ecr-role trusted for AsobaCloud/platform on main
# - Inline policy to allow ECR push and repo creation
set -euo pipefail

# Inputs
GITHUB_ORG=${GITHUB_ORG:-AsobaCloud}
GITHUB_REPO=${GITHUB_REPO:-platform}
ROLE_NAME=${ROLE_NAME:-ona-github-actions-ecr-role}
THUMBPRINT=${THUMBPRINT:-6938fd4d98bab03faadb97b34396831e3780aea1}
OIDC_URL="https://token.actions.githubusercontent.com"
AUDIENCE="sts.amazonaws.com"

# Discover account
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
PROVIDER_ARN=""

# Ensure OIDC provider exists
EXISTING_PROVIDERS=$(aws iam list-open-id-connect-providers --query 'OpenIDConnectProviderList[].Arn' --output text)
for arn in ${EXISTING_PROVIDERS}; do
  url=$(aws iam get-open-id-connect-provider --open-id-connect-provider-arn "$arn" --query 'Url' --output text || echo "")
  if [[ "$url" == "token.actions.githubusercontent.com" || "$url" == "$OIDC_URL" ]]; then
    PROVIDER_ARN="$arn"
    break
  fi
done

if [[ -z "$PROVIDER_ARN" ]]; then
  echo "Creating OIDC provider for GitHub..."
  PROVIDER_ARN=$(aws iam create-open-id-connect-provider \
    --url "$OIDC_URL" \
    --client-id-list "$AUDIENCE" \
    --thumbprint-list "$THUMBPRINT" \
    --query 'OpenIDConnectProviderArn' --output text)
else
  echo "OIDC provider already exists: $PROVIDER_ARN"
fi

# Trust policy restricted to repo main branch
TRUST_POLICY=$(cat <<JSON
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "Federated": "${PROVIDER_ARN}" },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": { "token.actions.githubusercontent.com:aud": "${AUDIENCE}" },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": [
            "repo:${GITHUB_ORG}/${GITHUB_REPO}:ref:refs/heads/main"
          ]
        }
      }
    }
  ]
}
JSON
)

ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${ROLE_NAME}"

# Create or update role
if aws iam get-role --role-name "$ROLE_NAME" >/dev/null 2>&1; then
  echo "Updating trust policy on role ${ROLE_NAME}..."
  aws iam update-assume-role-policy --role-name "$ROLE_NAME" --policy-document "$TRUST_POLICY" >/dev/null
else
  echo "Creating role ${ROLE_NAME}..."
  aws iam create-role --role-name "$ROLE_NAME" --assume-role-policy-document "$TRUST_POLICY" >/dev/null
fi

# Inline policy for ECR push and repo management
POLICY_NAME="ona-gha-ecr-push"
POLICY_DOC=$(cat <<JSON
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ecr:GetAuthorizationToken",
        "ecr:BatchCheckLayerAvailability",
        "ecr:CompleteLayerUpload",
        "ecr:DescribeRepositories",
        "ecr:BatchGetImage",
        "ecr:GetDownloadUrlForLayer",
        "ecr:InitiateLayerUpload",
        "ecr:PutImage",
        "ecr:UploadLayerPart",
        "ecr:CreateRepository"
      ],
      "Resource": "*"
    },
    { "Effect": "Allow", "Action": ["sts:GetCallerIdentity"], "Resource": "*" }
  ]
}
JSON
)

aws iam put-role-policy --role-name "$ROLE_NAME" --policy-name "$POLICY_NAME" --policy-document "$POLICY_DOC" >/dev/null

echo "Configured GitHub OIDC role for CI builds."
echo "Provider ARN: ${PROVIDER_ARN}"
echo "Role ARN: ${ROLE_ARN}"
# Machine-readable output for callers
echo "ROLE_ARN=${ROLE_ARN}"
