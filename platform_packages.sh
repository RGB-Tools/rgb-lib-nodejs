#!/usr/bin/env bash
#
# build platform-specific packages

set -e

PLATFORM_DIR="platforms"
TEMPLATE_DIR="template"
CROSS_COMMIT="43a1220"
CROSS_TOOLCHAIN_COMMIT="d139724"
OSX_VERSION="12.3"

declare -A TARGETS
TARGETS["linux-x64"]="x86_64-unknown-linux-gnu"
TARGETS["linux-arm64"]="aarch64-unknown-linux-gnu"
TARGETS["darwin-x64"]="x86_64-apple-darwin"
TARGETS["darwin-arm64"]="aarch64-apple-darwin"
TARGETS["win32-x64"]="x86_64-pc-windows-gnu"

_die() {
    echo "ERR: $*"
    exit 1
}

_detect_platform() {
    echo "detecting current host platform"
    OS=$(node -e 'const os = require("os"); console.log(os.platform());')
    CPU=$(node -e 'const os = require("os"); console.log(os.arch());')
}

_detect_version() {
    echo "detecting package version"
    VERSION="$(jq -r '.version' package.json)"
}

_reset_cross() {
    local clean="$1"
    git reset --hard $CROSS_COMMIT
    pushd docker/cross-toolchains
    git reset --hard $CROSS_TOOLCHAIN_COMMIT
    popd
    if [ -n "$clean" ]; then
        (git submodule update)
    fi
}

_patch_base_image_version() {
    # patch base ubuntu image version
    for f in docker/Dockerfile* docker/cross-toolchains/docker/Dockerfile.* src/docker/shared.rs; do
        sed -i \
            -e 's/ubuntu:20/ubuntu:22/' \
            "$f"
    done
    # patch linux-image.sh for updated ubuntu
    sed -i \
        -e 's/kversion=5.10.0-26/kversion=6.1.0-37/' \
        -e 's/bullseye/bookworm/' \
        -e 's/archive-key-{7.0,8,9,10,11}/archive-key-12/' \
        -e 's/release-{7,8,9,10,11}/release-12/' \
        -e 's/archive_{2020,2021,2022,2023,2024}/archive_2025/' \
        docker/linux-image.sh
    # patch wine version for updated ubuntu
    sed -i \
        -e 's/version="9.0.0.0~focal-1"/version="10.0.0.0~jammy-1"/' \
        -e 's/focal/jammy/g' \
        docker/wine.sh
}

_build_cross_image() {
    local target="$1"

    pushd cross

    _reset_cross
    _patch_base_image_version

    cargo build-docker-image "$target" --tag local

    if [ -z "$KEEP" ]; then
        _reset_cross 1
    fi

    popd
}

_build_cross_image_darwin() {
    local target="$1"

    pushd cross

    _reset_cross
    _patch_base_image_version

    # patch darwin scripts
    sed -i \
        -e "s/OSX_VERSION_MIN=10.7/OSX_VERSION_MIN=$OSX_VERSION/" \
        docker/cross-toolchains/docker/darwin.sh
    sed -i \
        -e 's#-fuse-ld=#-fuse-ld=/opt/osxcross/bin/#' \
        docker/cross-toolchains/docker/darwin-entry.sh

    MACOS_SDK_URL="https://github.com/joseluisq/macosx-sdks/releases/download/$OSX_VERSION/MacOSX$OSX_VERSION.sdk.tar.xz"
    cargo build-docker-image "$target-cross" --tag local --build-arg "MACOS_SDK_URL=$MACOS_SDK_URL"

    if [ -z "$KEEP" ]; then
        _reset_cross 1
    fi

    popd
}

_build_package() {
    local os="$1"
    local cpu="$2"

    local filename ext platform platform_dir target
    filename="librgblibcffi"
    platform="$os-$cpu"
    platform_dir="$PLATFORM_DIR/$platform"
    target=${TARGETS[$platform]}
    [ -z "$target" ] && _die "unsupported platform \"$os-$cpu\""
    echo
    echo
    echo "================================================"
    echo "building for $platform ($target)"
    echo "================================================"
    echo

    case $os in
        linux)
            ext="so"
            _build_cross_image "$target"
            ;;
        darwin)
            ext="dylib"
            _build_cross_image_darwin "$target"
            ;;
        win32)
            filename="rgblibcffi"
            ext="dll"
            _build_cross_image "$target"
            ;;
        *)
            _die "unsupprted OS: $os"
            ;;
    esac

    # platform files initial setup
    if [ -z "$KEEP" ]; then
        # clear platform data then setup template files and rgb-lib submodule
        rm -rf "$platform_dir"
        mkdir -p "$PLATFORM_DIR"
        cp -a $TEMPLATE_DIR "$platform_dir"
        cp -a rgb-lib "$platform_dir/"
    else
        # only sync template files, keeping everything else as it is
        [ -d "$platform_dir" ] || _die "missing template dir, cannot sync"
        rsync -av $TEMPLATE_DIR/ "$platform_dir/"
    fi

    # configure cross
    cp Cross.toml "$platform_dir/rgb-lib/bindings/c-ffi/"

    # set platform-specific bits in binding.gyp
    sed -i \
        -e "s/%TARGET%/$target/" \
        "$platform_dir/binding.gyp"

    # set platform-specific bits and version in package.json
    _detect_version
    sed -i \
        -e "s/%PLATFORM%/$platform/" \
        -e "s/%OS%/$os/" \
        -e "s/%CPU%/$cpu/" \
        -e "s/%FILENAME%/$filename/" \
        -e "s/%EXTENSION%/$ext/" \
        -e "s/%TARGET%/$target/" \
        -e "s/%VERSION%/$VERSION/" \
        "$platform_dir/package.json"

    # set platform-specific bits in README.md
    sed -i \
        -e "s/%OS%/$os/" \
        -e "s/%CPU%/$cpu/" \
        "$platform_dir/README.md"

    # build
    pushd "$platform_dir"
    npm run build
    case $os in
        win32)
            pushd "rgb-lib/bindings/c-ffi/target/$target/release"
            gendef rgblibcffi.dll
            /usr/x86_64-w64-mingw32/bin/dlltool -d rgblibcffi.def -l rgblibcffi.lib
            popd
            ;;
    esac
    popd
}

_publish_package() {
    local os="$1"
    local cpu="$2"

    local platform platform_dir target
    platform="$os-$cpu"
    platform_dir="$PLATFORM_DIR/$platform"
    target=${TARGETS[$platform]}
    [ -z "$target" ] && _die "unsupported platform \"$os-$cpu\""
    echo "publishing package for $platform ($target)"

    pushd "$platform_dir"
    npm publish --access public
    popd
}

# package builds
_build() {
    case "$1" in
        "")
            _detect_platform
            _build_package "$OS" "$CPU"
            ;;
        all)
            echo "building for all platforms"
            _build_package "linux" "x64"
            _build_package "linux" "arm64"
            _build_package "darwin" "x64"
            _build_package "darwin" "arm64"
            _build_package "win32" "x64"
            ;;
        *)
            echo "building for the specified platform"
            _build_package "$1" "$2"
            ;;
    esac
}

# local platform package installation
_install() {
    local platform_dir
    _detect_platform
    echo "installing package for $OS-$CPU"
    platform_dir="$PLATFORM_DIR/$OS-$CPU"
    _detect_version
    pushd "$platform_dir"
    npm pack
    popd
    npm install --no-save "$platform_dir/rgb-tools-rgb-lib-$OS-$CPU-$VERSION.tgz"
}

# package publishing
_publish() {
    case "$1" in
        all)
            echo "publishing packages for all platforms"
            _publish_package "linux" "x64"
            _publish_package "linux" "arm64"
            _publish_package "darwin" "x64"
            _publish_package "darwin" "arm64"
            _publish_package "win32" "x64"
            ;;
        *)
            echo "publishing the package for the specified platform"
            _publish_package "$1" "$2"
            ;;
    esac
}

_help() {
    echo "$(basename "$0") [build|install|publish] [<OS> <CPU>|all|]"
    echo ""
    echo "commands:"
    echo "    build          build the native library for the specifed platform(s)"
    echo "    install        installs the package for the current host platform"
    echo "    publish        publish the package for the specified platform(s)"
    echo ""
    echo "arguments:"
    echo "    build          none: build for the current host platform"
    echo "                   <OS> and <CPU>: build for the specifed platform"
    echo "                   \"all\": build for all supported platforms"
    echo "    install        takes no arguments"
    echo "    publish        <OS> and <CPU>: publish the package for the specifed platform"
    echo "                   \"all\": publish the packages for all supported platforms"
}

case $1 in
    build)
        _build "$2" "$3"
        ;;
    install)
        _install
        ;;
    publish)
        _publish "$2" "$3"
        ;;
    *)
        _help
        ;;
esac
