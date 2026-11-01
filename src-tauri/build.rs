fn main() {
  // Windows: embed our own manifest instead of tauri-build's Common-Controls-only default.
  //
  // GNU ld injects a default manifest into every PE it links and offers no flag to suppress it, so the exe ends up with
  // two RT_MANIFEST entries at id 1 and ld warns about the merge. Windows loads the *first* one, which is the one
  // embedded from this crate — so `app.manifest` has to be the union of what tauri-build ships and what ld would have
  // provided (longPathAware, asInvoker). D-053 records the measurement and why the warning is expected but harmless.
  #[cfg(windows)]
  {
    let attributes = tauri_build::Attributes::new()
      .windows_attributes(tauri_build::WindowsAttributes::new().app_manifest(include_str!("app.manifest")));
    if let Err(error) = tauri_build::try_build(attributes) {
      panic!("tauri-build failed: {error}");
    }
  }

  #[cfg(not(windows))]
  tauri_build::build()
}
