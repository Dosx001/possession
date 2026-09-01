#!/bin/bash

if [[ -x magick ]]; then
  echo "magick is not installed"
  exit 0
fi

dir_pos="extension/possession/public"
dir_night="extension/nightmare/public"

if [[ ! -d $dir_pos ]]; then
  mkdir -p $dir_pos
fi

if [[ ! -d $dir_night ]]; then
  mkdir -p $dir_night
fi

for size in 32 48 64 128; do
  magick -background none -density 200 assets/logo.svg \
    -resize ${size}x${size} $dir_pos/${size}.png
  magick -background none -density 200 assets/nightmare.svg \
    -resize ${size}x${size} $dir_night/${size}.png
done
