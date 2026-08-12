#!/bin/bash

if [[ -x magick ]]; then
  echo "magick is not installed"
  exit 0
fi

if [[ ! -d extension/public ]]; then
  mkdir extension/public
fi

for size in 32 48 64 128; do
  magick -background none -density 200 assets/logo.svg \
    -resize ${size}x${size} extension/public/${size}.png
done
