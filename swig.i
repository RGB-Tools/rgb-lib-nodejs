%module rgblib
%{
#include "./rgb-lib/bindings/c-ffi/rgblib.hpp"
%}

%typemap(out) CResult (v8::Local<v8::Promise::Resolver> resolver) %{
    resolver = v8::Promise::Resolver::New(v8::Isolate::GetCurrent()->GetCurrentContext()).ToLocalChecked();
    switch ($1.result) {
        case CResultValue::Ok:
            resolver->Resolve(v8::Isolate::GetCurrent()->GetCurrentContext(), SWIG_NewPointerObj((new COpaqueStruct(static_cast< const COpaqueStruct& >($1.inner))), SWIGTYPE_p_COpaqueStruct, SWIG_POINTER_OWN |  0 )).Check();
            break;
        case CResultValue::Err:
            resolver->Reject(v8::Isolate::GetCurrent()->GetCurrentContext(), v8::String::NewFromUtf8(args.GetIsolate(), (const char*) $1.inner.ptr).ToLocalChecked()).Check();
            break;
    }
    $result = resolver->GetPromise();
%}

%typemap(out) CResultString (v8::Local<v8::Promise::Resolver> resolver) %{
    resolver = v8::Promise::Resolver::New(v8::Isolate::GetCurrent()->GetCurrentContext()).ToLocalChecked();
    switch ($1.result) {
        case CResultValue::Ok:
            if ($1.inner == nullptr) {
                resolver->Resolve(v8::Isolate::GetCurrent()->GetCurrentContext(), v8::Null(v8::Isolate::GetCurrent())).Check();
            } else {
                resolver->Resolve(v8::Isolate::GetCurrent()->GetCurrentContext(), v8::String::NewFromUtf8(args.GetIsolate(), (const char*) $1.inner).ToLocalChecked()).Check();
                delete ($1.inner);
            }
            break;
        case CResultValue::Err:
            resolver->Reject(v8::Isolate::GetCurrent()->GetCurrentContext(), v8::String::NewFromUtf8(args.GetIsolate(), (const char*) $1.inner).ToLocalChecked()).Check();
            break;
    }
    $result = resolver->GetPromise();
%}


%typemap(in) optional_string (const char*) {
    if ($input == v8::Null(v8::Isolate::GetCurrent())) {
        $1 = nullptr;
    } else {
        int res = SWIG_AsCharPtrAndSize($input, (char**)&$1, NULL, NULL);
        if (!SWIG_IsOK(res)) {
            SWIG_exception_fail(SWIG_ArgError(res), "in method '" "$symname" "', argument '" "$argnum""' of type '" "$type""'");
        }
    }
}

%apply optional_string {
    const char* amount_opt,
    const char* asset_id_opt,
    const char* details_opt,
    const char* duration_seconds_opt,
    const char* file_path_opt,
    const char* media_file_path_opt,
    const char* num_opt,
    const char* size_opt
};

%include "./rgb-lib/bindings/c-ffi/rgblib.hpp"
