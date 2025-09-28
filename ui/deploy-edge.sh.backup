#!/bin/bash

# Ona Energy Management Platform Deploy Script
# This script deploys admin-gpu-panel and server-management to S3 for static hosting

set -euo pipefail  # Exit on any error, undefined vars, pipe failures

BUCKET_NAME="ona-platform"
REGION="us-east-1"

echo "🚀 Deploying Ona Energy Management Platform to S3..."
echo "📦 Bucket: $BUCKET_NAME"
echo "🌍 Region: $REGION"
echo ""

# Check if required files exist
echo "🔍 Checking required files..."
REQUIRED_FILES=("admin-gpu-panel.html" "server-management.html" "index.html" "application-select.html" "error.html")
MISSING_FILES=()

for file in "${REQUIRED_FILES[@]}"; do
    if [[ ! -f "$file" ]]; then
        MISSING_FILES+=("$file")
    fi
done

# Check for includes directory and key assets
if [[ ! -d "includes" ]]; then
    MISSING_FILES+=("includes directory")
elif [[ ! -f "includes/favicon.ico" ]]; then
    MISSING_FILES+=("includes/favicon.ico")
elif [[ ! -f "includes/Artboard-7.png" ]]; then
    MISSING_FILES+=("includes/Artboard-7.png")
fi

if [[ ${#MISSING_FILES[@]} -gt 0 ]]; then
    echo "❌ Missing required files:"
    for file in "${MISSING_FILES[@]}"; do
        echo "   - $file"
    done
    echo ""
    echo "Please ensure all required files are present before deploying."
    exit 1
fi

echo "✅ All required files found"
echo ""

# Create a temporary directory for deployment
TEMP_DIR=$(mktemp -d)
echo "📁 Created temporary directory: $TEMP_DIR"

# Copy HTML files
echo "📄 Copying HTML applications..."
cp admin-gpu-panel.html "$TEMP_DIR/"
cp server-management.html "$TEMP_DIR/"
cp index.html "$TEMP_DIR/"
cp application-select.html "$TEMP_DIR/"
cp error.html "$TEMP_DIR/"

# Copy JavaScript files
echo "📜 Copying JavaScript files..."
cp admin-gpu-panel.js "$TEMP_DIR/"

# Copy static assets - respecting the includes folder structure
echo "🎨 Copying static assets..."

if [[ -d "includes" ]]; then
    echo "📁 Copying includes directory..."
    cp -r includes "$TEMP_DIR/"
fi

# Note: index.html is now a proper login page, not a simple listing
echo "📄 Using custom index.html (login page)..."

echo "✅ Files prepared for deployment"
echo ""

# Upload to S3
echo "📤 Uploading files to S3..."
aws s3 sync "$TEMP_DIR/" "s3://$BUCKET_NAME/" --region "$REGION"

if [[ $? -ne 0 ]]; then
    echo "❌ S3 upload failed!"
    rm -rf "$TEMP_DIR"
    exit 1
fi

# Clean up temporary directory
rm -rf "$TEMP_DIR"

echo "✅ Deploy successful!"
echo ""
echo "🌐 Your applications are now available at:"
echo "   http://$BUCKET_NAME.s3-website-$REGION.amazonaws.com"
echo ""
echo "🔐 Login Credentials:"
echo "   • Username: admin"
echo "   • Password: admin123"
echo ""
echo "📱 Direct links (after login):"
echo "   • O&M Admin Panel: http://$BUCKET_NAME.s3-website-$REGION.amazonaws.com/admin-gpu-panel.html"
echo "   • Offtaker Management: http://$BUCKET_NAME.s3-website-$REGION.amazonaws.com/server-management.html"
echo ""
echo "🔧 To update the applications, simply run this script again."