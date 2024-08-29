# RGB Lib Node.js bindings

[![npm version](https://badge.fury.io/js/rgb-lib.svg)](https://badge.fury.io/js/rgb-lib)

This project builds a Node.js package, for the [rgb-lib] Rust library, which is
included as a git submodule. The bindings are created using the
[rgb-lib C++ bindings], which are located inside the rgb-lib submodule, and
[Swig].

## Usage

First install the package:
```sh
npm install rgb-lib
```

Then import it as:
```javascript
const rgblib = require("rgb-lib");
```

> :warning: **Warning: memory will be leaked if not taken care of manually**
>
> Check the example to see how you can manually avoid memory leaks

## Contributing

### Build

In order to build Node.js bindings, first clone the project
(`git clone https://github.com/RGB-Tools/rgb-lib-nodejs --recurse-submodules`),
enter the project root (`cd rgb-lib-nodejs`) and finally follow the [In
docker](#in-docker) or [Local](#local) instructions.

The procedure will internally build [rgb-lib C++ bindings] and use them to
generate the Node.js ones.

Both instructions will generate the following files:
- `librgblibcffi.so` in `rgb-lib/bindings/c-ffi/target/debug/`
- `rgblib.hpp` in `rgb-lib/bindings/c-ffi/`
- `swig_wrap.cxx` in the project root

#### In docker

- install dependencies: docker
- from the project root, run:
```sh
npm run docker-build
```

As a tip, to speed up development builds you can add the following volumes in
the compose file:
```
      - ./docker-registry-cache:/usr/local/cargo/registry
      - ./docker-target-cache:/rgb-lib-nodejs/rgb-lib/bindings/c-ffi/target
```

#### Local

- install dependencies: Node.js v18, Swig 4.1
- from the project root, run:
```sh
npm run build
```

### Run the example

To try the generated library, build the package then, from the project root,
run:
```sh
npm install
mkdir data
npm run regtest_start  # to start regtest services
node example.js
npm run regtest_stop  # to stop regtest services
```

### Format

To format the code, install the package then, from the project root, run:
```sh
npm run format
```

### Publish

To publish the package on the npm registry, from the project root, run:
```sh
npm run docker-build
npm publish
```


[Swig]: https://github.com/swig/swig
[build and pack]: #build-and-pack
[rgb-lib C++ bindings]: https://github.com/RGB-Tools/rgb-lib/tree/master/bindings/c-ffi
[rgb-lib]: https://github.com/RGB-Tools/rgb-lib
