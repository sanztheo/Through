#!/bin/bash

# Icon Converter Script for Electron
# Place your source image (at least 1024x1024 PNG) as: icon-source.png
# Then run: ./convert-icons.sh

set -e

SOURCE_IMAGE="icon-source.png"
OUTPUT_DIR="icons"

# Check if source image exists
if [ ! -f "$SOURCE_IMAGE" ]; then
    echo "❌ Error: $SOURCE_IMAGE not found!"
    echo "Please place your icon image (1024x1024 PNG) as icon-source.png"
    exit 1
fi

# Check if ImageMagick is installed
if ! command -v magick &> /dev/null && ! command -v convert &> /dev/null; then
    echo "❌ ImageMagick is not installed."
    echo "Install it with: brew install imagemagick"
    exit 1
fi

# Determine the convert command
if command -v magick &> /dev/null; then
    CONVERT="magick"
else
    CONVERT="convert"
fi

echo "🎨 Converting icon for all platforms..."

# Create output directory
mkdir -p "$OUTPUT_DIR"

# === macOS .icns ===
echo "🍎 Creating macOS icons..."
ICONSET_DIR="$OUTPUT_DIR/icon.iconset"
mkdir -p "$ICONSET_DIR"

# Generate all required sizes for macOS iconset
$CONVERT "$SOURCE_IMAGE" -resize 16x16     "$ICONSET_DIR/icon_16x16.png"
$CONVERT "$SOURCE_IMAGE" -resize 32x32     "$ICONSET_DIR/icon_16x16@2x.png"
$CONVERT "$SOURCE_IMAGE" -resize 32x32     "$ICONSET_DIR/icon_32x32.png"
$CONVERT "$SOURCE_IMAGE" -resize 64x64     "$ICONSET_DIR/icon_32x32@2x.png"
$CONVERT "$SOURCE_IMAGE" -resize 128x128   "$ICONSET_DIR/icon_128x128.png"
$CONVERT "$SOURCE_IMAGE" -resize 256x256   "$ICONSET_DIR/icon_128x128@2x.png"
$CONVERT "$SOURCE_IMAGE" -resize 256x256   "$ICONSET_DIR/icon_256x256.png"
$CONVERT "$SOURCE_IMAGE" -resize 512x512   "$ICONSET_DIR/icon_256x256@2x.png"
$CONVERT "$SOURCE_IMAGE" -resize 512x512   "$ICONSET_DIR/icon_512x512.png"
$CONVERT "$SOURCE_IMAGE" -resize 1024x1024 "$ICONSET_DIR/icon_512x512@2x.png"

# Convert to .icns (macOS only)
if command -v iconutil &> /dev/null; then
    iconutil -c icns "$ICONSET_DIR" -o "$OUTPUT_DIR/icon.icns"
    echo "✅ Created icon.icns"
else
    echo "⚠️  iconutil not found (macOS only). Skipping .icns generation."
fi

# === Windows .ico ===
echo "🪟 Creating Windows icon..."
$CONVERT "$SOURCE_IMAGE" \
    -define icon:auto-resize=16,24,32,48,64,128,256 \
    "$OUTPUT_DIR/icon.ico"
echo "✅ Created icon.ico"

# === Linux/Generic PNGs ===
echo "🐧 Creating Linux/generic PNG icons..."
$CONVERT "$SOURCE_IMAGE" -resize 16x16   "$OUTPUT_DIR/icon-16.png"
$CONVERT "$SOURCE_IMAGE" -resize 32x32   "$OUTPUT_DIR/icon-32.png"
$CONVERT "$SOURCE_IMAGE" -resize 48x48   "$OUTPUT_DIR/icon-48.png"
$CONVERT "$SOURCE_IMAGE" -resize 64x64   "$OUTPUT_DIR/icon-64.png"
$CONVERT "$SOURCE_IMAGE" -resize 128x128 "$OUTPUT_DIR/icon-128.png"
$CONVERT "$SOURCE_IMAGE" -resize 256x256 "$OUTPUT_DIR/icon-256.png"
$CONVERT "$SOURCE_IMAGE" -resize 512x512 "$OUTPUT_DIR/icon-512.png"
$CONVERT "$SOURCE_IMAGE" -resize 1024x1024 "$OUTPUT_DIR/icon-1024.png"
echo "✅ Created PNG icons"

# Cleanup iconset folder
rm -rf "$ICONSET_DIR"

echo ""
echo "✅ All icons generated successfully in ./$OUTPUT_DIR/"
echo ""
echo "Files created:"
ls -la "$OUTPUT_DIR/"
