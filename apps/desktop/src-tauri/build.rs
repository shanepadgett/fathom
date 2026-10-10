fn main() {
    // Declaring the app's commands makes Tauri check every call against a
    // capability, so pages can reach `browser` and `browser_message` only
    // where one grants it.
    tauri_build::try_build(
        tauri_build::Attributes::new().app_manifest(
            tauri_build::AppManifest::new().commands(&["browser", "browser_message"]),
        ),
    )
    .expect("failed to run the Tauri build script");
}
