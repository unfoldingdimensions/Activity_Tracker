use std::path::{Path, PathBuf};
use std::fs;
use base64::{Engine as _, engine::general_purpose};
use sysinfo::{System, ProcessRefreshKind, RefreshKind, ProcessesToUpdate};
use std::sync::Mutex;
use once_cell::sync::Lazy;
use windows::Win32::UI::Shell::ExtractIconExW;
use windows::Win32::UI::WindowsAndMessaging::{HICON, DestroyIcon, ICONINFO, GetIconInfo};
use windows::Win32::Graphics::Gdi::{
    GetDC, ReleaseDC, GetDIBits, BITMAPINFOHEADER, BI_RGB, DIB_RGB_COLORS,
    GetObjectW, BITMAP, DeleteObject, CreateCompatibleDC, SelectObject, DeleteDC,
};
use windows::core::HSTRING;


static ICON_SYSTEM: Lazy<Mutex<System>> = Lazy::new(|| {
    Mutex::new(System::new_with_specifics(
        RefreshKind::everything()
    ))
});

/// Get the icon for an application, returning it as a base64 encoded PNG
pub fn get_app_icon_base64(process_name: &str, cache_dir: &Path) -> Option<String> {
    let clean_name = process_name.replace(".exe", "");
    let icon_path = cache_dir.join(format!("{}.png", clean_name));

    // 1. Check Cache
    if icon_path.exists() {
        if let Ok(data) = fs::read(&icon_path) {
            return Some(format!("data:image/png;base64,{}", general_purpose::STANDARD.encode(data)));
        }
    }

    // 2. Find Executable Path
    let exe_path = find_exe_path(process_name)?;

    // 3. Extract Icon
    let icon_data = extract_icon_to_png(&exe_path)?;

    // 4. Save to Cache
    let _ = fs::write(&icon_path, &icon_data);

    Some(format!("data:image/png;base64,{}", general_purpose::STANDARD.encode(icon_data)))
}

fn find_exe_path(process_name: &str) -> Option<PathBuf> {
    let mut sys = ICON_SYSTEM.lock().unwrap();
    sys.refresh_processes_specifics(ProcessesToUpdate::All, true, ProcessRefreshKind::everything());

    for process in sys.processes_by_name(process_name.as_ref()) {
        if let Some(path) = process.exe() {
            if path.exists() {
                return Some(path.to_path_buf());
            }
        }
    }

    // Fallback: look in common locations if not running
    let common_paths = [
        PathBuf::from("C:\\Windows\\System32").join(process_name),
        PathBuf::from("C:\\Windows").join(process_name),
    ];

    for path in common_paths {
        if path.exists() {
            return Some(path);
        }
    }

    None
}

fn extract_icon_to_png(exe_path: &Path) -> Option<Vec<u8>> {
    unsafe {
        let path_hstring = HSTRING::from(exe_path.to_str()?);
        let mut large_icon = [HICON::default(); 1];
        let mut small_icon = [HICON::default(); 1];
        
        let count = ExtractIconExW(
            &path_hstring,
            0,
            Some(large_icon.as_mut_ptr()),
            Some(small_icon.as_mut_ptr()),
            1
        );

        if count == 0 || large_icon[0].is_invalid() {
            // Try only small if large failed
            if count > 0 && !small_icon[0].is_invalid() {
                let data = hicon_to_png(small_icon[0]);
                let _ = DestroyIcon(small_icon[0]);
                if !large_icon[0].is_invalid() { let _ = DestroyIcon(large_icon[0]); }
                return data;
            }
            return None;
        }

        let data = hicon_to_png(large_icon[0]);
        
        let _ = DestroyIcon(large_icon[0]);
        if !small_icon[0].is_invalid() {
            let _ = DestroyIcon(small_icon[0]);
        }

        data
    }
}

unsafe fn hicon_to_png(hicon: HICON) -> Option<Vec<u8>> {
    let mut icon_info = ICONINFO::default();
    if GetIconInfo(hicon, &mut icon_info).is_err() {
        return None;
    }

    let hbm_color = icon_info.hbmColor;
    let mut bm = BITMAP::default();
    GetObjectW(
        hbm_color,
        std::mem::size_of::<BITMAP>() as i32,
        Some(&mut bm as *mut _ as *mut _)
    );

    let width = bm.bmWidth;
    let height = bm.bmHeight;

    let hdc_screen = GetDC(None);
    let hdc_mem = CreateCompatibleDC(hdc_screen);
    let hold_bm = SelectObject(hdc_mem, hbm_color);

    let mut bmi = BITMAPINFOHEADER {
        biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
        biWidth: width,
        biHeight: -height, // top-down
        biPlanes: 1,
        biBitCount: 32,
        biCompression: BI_RGB.0 as u32,
        ..Default::default()
    };

    let mut buffer = vec![0u8; (width * height * 4) as usize];
    GetDIBits(
        hdc_screen,
        hbm_color,
        0,
        height as u32,
        Some(buffer.as_mut_ptr() as *mut _),
        &mut bmi as *mut _ as *mut _,
        DIB_RGB_COLORS
    );

    // Cleanup Windows objects
    SelectObject(hdc_mem, hold_bm);
    let _ = DeleteDC(hdc_mem);
    let _ = ReleaseDC(None, hdc_screen);
    let _ = DeleteObject(icon_info.hbmColor);
    let _ = DeleteObject(icon_info.hbmMask);

    // Convert BGRA to RGBA and create PNG
    let mut rgba = vec![0u8; (width * height * 4) as usize];
    for i in (0..buffer.len()).step_by(4) {
        rgba[i] = buffer[i + 2];     // R
        rgba[i + 1] = buffer[i + 1]; // G
        rgba[i + 2] = buffer[i];     // B
        rgba[i + 3] = buffer[i + 3]; // A
    }

    let mut png_data = Vec::new();
    let mut cursor = std::io::Cursor::new(&mut png_data);
    
    // Using image crate 0.25 to encode PNG
    use image::ImageEncoder;
    if let Ok(_) = image::codecs::png::PngEncoder::new(&mut cursor).write_image(
        &rgba,
        width as u32,
        height as u32,
        image::ExtendedColorType::Rgba8
    ) {
        Some(png_data)
    } else {
        None
    }
}

