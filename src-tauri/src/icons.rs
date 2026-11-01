use std::path::Path;
use std::fs;
use base64::{Engine as _, engine::general_purpose};
use windows::Win32::UI::Shell::ExtractIconExW;
use windows::Win32::UI::WindowsAndMessaging::{HICON, DestroyIcon, ICONINFO, GetIconInfo};
use windows::Win32::Graphics::Gdi::{
    GetDC, ReleaseDC, GetDIBits, BITMAPINFOHEADER, BI_RGB, DIB_RGB_COLORS,
    GetObjectW, BITMAP, DeleteObject, CreateCompatibleDC, SelectObject, DeleteDC,
};
use windows::core::HSTRING;

use crate::{icon_cache, icon_paths};


/// Get the icon for an application, returning it as a base64 encoded PNG
pub fn get_app_icon_base64(process_name: &str, cache_dir: &Path) -> Option<String> {
    // `.exe` is stripped case-insensitively ("Hermes.EXE" and "hermes.exe" are one app),
    // and the canonical cache file is lowercase (D-021).
    let clean_name = icon_cache::cache_stem(process_name);
    let icon_path = cache_dir.join(format!("{}.png", clean_name));

    // 1. Check Cache on Disk (Fastest)
    if let Some(path) = icon_cache::cached_icon_path(cache_dir, &clean_name) {
        if let Ok(data) = fs::read(&path) {
            return Some(format!("data:image/png;base64,{}", general_purpose::STANDARD.encode(data)));
        }
    }

    // 2. Find Executable Path (Cached in memory)
    let exe_path = icon_paths::resolve(process_name)?;

    // 3. Extract Icon
    let icon_data = extract_icon_to_png(&exe_path)?;

    // 4. Save to Disk Cache
    let _ = fs::write(&icon_path, &icon_data);

    Some(format!("data:image/png;base64,{}", general_purpose::STANDARD.encode(icon_data)))
}

/// Render the app's default icon tinted amber (distraction-guard state).
/// Non-transparent pixels are blended 60% toward amber (255, 170, 30).
pub fn amber_tray_icon_png(app: &tauri::AppHandle) -> Option<Vec<u8>> {
    let icon = app.default_window_icon()?;
    let rgba = icon.rgba();
    let width = icon.width();
    let height = icon.height();

    let mut tinted = rgba.to_vec();
    for px in tinted.chunks_exact_mut(4) {
        if px[3] > 0 {
            px[0] = (px[0] as u16 * 40 / 100 + 255 * 60 / 100) as u8;
            px[1] = (px[1] as u16 * 40 / 100 + 170 * 60 / 100) as u8;
            px[2] = (px[2] as u16 * 40 / 100 + 30 * 60 / 100) as u8;
        }
    }

    let mut png = Vec::new();
    {
        use image::ImageEncoder;
        let mut cursor = std::io::Cursor::new(&mut png);
        image::codecs::png::PngEncoder::new(&mut cursor)
            .write_image(&tinted, width, height, image::ExtendedColorType::Rgba8)
            .ok()?;
    }
    Some(png)
}

fn extract_icon_to_png(path: &Path) -> Option<Vec<u8>> {
    // A packaged app resolves to its own logo PNG rather than an executable: there is nothing to extract, and reading
    // the file is both simpler and sharper than asking the shell for a scaled tile.
    if path
        .extension()
        .map(|ext| ext.eq_ignore_ascii_case("png"))
        .unwrap_or(false)
    {
        return fs::read(path).ok();
    }
    unsafe {
        let path_hstring = HSTRING::from(path.to_str()?);
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
    let hbm_mask = icon_info.hbmMask;

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

    // Convert BGRA to RGBA
    let mut rgba = vec![0u8; (width * height * 4) as usize];
    for i in (0..buffer.len()).step_by(4) {
        rgba[i] = buffer[i + 2];     // R
        rgba[i + 1] = buffer[i + 1]; // G
        rgba[i + 2] = buffer[i];     // B
        rgba[i + 3] = buffer[i + 3]; // A
    }

    // Cleanup DC resources
    SelectObject(hdc_mem, hold_bm);
    let _ = DeleteDC(hdc_mem);
    let _ = ReleaseDC(None, hdc_screen);

    // Create PNG
    let mut png_data = Vec::new();
    let mut cursor = std::io::Cursor::new(&mut png_data);
    
    let result = {
        use image::ImageEncoder;
        image::codecs::png::PngEncoder::new(&mut cursor).write_image(
            &rgba,
            width as u32,
            height as u32,
            image::ExtendedColorType::Rgba8
        ).is_ok()
    };

    // Cleanup bitmaps - always execute even if PNG encoding failed
    let _ = DeleteObject(hbm_color);
    let _ = DeleteObject(hbm_mask);

    if result {
        Some(png_data)
    } else {
        None
    }
}
/// Bumped whenever the resolver gains a strategy. A `.missing` marker written by an older resolver is then ignored and
/// the name is retried — otherwise adding a strategy would never reach the names it was added for, and the cache would
/// quietly keep a wrong answer.
const RESOLVER_VERSION: &str = "3";

/// Write the icon of every app that does not have one yet, so the UI never shows a letter tile for an app it has
/// history for.
///
/// Called once after startup on a background thread. Returns `(already, added, unresolved)` — the numbers are logged
/// so a machine where the resolve fails wholesale is visible rather than silently letter-tiled.
pub fn backfill_icons<I>(names: I, cache_dir: &Path) -> (usize, usize, usize)
where
    I: IntoIterator<Item = String>,
{
    if let Err(err) = fs::create_dir_all(cache_dir) {
        log::warn!("Icons: cannot create the cache directory {cache_dir:?}: {err}");
        return (0, 0, 0);
    }

    let (mut already, mut added, mut unresolved) = (0, 0, 0);
    for process_name in names {
        let stem = Path::new(&process_name)
            .file_stem()
            .map(|s| s.to_string_lossy().to_lowercase())
            .unwrap_or_else(|| process_name.to_lowercase());
        let icon_path = cache_dir.join(format!("{stem}.png"));
        let missing_marker = cache_dir.join(format!("{stem}.missing"));

        if icon_cache::cached_icon_path(cache_dir, &stem).is_some() {
            already += 1;
            continue;
        }
        // A name that resolved to nothing last time will resolve to nothing this time too, and the sweep it takes to
        // find that out is the expensive part — so it is recorded, together with the resolver that decided it. The
        // marker does not outrank a PNG, so an app that is later installed and run still gets its icon from the UI path.
        if fs::read_to_string(&missing_marker)
            .map(|version| version.trim() == RESOLVER_VERSION)
            .unwrap_or(false)
        {
            unresolved += 1;
            continue;
        }
        match icon_paths::resolve(&process_name).and_then(|exe| extract_icon_to_png(&exe)) {
            Some(data) => {
                match fs::write(&icon_path, &data) {
                    Ok(()) => added += 1,
                    Err(err) => {
                        log::warn!("Icons: could not write {icon_path:?}: {err}");
                        unresolved += 1;
                    }
                }
            }
            None => {
                unresolved += 1;
                let _ = fs::write(&missing_marker, RESOLVER_VERSION);
            }
        }
    }
    (already, added, unresolved)
}
