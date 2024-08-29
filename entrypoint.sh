#!/usr/bin/env bash

npm run build

files=(
    "rgb-lib/bindings/c-ffi/rgblib.hpp"
    "rgb-lib/bindings/c-ffi/target/debug/librgblibcffi.so"
    "swig_wrap.cxx"
)

for f in "${files[@]}"; do
    target=/opt/mount/$(basename "$f")
    cp "$f" "$target"
    chmod a+w "$target"
done
