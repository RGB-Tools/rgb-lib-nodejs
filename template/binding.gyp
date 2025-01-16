{
  "targets": [
    {
      "target_name": "rgblib",
      "sources": [ "swig_wrap.cxx" ],
      "cflags!": [ "-fno-exceptions" ],
      "cflags_cc!": [ "-fno-exceptions" ],
      "conditions": [
        [
          "OS!='win'",
          {
            "library_dirs": [
              "<(module_root_dir)/rgb-lib/bindings/c-ffi/target/%TARGET%/release/",
            ],
            "libraries": [
              "-lrgblibcffi",
              "-Wl,-rpath,<(module_root_dir)/rgb-lib/bindings/c-ffi/target/%TARGET%/release/",
            ],
          },
          "OS=='win'",
          {
            "libraries": [
              "<(module_root_dir)/rgb-lib/bindings/c-ffi/target/%TARGET%/release/rgblibcffi.lib"
            ],
            "copies": [
              {
                "destination": "<(module_root_dir)/build/Release/",
                "files": [
                  "<(module_root_dir)/rgb-lib/bindings/c-ffi/target/%TARGET%/release/rgblibcffi.dll"
                ]
              }
            ]
          }
        ]
      ]
    }
  ]
}
