# RGB Lib Node.js bindings development

## Build

In order to build the bindings, clone the project (`git clone
https://github.com/RGB-Tools/rgb-lib-nodejs --recurse-submodules`), enter the
project root (`cd rgb-lib-nodejs`) and follow the next instructions.

Always make sure the submodule is up-to-date:

```shell
git submodule update --init --recursive
```

The procedure will build the [rgb-lib C++ bindings] using [cross] (submodule,
with some changes), which will be used to generate the native Node.js addon
upon installation on the target system.

The following platforms are supported:

- linux-x64
- linux-arm64
- darwin-x64
- darwin-arm64
- win32-x64

Each platform needs a different setup (native library name, node-gyp
configuration, etc.) which is taken care of via the `platform_packakes.sh` bash
script. Platform-specific packages are built inside the `platforms` directory,
where each one uses a directory named `<OS>-<arch>` (e.g.
`platforms/linux-x64`).

The build process will generate the following files (paths relative to the
native package):

- the native library in `rgb-lib/bindings/c-ffi/target/<target-triple>/release/`
- `rgblib.hpp` in `rgb-lib/bindings/c-ffi/`
- `swig_wrap.cxx` in the root directory

### Requirements

General:

- [Docker]
- [cargo]
- [cross] (`cargo install cross`)

Windows only:

- dlltool (binutils-mingw-w64-x86-64)
- gendef (mingw-w64-tools)

### Procedure

To build the package for the current host platform, from the project root run:

```sh
./platform_packages.sh build
```

To build the packages for all the supported platforms, from the project root
run:

```sh
./platform_packages.sh build all
```

To build the packages for a specific platforms (e.g. linux-arm64), from the
project root run:

```sh
./platform_packages.sh build linux arm64
```

## Install

To install the main package, from the project root run:

```sh
npm install
```

To install the package for the current host platform, from the project root
run:

```sh
./platform_packages.sh install
```

## Run the example

To try the bindings, first build the native package for the current host
platform and install it, then from the project root run:

```sh
mkdir data
npm run regtest_start   # to start regtest services
node example.js
npm run regtest_stop    # to stop regtest services
```

## Format

To format the code, install the package then, from the project root, run:

```sh
npm run format
```

## Version update

To update the version of the main package use `npm version`.
```sh
npm version --no-git-tag-version <new_version>
```

The postversion script will take care of updating versions for all
`optionalDependencies`.

The version for the native packages ia automatically set by the
`platform_packages.sh` script (to the version of the main package) when setting
them up for the build.

## Publish

To publish all the platform-specific packages to the npm registry, from the
root of the project, run:

```sh
./platform_packages.sh publish all
```

To publish the main package to the npm registry, from the root of the project,
run:

```sh
npm publish
```

[Docker]: https://docs.docker.com/engine/install/
[Swig]: https://github.com/swig/swig
[cargo]: https://github.com/rust-lang/cargo
[cross]: https://github.com/cross-rs/cross
[rgb-lib C++ bindings]: https://github.com/RGB-Tools/rgb-lib/tree/master/bindings/c-ffi
