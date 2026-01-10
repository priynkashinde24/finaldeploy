#!/bin/bash
# Bash script to create a small zip file excluding large folders
# This script removes node_modules, dist, build artifacts before zipping

echo "🧹 Cleaning project for smaller zip size..."

# Get current directory name for zip file name
CURRENT_DIR=$(basename "$PWD")
ZIP_FILE="${CURRENT_DIR}_clean.zip"
TEMP_FOLDER="${CURRENT_DIR}_temp"

# Create temporary folder
rm -rf "$TEMP_FOLDER"
mkdir -p "$TEMP_FOLDER"

echo "📋 Copying files (excluding node_modules, dist, etc.)..."

# Copy files excluding large folders
rsync -av --progress \
  --exclude='node_modules' \
  --exclude='dist' \
  --exclude='out' \
  --exclude='.next' \
  --exclude='build' \
  --exclude='coverage' \
  --exclude='.vercel' \
  --exclude='.git' \
  --exclude='*.log' \
  --exclude='.DS_Store' \
  --exclude='Thumbs.db' \
  --exclude='*.zip' \
  --exclude='*.tar.gz' \
  ./ "$TEMP_FOLDER/"

echo "🗜️  Creating zip file..."

# Remove existing zip if it exists
rm -f "$ZIP_FILE"

# Create zip file
cd "$TEMP_FOLDER"
zip -r "../$ZIP_FILE" . -q
cd ..

# Clean up temp folder
rm -rf "$TEMP_FOLDER"

# Get file sizes
ORIGINAL_SIZE=$(du -sm . | cut -f1)
ZIP_SIZE=$(du -sm "$ZIP_FILE" | cut -f1)

echo ""
echo "✅ Zip file created successfully!"
echo "📁 File: $ZIP_FILE"
echo "📊 Original size: ${ORIGINAL_SIZE} MB"
echo "📊 Zip size: ${ZIP_SIZE} MB"
echo "💾 Space saved: $((ORIGINAL_SIZE - ZIP_SIZE)) MB"
echo ""
echo "📝 Excluded folders:"
echo "   - node_modules"
echo "   - dist"
echo "   - out"
echo "   - .next"
echo "   - build"
echo "   - coverage"
echo "   - .vercel"
echo "   - .git"

