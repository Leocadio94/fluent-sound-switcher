//! Command-line interface. The same binary is both the GUI and the CLI: when
//! launched with a recognized subcommand it runs that and exits, without
//! starting the GUI. Audio operations are global COM calls, so the CLI works
//! standalone whether or not the GUI is running.

use std::path::PathBuf;

use crate::audio;

const IDENTIFIER: &str = "com.fluentsoundswitcher.app";
const STORE_FILE: &str = "config.json";

/// If the process was invoked as a CLI command, runs it and returns the exit
/// code. Returns `None` to mean "no CLI command — launch the GUI".
pub fn run_if_cli() -> Option<i32> {
    let args: Vec<String> = std::env::args()
        .skip(1)
        .filter(|a| a != "--autostart") // GUI autostart marker, not a command
        .collect();

    let command = args.first()?;
    if !is_command(command) {
        return None;
    }

    attach_console();
    Some(run(&args))
}

fn is_command(s: &str) -> bool {
    matches!(
        s,
        "list" | "switch" | "cycle" | "mute" | "help" | "--help" | "-h" | "--version" | "-V"
    )
}

fn run(args: &[String]) -> i32 {
    match args[0].as_str() {
        "help" | "--help" | "-h" => {
            print_help();
            0
        }
        "--version" | "-V" => {
            println!("fluent-sound-switcher {}", env!("CARGO_PKG_VERSION"));
            0
        }
        "list" => cmd_list(args.get(1).map(String::as_str)),
        "switch" => cmd_switch(args.get(1).map(String::as_str)),
        "cycle" => cmd_cycle(args.get(1).map(String::as_str)),
        "mute" => cmd_mute(args.get(1).map(String::as_str)),
        _ => {
            print_help();
            2
        }
    }
}

fn cmd_list(filter: Option<&str>) -> i32 {
    let devices = match audio::list_devices() {
        Ok(d) => d,
        Err(e) => return fail(&format!("failed to list devices: {e}")),
    };
    for direction in ["output", "input"] {
        if let Some(f) = filter {
            if f != direction {
                continue;
            }
        }
        println!("{}:", direction.to_uppercase());
        for device in devices.iter().filter(|d| d.direction == direction) {
            let marker = if device.is_default { "*" } else { " " };
            let active = if device.is_default { "  [active]" } else { "" };
            println!("  {marker} {}{active}", device.name);
        }
    }
    0
}

fn cmd_switch(query: Option<&str>) -> i32 {
    let Some(query) = query else {
        return fail("usage: switch <device id or name>");
    };
    let devices = match audio::list_devices() {
        Ok(d) => d,
        Err(e) => return fail(&format!("failed to list devices: {e}")),
    };
    let needle = query.to_lowercase();
    let found = devices
        .iter()
        .find(|d| d.id == query || d.name.to_lowercase().contains(&needle));
    let Some(device) = found else {
        return fail(&format!("no device matching '{query}'"));
    };
    match audio::set_default_device(&device.id) {
        Ok(()) => {
            println!("switched {} to {}", device.direction, device.name);
            0
        }
        Err(e) => fail(&format!("failed to switch: {e}")),
    }
}

fn cmd_cycle(direction: Option<&str>) -> i32 {
    let direction = match direction {
        Some(d @ ("output" | "input")) => d,
        _ => return fail("usage: cycle <output|input>"),
    };
    let favorites = read_favorites(direction);
    match audio::cycle_default(direction, &favorites) {
        Ok(Some(device)) => {
            println!("switched {direction} to {}", device.name);
            0
        }
        Ok(None) => fail(&format!("no {direction} devices to cycle")),
        Err(e) => fail(&format!("failed to cycle: {e}")),
    }
}

fn cmd_mute(sub: Option<&str>) -> i32 {
    let result = match sub.unwrap_or("toggle") {
        "toggle" => audio::toggle_mic_mute(),
        "on" => audio::set_mic_mute(true).map(|()| true),
        "off" => audio::set_mic_mute(false).map(|()| false),
        other => {
            return fail(&format!(
                "unknown mute option '{other}' (use toggle|on|off)"
            ))
        }
    };
    match result {
        Ok(muted) => {
            println!("microphone {}", if muted { "muted" } else { "unmuted" });
            0
        }
        Err(e) => fail(&format!("failed to set mute: {e}")),
    }
}

fn read_favorites(direction: &str) -> Vec<String> {
    let Some(path) = store_path() else {
        return Vec::new();
    };
    std::fs::read_to_string(path)
        .ok()
        .and_then(|s| serde_json::from_str::<serde_json::Value>(&s).ok())
        .and_then(|v| {
            v.get("favorites")
                .and_then(|f| f.get(direction))
                .and_then(|a| a.as_array())
                .map(|arr| {
                    arr.iter()
                        .filter_map(|x| x.as_str().map(String::from))
                        .collect()
                })
        })
        .unwrap_or_default()
}

fn store_path() -> Option<PathBuf> {
    std::env::var_os("APPDATA")
        .map(|appdata| PathBuf::from(appdata).join(IDENTIFIER).join(STORE_FILE))
}

fn fail(message: &str) -> i32 {
    eprintln!("error: {message}");
    1
}

fn print_help() {
    println!(
        "Fluent Sound Switcher {}\n\n\
         Usage: fluent-sound-switcher <command>\n\n\
         Commands:\n\
         \x20 list [output|input]      List audio devices (active default marked with *)\n\
         \x20 switch <id|name>         Set the default device (matches id or name substring)\n\
         \x20 cycle <output|input>     Switch to the next favorite device\n\
         \x20 mute [toggle|on|off]     Control the microphone mute (default: toggle)\n\
         \x20 --version                Print the version\n\
         \x20 --help                   Show this help\n\n\
         With no command, the GUI is launched.",
        env!("CARGO_PKG_VERSION")
    );
}

#[cfg(windows)]
fn attach_console() {
    use windows::Win32::System::Console::{AttachConsole, ATTACH_PARENT_PROCESS};
    unsafe {
        let _ = AttachConsole(ATTACH_PARENT_PROCESS);
    }
}

#[cfg(not(windows))]
fn attach_console() {}
