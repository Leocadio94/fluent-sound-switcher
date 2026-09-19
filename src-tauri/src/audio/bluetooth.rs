//! Paired Bluetooth audio devices, via `BluetoothAPIs` (bluetoothapis.dll).
//!
//! Only devices already paired by Windows are managed here: the app can list
//! them (with their connection state) and toggle their audio services on or
//! off, which is what actually connects/disconnects the profile (A2DP,
//! hands-free, headset). Pairing new devices is left to the Windows Settings
//! flow.

use serde::Serialize;
use windows::core::GUID;
use windows::Win32::Devices::Bluetooth::{
    BluetoothEnumerateInstalledServices, BluetoothFindDeviceClose, BluetoothFindFirstDevice,
    BluetoothFindFirstRadio, BluetoothFindNextDevice, BluetoothFindNextRadio,
    BluetoothFindRadioClose, BluetoothSetServiceState, BLUETOOTH_DEVICE_INFO,
    BLUETOOTH_DEVICE_SEARCH_PARAMS, BLUETOOTH_FIND_RADIO_PARAMS, BLUETOOTH_SERVICE_DISABLE,
    BLUETOOTH_SERVICE_ENABLE,
};
use windows::Win32::Foundation::{ERROR_SERVICE_DOES_NOT_EXIST, FALSE, HANDLE, TRUE};

/// A paired Bluetooth device that exposes an audio service.
#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct BtDevice {
    /// Human-friendly name, e.g. "WH-1000XM5".
    pub name: String,
    /// Formatted MAC address, e.g. "AA:BB:CC:DD:EE:FF".
    pub mac: String,
    /// Whether the profile is currently connected to this machine.
    pub connected: bool,
    /// Whether the device also has a call/mic service (headset), not just speakers.
    pub has_microphone: bool,
}

const AUDIO_SINK: GUID = GUID::from_values(
    0x0000_110b,
    0x0000,
    0x1000,
    [0x80, 0x00, 0x00, 0x80, 0x5f, 0x9b, 0x34, 0xfb],
);
const HANDS_FREE: GUID = GUID::from_values(
    0x0000_111e,
    0x0000,
    0x1000,
    [0x80, 0x00, 0x00, 0x80, 0x5f, 0x9b, 0x34, 0xfb],
);
const HEADSET: GUID = GUID::from_values(
    0x0000_1112,
    0x0000,
    0x1000,
    [0x80, 0x00, 0x00, 0x80, 0x5f, 0x9b, 0x34, 0xfb],
);

/// Lists every paired Bluetooth device that exposes an audio service, marked
/// with the current connection state.
pub fn list_devices() -> Result<Vec<BtDevice>, String> {
    let mut devices = Vec::new();
    for_each_radio(|radio| {
        for_each_paired_device(radio, |info| {
            if !info.fAuthenticated.as_bool() {
                return true;
            }
            let services = installed_services(radio, info);
            let has_speakers = services.contains(&AUDIO_SINK);
            let has_mic = services.contains(&HANDS_FREE) || services.contains(&HEADSET);
            if has_speakers || has_mic {
                devices.push(BtDevice {
                    name: device_name(info),
                    mac: format_mac(mac_bytes(info)),
                    connected: info.fConnected.as_bool(),
                    has_microphone: has_mic,
                });
            }
            true
        });
        true
    })
    .map_err(|e| format!("Bluetooth radio enumeration failed: {e}"))?;
    Ok(devices)
}

/// Connects (or disconnects) the audio services of the paired device `mac`.
///
/// Disabling the A2DP sink is what severs the "connected but idle" state;
/// hands-free/headset services are toggled along so a headset does not stay
/// alive through its call profile.
pub fn set_connect(mac: &str, enable: bool) -> Result<(), String> {
    let target = parse_mac(mac).ok_or_else(|| format!("invalid Bluetooth MAC: {mac}"))?;
    let mut outcome: Result<(), String> = Err(format!("Bluetooth device {mac} not found"));

    let _ = for_each_radio(|radio| {
        let mut done = false;
        for_each_paired_device(radio, |info| {
            if mac_bytes(info) != target {
                return true;
            }
            outcome = toggle_services(radio, info, enable);
            done = true;
            false
        });
        !done
    });
    outcome
}

/// Toggles all audio services of `info`, succeeding if at least one profile
/// was actually switched. Unsupported services (reported as "service does not
/// exist") are skipped, since a speaker has no hands-free profile and so on.
fn toggle_services(
    radio: HANDLE,
    info: &BLUETOOTH_DEVICE_INFO,
    enable: bool,
) -> Result<(), String> {
    let flag = if enable {
        BLUETOOTH_SERVICE_ENABLE
    } else {
        BLUETOOTH_SERVICE_DISABLE
    };
    let mut any_ok = false;
    let mut first_error: Option<u32> = None;
    let mut unsupported = 0;
    for guid in [AUDIO_SINK, HANDS_FREE, HEADSET] {
        let code = unsafe { BluetoothSetServiceState(radio, info, &guid, flag) };
        match code {
            0 => any_ok = true,
            code if code == ERROR_SERVICE_DOES_NOT_EXIST.0 => unsupported += 1,
            _ => {
                log::warn!(
                    "BluetoothSetServiceState({:?}) failed with code {code}",
                    guid
                );
                if first_error.is_none() {
                    first_error = Some(code);
                }
            }
        }
    }
    if any_ok {
        return Ok(());
    }
    if let Some(code) = first_error {
        return Err(format!("BluetoothSetServiceState failed (code {code})"));
    }
    if unsupported > 0 {
        return Err("device has no audio service to toggle".to_string());
    }
    Err("BluetoothSetServiceState failed".to_string())
}

/// Runs `f` for each Bluetooth radio handle; `f` returning `false` stops the
/// walk. The find handle is always closed.
fn for_each_radio(mut f: impl FnMut(HANDLE) -> bool) -> Result<(), String> {
    unsafe {
        let params = BLUETOOTH_FIND_RADIO_PARAMS {
            dwSize: std::mem::size_of::<BLUETOOTH_FIND_RADIO_PARAMS>() as u32,
        };
        let mut radio = HANDLE::default();
        let Ok(find) = BluetoothFindFirstRadio(&params, &mut radio) else {
            return Err("no Bluetooth radio available".to_string());
        };
        while f(radio) {
            let mut next = HANDLE::default();
            if !BluetoothFindNextRadio(find, &mut next).is_ok() {
                break;
            }
            radio = next;
        }
        let _ = BluetoothFindRadioClose(find);
    }
    Ok(())
}

/// Runs `f` for each paired/remembered device on `radio`; `f` returning `false`
/// stops the walk.
fn for_each_paired_device(radio: HANDLE, mut f: impl FnMut(&BLUETOOTH_DEVICE_INFO) -> bool) {
    unsafe {
        let params = BLUETOOTH_DEVICE_SEARCH_PARAMS {
            dwSize: std::mem::size_of::<BLUETOOTH_DEVICE_SEARCH_PARAMS>() as u32,
            fReturnAuthenticated: TRUE,
            fReturnRemembered: TRUE,
            fReturnUnknown: FALSE,
            fReturnConnected: TRUE,
            fIssueInquiry: FALSE,
            cTimeoutMultiplier: 0,
            hRadio: radio,
        };
        let mut info = new_device_info();
        let Ok(find) = BluetoothFindFirstDevice(&params, &mut info) else {
            return;
        };
        let mut keep = f(&info);
        while keep {
            let mut next = new_device_info();
            if !BluetoothFindNextDevice(find, &mut next).is_ok() {
                break;
            }
            keep = f(&next);
        }
        let _ = BluetoothFindDeviceClose(find);
    }
}

/// The services (profiles) Windows has installed for the device.
fn installed_services(radio: HANDLE, info: &BLUETOOTH_DEVICE_INFO) -> Vec<GUID> {
    unsafe {
        let mut count: u32 = 0;
        BluetoothEnumerateInstalledServices(radio, info, &mut count, None);
        if count == 0 {
            return Vec::new();
        }
        let mut services = vec![GUID::zeroed(); count as usize];
        let code = BluetoothEnumerateInstalledServices(
            radio,
            info,
            &mut count,
            Some(services.as_mut_ptr()),
        );
        if code != 0 {
            log::warn!("BluetoothEnumerateInstalledServices failed with code {code}");
            return Vec::new();
        }
        services.truncate(count as usize);
        services
    }
}

fn device_name(info: &BLUETOOTH_DEVICE_INFO) -> String {
    let len = info
        .szName
        .iter()
        .position(|&c| c == 0)
        .unwrap_or(info.szName.len());
    String::from_utf16_lossy(&info.szName[..len])
}

/// The remote address bytes in display order. `rgBytes` is little-endian
/// (`rgBytes[0]` is the *last* pair of the formatted MAC), so it is reversed
/// here — verified against the `BTHENUM\DEV_<mac>` instance ids Windows shows.
fn mac_bytes(info: &BLUETOOTH_DEVICE_INFO) -> [u8; 6] {
    let bytes = unsafe { info.Address.Anonymous.rgBytes };
    [bytes[5], bytes[4], bytes[3], bytes[2], bytes[1], bytes[0]]
}

unsafe fn new_device_info() -> BLUETOOTH_DEVICE_INFO {
    BLUETOOTH_DEVICE_INFO {
        dwSize: std::mem::size_of::<BLUETOOTH_DEVICE_INFO>() as u32,
        ..Default::default()
    }
}

/// Parses a MAC formatted as `AA:BB:CC:DD:EE:FF` or `AABBCCDDEEFF`.
pub fn parse_mac(mac: &str) -> Option<[u8; 6]> {
    let cleaned: String = mac
        .chars()
        .filter(|c| *c != ':' && *c != '-' && *c != ' ')
        .collect();
    if cleaned.len() != 12 || !cleaned.chars().all(|c| c.is_ascii_hexdigit()) {
        return None;
    }
    let bytes: Result<Vec<u8>, _> = (0..6)
        .map(|i| u8::from_str_radix(&cleaned[i * 2..i * 2 + 2], 16))
        .collect();
    bytes.ok()?.try_into().ok()
}

fn format_mac(bytes: [u8; 6]) -> String {
    bytes
        .iter()
        .map(|b| format!("{b:02X}"))
        .collect::<Vec<_>>()
        .join(":")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_colon_mac() {
        assert_eq!(
            parse_mac("AA:BB:CC:DD:EE:FF"),
            Some([0xAA, 0xBB, 0xCC, 0xDD, 0xEE, 0xFF])
        );
        assert_eq!(
            parse_mac("aa:bb:cc:dd:ee:ff"),
            Some([0xAA, 0xBB, 0xCC, 0xDD, 0xEE, 0xFF])
        );
    }

    #[test]
    fn parses_plain_mac() {
        assert_eq!(
            parse_mac("AABBCCDDEEFF"),
            Some([0xAA, 0xBB, 0xCC, 0xDD, 0xEE, 0xFF])
        );
    }

    #[test]
    fn rejects_bad_mac() {
        assert_eq!(parse_mac("AA:BB"), None);
        assert_eq!(parse_mac("AABBCCDDEEFF00"), None);
        assert_eq!(parse_mac("AABBCCDDEEFG"), None);
        assert_eq!(parse_mac(""), None);
    }

    #[test]
    fn mac_roundtrip() {
        let mac = [0x01, 0x23, 0x45, 0x67, 0x89, 0xAB];
        let formatted = format_mac(mac);
        assert_eq!(formatted, "01:23:45:67:89:AB");
        assert_eq!(parse_mac(&formatted), Some(mac));
    }

    /// Live check against the machine's Bluetooth radios: run with
    /// `cargo test -- --ignored --nocapture`. CI has no radio, so it is
    /// skipped there.
    #[test]
    #[ignore]
    fn lists_real_devices() {
        let devices = list_devices().unwrap();
        println!("{devices:#?}");
    }
}
