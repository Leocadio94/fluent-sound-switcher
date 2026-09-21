//! Paired Bluetooth audio devices.
//!
//! Listing comes from `BluetoothAPIs` (bluetoothapis.dll); connect/disconnect
//! goes through the audio endpoint's device topology and the driver's
//! `KSPROPSETID_BtAudio` one-shot property — the same mechanism Windows' own
//! connect button uses. `BluetoothSetServiceState` stays only as a fallback:
//! its DISABLE *uninstalls* the service, which removes the device from the
//! paired-services list and makes reconnection unreliable.
//!
//! Pairing new devices is left to the Windows Settings flow.

use serde::Serialize;
use windows::core::{Interface, GUID, PCWSTR};
use windows::Win32::Devices::Bluetooth::{
    BluetoothEnumerateInstalledServices, BluetoothFindDeviceClose, BluetoothFindFirstDevice,
    BluetoothFindFirstRadio, BluetoothFindNextDevice, BluetoothFindNextRadio,
    BluetoothFindRadioClose, BluetoothSetServiceState, BLUETOOTH_DEVICE_INFO,
    BLUETOOTH_DEVICE_SEARCH_PARAMS, BLUETOOTH_FIND_RADIO_PARAMS, BLUETOOTH_SERVICE_DISABLE,
    BLUETOOTH_SERVICE_ENABLE,
};
use windows::Win32::Devices::FunctionDiscovery::PKEY_Device_FriendlyName;
use windows::Win32::Foundation::{ERROR_SERVICE_DOES_NOT_EXIST, FALSE, HANDLE, TRUE};
use windows::Win32::Media::Audio::{
    eCapture, eRender, IDeviceTopology, IMMDevice, IMMDeviceEnumerator, IPart, MMDeviceEnumerator,
    DEVICE_STATE,
};
use windows::Win32::Media::KernelStreaming::{
    IKsControl, KSPROPSETID_BtAudio, KSIDENTIFIER, KSPROPERTY_ONESHOT_DISCONNECT,
    KSPROPERTY_ONESHOT_RECONNECT, KSPROPERTY_TYPE_GET,
};
use windows::Win32::System::Com::{CoCreateInstance, CoTaskMemFree, CLSCTX_ALL, STGM_READ};

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

/// What the backend reports about Bluetooth in one shot: `available` is false
/// when the machine has no radio (the frontend hides the whole feature), and
/// `devices` is the paired-audio list otherwise.
#[derive(Serialize, Clone, Debug, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct BtSnapshot {
    /// Whether a Bluetooth radio is present and enumerable.
    pub available: bool,
    /// Paired devices whose class of device is audio, with the current
    /// connection state.
    pub devices: Vec<BtDevice>,
}

/// Lists every paired Bluetooth device of the audio class, marked with the
/// current connection state.
///
/// The audio class comes from the **class of device**, not from the installed
/// services: disabling a service *uninstalls* it (`BluetoothSetServiceState`
/// semantics), so a device the app disconnected no longer reports the A2DP
/// service and would vanish from the list, making reconnection impossible.
pub fn list_devices() -> BtSnapshot {
    let mut devices = Vec::new();
    let available = for_each_radio(|radio| {
        for_each_paired_device(radio, |info| {
            if !info.fAuthenticated.as_bool() || !is_audio_device(info) {
                return true;
            }
            let services = installed_services(radio, info);
            devices.push(BtDevice {
                name: device_name(info),
                mac: format_mac(mac_bytes(info)),
                connected: info.fConnected.as_bool(),
                has_microphone: services.contains(&HANDS_FREE) || services.contains(&HEADSET),
            });
            true
        });
        true
    })
    .is_ok();
    BtSnapshot { available, devices }
}

/// Class of device: major device class 4 is Audio/Video; major service classes
/// include audio (bit 21, 0x200000) and rendering (bit 18, 0x040000).
fn is_audio_device(info: &BLUETOOTH_DEVICE_INFO) -> bool {
    let cod = info.ulClassofDevice;
    (cod >> 8) & 0x1F == 4 || cod & 0x0024_0000 != 0
}

/// Connects (or disconnects) the audio profiles of the paired device `mac`.
///
/// Primary path: the one-shot BT-audio KS property on the device's audio
/// endpoint driver — Windows' own connect mechanism, which leaves the paired
/// services installed. Falls back to the `BluetoothSetServiceState` toggle
/// when no endpoint topology is reachable.
///
/// Connecting is polled until the flag settles (two consecutive reads): the
/// one-shot returns before the profile negotiation ends, and devices fresh
/// off a disconnect often ignore the first attempt — so a connect that did
/// not settle is retried once before failing.
pub fn set_connect(mac: &str, enable: bool) -> Result<(), String> {
    let target = parse_mac(mac).ok_or_else(|| format!("invalid Bluetooth MAC: {mac}"))?;
    let paired = list_devices();
    let device = paired
        .devices
        .iter()
        .find(|d| parse_mac(&d.mac) == Some(target))
        .ok_or_else(|| format!("Bluetooth device {mac} not found"))?;
    let name = device.name.clone();

    let controls = unsafe { bt_ks_controls(&name) };
    if controls.is_empty() {
        log::warn!("no BT audio topology for {name}; using the service-state fallback");
        return set_connect_via_services(mac, enable);
    }
    let controls = dedupe_controls(controls);

    let oneshot = if enable {
        KSPROPERTY_ONESHOT_RECONNECT
    } else {
        KSPROPERTY_ONESHOT_DISCONNECT
    };

    let request = |controls: &[IKsControl]| -> bool {
        let mut property = KSIDENTIFIER::default();
        property.Anonymous.Anonymous.Set = KSPROPSETID_BtAudio;
        property.Anonymous.Anonymous.Id = oneshot.0 as u32;
        property.Anonymous.Anonymous.Flags = KSPROPERTY_TYPE_GET;

        let mut failures = 0;
        for control in controls {
            let mut returned = 0u32;
            let result = unsafe {
                control.KsProperty(
                    &property,
                    std::mem::size_of::<KSIDENTIFIER>() as u32,
                    std::ptr::null_mut(),
                    0,
                    &mut returned,
                )
            };
            if let Err(e) = result {
                log::warn!("KsProperty(oneshot) failed: {e}");
                failures += 1;
            }
        }
        failures < controls.len()
    };

    if !request(&controls) {
        return Err("the Bluetooth driver rejected the connect/disconnect request".to_string());
    }
    if !enable {
        return Ok(());
    }
    for _ in 0..2 {
        if wait_until_connected(mac, true) {
            return Ok(());
        }
        // The first attempt is sometimes swallowed right after a disconnect:
        // retry the one-shot once before giving up.
        log::warn!("connect to {name} did not settle; retrying once");
        if !request(&controls) {
            return Err("the Bluetooth driver rejected the connect/disconnect request".to_string());
        }
    }
    Err(format!(
        "{name} did not connect (it may be off, in its case, or connected elsewhere)"
    ))
}

/// Drops controls reached through more than one endpoint (a headset's render
/// and capture endpoints can lead to the same filter).
fn dedupe_controls(controls: Vec<IKsControl>) -> Vec<IKsControl> {
    let mut controls = controls;
    controls.sort_by_key(|c| c.as_raw() as usize);
    controls.dedup_by_key(|c| c.as_raw() as usize);
    controls
}

/// Polls the paired-device connection flag until it has been `expected` for
/// two consecutive checks (~1 s of stability), up to ~5 s: the flag flaps
/// while profiles negotiate, so a single observation is not trustworthy.
fn wait_until_connected(mac: &str, expected: bool) -> bool {
    let mut stable = 0;
    for _ in 0..10 {
        std::thread::sleep(std::time::Duration::from_millis(500));
        let now = list_devices()
            .devices
            .iter()
            .find(|d| d.mac == mac)
            .is_some_and(|d| d.connected == expected);
        stable = if now { stable + 1 } else { 0 };
        if stable >= 2 {
            return true;
        }
    }
    false
}

/// The `IKsControl` of the Bluetooth audio filter behind every audio endpoint
/// (render and capture) that belongs to the paired device named `name`.
unsafe fn bt_ks_controls(name: &str) -> Vec<IKsControl> {
    super::ensure_com();
    let mut controls = Vec::new();
    unsafe {
        let Ok(enumerator) =
            CoCreateInstance::<_, IMMDeviceEnumerator>(&MMDeviceEnumerator, None, CLSCTX_ALL)
        else {
            return controls;
        };
        for flow in [eRender, eCapture] {
            let Ok(collection) =
                enumerator.EnumAudioEndpoints(flow, DEVICE_STATE(super::enumerator::LISTED_STATES))
            else {
                continue;
            };
            let Ok(count) = collection.GetCount() else {
                continue;
            };
            for i in 0..count {
                let Ok(device) = collection.Item(i) else {
                    continue;
                };
                let matches = device
                    .OpenPropertyStore(STGM_READ)
                    .ok()
                    .and_then(|store| store.GetValue(&PKEY_Device_FriendlyName).ok())
                    .and_then(|prop| super::enumerator::propvariant_to_string(&prop))
                    .and_then(|friendly| paired_name_of(&friendly).map(str::to_string))
                    .is_some_and(|n| n == name);
                if !matches {
                    continue;
                }
                controls.extend(endpoint_ks_controls(&enumerator, &device));
            }
        }
    }
    controls
}

/// Walks the endpoint's device topology down to the Bluetooth audio filter and
/// collects its `IKsControl`.
unsafe fn endpoint_ks_controls(
    enumerator: &IMMDeviceEnumerator,
    device: &IMMDevice,
) -> Vec<IKsControl> {
    let mut controls = Vec::new();
    let Ok(topology) = device.Activate::<IDeviceTopology>(CLSCTX_ALL, None) else {
        return controls;
    };
    let Ok(connector_count) = topology.GetConnectorCount() else {
        return controls;
    };
    for i in 0..connector_count {
        let Ok(connector) = topology.GetConnector(i) else {
            continue;
        };
        let Ok(other) = connector.GetConnectedTo() else {
            continue;
        };
        let Ok(part) = other.cast::<IPart>() else {
            continue;
        };
        let Ok(other_topology) = part.GetTopologyObject() else {
            continue;
        };
        let Ok(device_id) = other_topology.GetDeviceId() else {
            continue;
        };
        if device_id.is_null() {
            continue;
        }
        let id = device_id.to_string();
        // `{2}.\\?\bth…` covers both the BTHENUM and BTHHFENUM audio filters.
        let is_bt = id
            .as_deref()
            .map(|s| s.starts_with(BT_FILTER_ID))
            .unwrap_or(false);
        if is_bt {
            if let Ok(filter) = enumerator.GetDevice(PCWSTR(device_id.0)) {
                if let Ok(control) = filter.Activate::<IKsControl>(CLSCTX_ALL, None) {
                    controls.push(control);
                }
            }
        }
        CoTaskMemFree(Some(device_id.0 as *const core::ffi::c_void));
    }
    controls
}

/// The device-id prefix of a Bluetooth audio KS filter (BTHENUM/BTHHFENUM).
const BT_FILTER_ID: &str = r#"{2}.\\?\bth"#;

/// The Bluetooth device's own name inside an endpoint friendly name — the
/// part in parentheses, e.g. "Fones de ouvido (Soundcore Life Q30)".
fn paired_name_of(friendly: &str) -> Option<&str> {
    let close = friendly.rfind(')')?;
    let open = friendly[..close].rfind('(')?;
    Some(&friendly[open + 1..close])
}

/// Fallback connect/disconnect via `BluetoothSetServiceState`. Used only when
/// no endpoint topology is reachable; its DISABLE *uninstalls* the service,
/// which is why it is not the primary path.
fn set_connect_via_services(mac: &str, enable: bool) -> Result<(), String> {
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
        println!("{:#?}", list_devices());
    }

    /// Reconnect/disconnect round-trip against a named paired device
    /// (adjust to a device on the machine): run with
    /// `cargo test -- --ignored --nocapture`.
    #[test]
    #[ignore]
    fn toggles_named_device() {
        let name = "QCY-T13";
        let mac = list_devices()
            .devices
            .iter()
            .find(|d| d.name == name)
            .map(|d| d.mac.clone())
            .expect("device not in the paired list");
        // Reconnect right after a disconnect — the case the auto-disconnect
        // feature produces — to observe any connect/drop flapping.
        for round in 1..=2 {
            println!("--- connect round {round}");
            set_connect(&mac, true).unwrap();
            let connected = wait_for(&mac, true);
            println!("round {round} connected within window: {connected}");
            if round == 1 {
                println!("--- disconnect");
                set_connect(&mac, false).unwrap();
                let disconnected = wait_for(&mac, false);
                println!("round {round} disconnected within window: {disconnected}");
            }
        }
    }

    /// Polls the connection flag of `mac` for up to 20 s, printing the BT flag
    /// and the WASAPI endpoint states each second: establishing or tearing
    /// down a profile is asynchronous.
    fn wait_for(mac: &str, expected: bool) -> bool {
        for second in 0..20 {
            std::thread::sleep(std::time::Duration::from_secs(1));
            let bt = list_devices()
                .devices
                .iter()
                .find(|d| d.mac == mac)
                .is_some_and(|d| d.connected == expected);
            let endpoints: Vec<String> = crate::audio::enumerator::list_devices()
                .unwrap_or_default()
                .into_iter()
                .filter(|d| d.is_bluetooth)
                .map(|d| format!("{}:{}", d.name, d.state))
                .collect();
            println!("t={second}s endpoints={endpoints:?}");
            if bt {
                return true;
            }
        }
        false
    }

    /// Dumps every paired/remembered device the radio reports, with class of
    /// device and installed services, for debugging filters.
    #[test]
    #[ignore]
    fn dumps_all_paired_devices() {
        let _ = for_each_radio(|radio| {
            for_each_paired_device(radio, |info| {
                let services = installed_services(radio, info);
                println!(
                    "name={:?} auth={} remembered={} connected={} cod={:#x} services={:?}",
                    device_name(info),
                    info.fAuthenticated.as_bool(),
                    info.fRemembered.as_bool(),
                    info.fConnected.as_bool(),
                    info.ulClassofDevice,
                    services
                        .iter()
                        .map(|g| format!("{g:?}"))
                        .collect::<Vec<_>>(),
                );
                true
            });
            true
        });
    }
}
