//! Best-effort extraction of a Windows audio endpoint's icon (the one shown in
//! the Sound control panel, e.g. a speaker or headphones glyph) into RGBA bytes
//! for a tray icon. Returns `None` whenever the endpoint has no icon path or any
//! step fails, so the tray can fall back to the app icon.

#[cfg(windows)]
use std::ffi::c_void;

/// RGBA pixels plus dimensions for the current output device's icon.
#[cfg(windows)]
pub fn icon_rgba_for(device_id: &str) -> Option<(Vec<u8>, u32, u32)> {
    use windows::core::{GUID, HSTRING, PCWSTR};
    use windows::Win32::Media::Audio::{IMMDeviceEnumerator, MMDeviceEnumerator};
    use windows::Win32::System::Com::{CoCreateInstance, CLSCTX_ALL, STGM_READ};
    use windows::Win32::UI::Shell::PropertiesSystem::PROPERTYKEY;

    crate::audio::ensure_com();
    unsafe {
        let enumerator: IMMDeviceEnumerator =
            CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL).ok()?;
        let id = HSTRING::from(device_id);
        let device = enumerator.GetDevice(PCWSTR(id.as_ptr())).ok()?;
        let store = device.OpenPropertyStore(STGM_READ).ok()?;

        // The endpoint icon path. Try the endpoint-specific key first, then the
        // device-class fallback. Value looks like "%windir%\system32\mmres.dll,-3010".
        let keys = [
            PROPERTYKEY {
                fmtid: GUID::from_u128(0xb3f8fa53_0004_438e_9003_51a46e139bfc),
                pid: 12,
            },
            PROPERTYKEY {
                fmtid: GUID::from_u128(0x259abffc_50a7_47ce_af08_68c9a7d73366),
                pid: 12,
            },
        ];
        let mut raw = None;
        for key in keys {
            if let Ok(prop) = store.GetValue(&key) {
                if let Some(s) = propvariant_string(&prop) {
                    if !s.is_empty() {
                        raw = Some(s);
                        break;
                    }
                }
            }
        }
        let expanded = expand_env(&raw?);
        let (path, index) = split_resource(&expanded);
        extract_icon_rgba(&path, index)
    }
}

#[cfg(not(windows))]
pub fn icon_rgba_for(_device_id: &str) -> Option<(Vec<u8>, u32, u32)> {
    None
}

#[cfg(windows)]
unsafe fn propvariant_string(prop: &windows::core::PROPVARIANT) -> Option<String> {
    use windows::Win32::System::Com::StructuredStorage::PropVariantToStringAlloc;
    use windows::Win32::System::Com::CoTaskMemFree;

    let p = PropVariantToStringAlloc(prop).ok()?;
    if p.is_null() {
        return None;
    }
    let s = p.to_string().ok();
    CoTaskMemFree(Some(p.0 as *const c_void));
    s
}

/// Expands `%var%` references (icon paths typically use `%windir%`).
#[cfg(windows)]
unsafe fn expand_env(s: &str) -> String {
    use windows::core::{HSTRING, PCWSTR};
    use windows::Win32::System::Environment::ExpandEnvironmentStringsW;

    let src = HSTRING::from(s);
    let needed = ExpandEnvironmentStringsW(PCWSTR(src.as_ptr()), None);
    if needed == 0 {
        return s.to_string();
    }
    let mut buf = vec![0u16; needed as usize];
    let written = ExpandEnvironmentStringsW(PCWSTR(src.as_ptr()), Some(&mut buf));
    if written == 0 {
        return s.to_string();
    }
    String::from_utf16_lossy(&buf[..(written as usize).saturating_sub(1)])
}

/// Splits a `"path,index"` resource string into its parts (index defaults to 0).
fn split_resource(s: &str) -> (String, i32) {
    if let Some(pos) = s.rfind(',') {
        if let Ok(idx) = s[pos + 1..].trim().parse::<i32>() {
            return (s[..pos].to_string(), idx);
        }
    }
    (s.to_string(), 0)
}

/// Extracts the icon at `path,index` and converts it to top-down RGBA pixels.
#[cfg(windows)]
unsafe fn extract_icon_rgba(path: &str, index: i32) -> Option<(Vec<u8>, u32, u32)> {
    use windows::core::{HSTRING, PCWSTR};
    use windows::Win32::UI::Shell::SHDefExtractIconW;
    use windows::Win32::UI::WindowsAndMessaging::{DestroyIcon, HICON};

    let file = HSTRING::from(path);
    let mut hicon = HICON::default();
    // niconsize low word = large icon size; request 32px.
    if SHDefExtractIconW(PCWSTR(file.as_ptr()), index, 0, Some(&mut hicon), None, 32).is_err() {
        return None;
    }
    if hicon.is_invalid() {
        return None;
    }
    let result = hicon_to_rgba(hicon);
    let _ = DestroyIcon(hicon);
    result
}

#[cfg(windows)]
unsafe fn hicon_to_rgba(
    hicon: windows::Win32::UI::WindowsAndMessaging::HICON,
) -> Option<(Vec<u8>, u32, u32)> {
    use windows::Win32::Graphics::Gdi::{
        DeleteObject, GetDC, GetDIBits, GetObjectW, ReleaseDC, BITMAP, BITMAPINFO,
        BITMAPINFOHEADER, DIB_RGB_COLORS, HGDIOBJ,
    };
    use windows::Win32::UI::WindowsAndMessaging::{GetIconInfo, ICONINFO};

    let mut info = ICONINFO::default();
    GetIconInfo(hicon, &mut info).ok()?;
    let hbm_color = info.hbmColor;
    let hbm_mask = info.hbmMask;

    let mut bmp = BITMAP::default();
    let got = GetObjectW(
        HGDIOBJ(hbm_color.0),
        std::mem::size_of::<BITMAP>() as i32,
        Some(&mut bmp as *mut _ as *mut c_void),
    );
    if got == 0 || bmp.bmWidth <= 0 || bmp.bmHeight <= 0 {
        let _ = DeleteObject(HGDIOBJ(hbm_color.0));
        let _ = DeleteObject(HGDIOBJ(hbm_mask.0));
        return None;
    }
    let w = bmp.bmWidth;
    let h = bmp.bmHeight;

    let mut bi = BITMAPINFO::default();
    bi.bmiHeader.biSize = std::mem::size_of::<BITMAPINFOHEADER>() as u32;
    bi.bmiHeader.biWidth = w;
    bi.bmiHeader.biHeight = -h; // negative => top-down rows
    bi.bmiHeader.biPlanes = 1;
    bi.bmiHeader.biBitCount = 32;
    bi.bmiHeader.biCompression = 0; // BI_RGB

    let mut buf = vec![0u8; (w * h * 4) as usize];
    let hdc = GetDC(None);
    let scan = GetDIBits(
        hdc,
        hbm_color,
        0,
        h as u32,
        Some(buf.as_mut_ptr() as *mut c_void),
        &mut bi,
        DIB_RGB_COLORS,
    );
    ReleaseDC(None, hdc);
    let _ = DeleteObject(HGDIOBJ(hbm_color.0));
    let _ = DeleteObject(HGDIOBJ(hbm_mask.0));
    if scan == 0 {
        return None;
    }

    // GetDIBits gives BGRA; the tray wants RGBA.
    for px in buf.chunks_exact_mut(4) {
        px.swap(0, 2);
    }
    // Some legacy icons report no alpha (all zero) — make them opaque so they
    // don't render as a blank square.
    if buf.chunks_exact(4).all(|p| p[3] == 0) {
        for px in buf.chunks_exact_mut(4) {
            px[3] = 255;
        }
    }

    Some((buf, w as u32, h as u32))
}
