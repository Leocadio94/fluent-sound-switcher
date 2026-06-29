// Prevents an additional console window on Windows in release builds. The CLI
// path attaches to the parent console at runtime when needed (see `cli`).
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Handle CLI subcommands without launching the GUI.
    if let Some(code) = fluent_sound_switcher_lib::cli::run_if_cli() {
        std::process::exit(code);
    }
    fluent_sound_switcher_lib::run()
}
