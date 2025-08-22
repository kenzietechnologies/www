#!/usr/bin/env bash
set -euo pipefail

# generate_favicons.sh
# Generate a set of favicon files from a source image (JPEG/PNG).
# Usage:
#   ./scripts/generate_favicons.sh [source-image] [output-dir]
# Defaults:
#   source-image: public/ktech-icon.jpeg
#   output-dir: public/

SRC=${1:-public/ktech-icon.jpeg}
OUT_DIR=${2:-public}

if [ ! -f "$SRC" ]; then
  echo "Source image not found: $SRC"
  exit 1
fi

mkdir -p "$OUT_DIR"

echo "Using source: $SRC"
echo "Writing favicons to: $OUT_DIR"

have_convert=0
have_sips=0
if command -v convert >/dev/null 2>&1; then
  have_convert=1
fi
if command -v sips >/dev/null 2>&1; then
  have_sips=1
fi

resize_with_convert() {
  local src=$1 size=$2 out=$3
  convert "$src" -resize ${size}x${size}^ -gravity center -extent ${size}x${size} -strip "$out"
}

resize_with_sips() {
  local src=$1 size=$2 out=$3
  # sips preserves aspect ratio; create temporary then pad via convert if available
  sips -z $size $size "$src" --out "$out" >/dev/null
}

sizes=(16 32 48 64 96 128 144 152 167 180 192 196 256 384 512)

echo "Generating PNGs..."
for s in "${sizes[@]}"; do
  out="$OUT_DIR/favicon-${s}.png"
  if [ "$have_convert" -eq 1 ]; then
    resize_with_convert "$SRC" "$s" "$out"
  elif [ "$have_sips" -eq 1 ]; then
    resize_with_sips "$SRC" "$s" "$out"
  else
    echo "Neither ImageMagick (convert) nor sips available; cannot generate $out"
    exit 2
  fi
  printf "."
done
echo " done"

# Specific well-known filenames
cp -f "$OUT_DIR/favicon-32.png" "$OUT_DIR/favicon-32x32.png" || true
cp -f "$OUT_DIR/favicon-16.png" "$OUT_DIR/favicon-16x16.png" || true
cp -f "$OUT_DIR/favicon-180.png" "$OUT_DIR/apple-touch-icon.png" || true

echo "Generating Android / webmanifest icons..."
cp -f "$OUT_DIR/favicon-192.png" "$OUT_DIR/android-chrome-192x192.png" || true
cp -f "$OUT_DIR/favicon-512.png" "$OUT_DIR/android-chrome-512x512.png" || true

# Create multi-resolution ICO if ImageMagick is available
if [ "$have_convert" -eq 1 ]; then
  echo -n "Creating favicon.ico..."
  # Use commonly supported sizes for ICO
  convert "$OUT_DIR/favicon-16.png" "$OUT_DIR/favicon-32.png" "$OUT_DIR/favicon-48.png" "$OUT_DIR/favicon-64.png" "$OUT_DIR/favicon.ico"
  echo " done"
else
  echo "ImageMagick not found; skipping favicon.ico generation. Install imagemagick to enable .ico creation."
fi

echo "All done. Files written to: $OUT_DIR"

echo "You may want to add/update your <head> links in index.html, e.g."
echo "  <link rel=\"icon\" type=\"image/png\" sizes=\"32x32\" href=\"/public/favicon-32x32.png\">"

exit 0
