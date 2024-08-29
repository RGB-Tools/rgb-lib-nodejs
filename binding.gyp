{
  "targets": [
    {
      "target_name": "rgblib",
      "sources": [ "swig_wrap.cxx" ],
      "cflags!": [ "-fno-exceptions" ],
      "cflags_cc!": [ "-fno-exceptions" ],
      "libraries": [
           '-lrgblibcffi',
           '-Wl,-rpath=<(module_root_dir)/rgb-lib/bindings/c-ffi/target/debug/',
       ],
      "library_dirs": [
          "<(module_root_dir)/rgb-lib/bindings/c-ffi/target/debug/",
      ],
    }
  ]
}
