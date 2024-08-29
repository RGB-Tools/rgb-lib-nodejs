#!/usr/bin/env bash

files=(
    "rgb-lib/bindings/c-ffi/rgblib.hpp"
    "rgb-lib/bindings/c-ffi/target/debug/librgblibcffi.so"
    "swig_wrap.cxx"
)

for f in "${files[@]}"; do
    mkdir -p "$(dirname "$f")"
    src=docker-data/$(basename "$f")
    cp "$src" "$f"
done
