use std::path::{Path, PathBuf};
use std::fs;
use std::sync::Mutex;
use std::collections::VecDeque;
use std::ffi::OsStr;
use base64::{Engine as _, engine::general_purpose};
use sysinfo::{System, ProcessRefreshKind, UpdateKind, ProcessesToUpdate};
use once_cell::sync::Lazy;
use windows::Win32::UI::Shell::ExtractIconExW;
use windows::Win32::UI::WindowsAndMessaging::{HICON, DestroyIcon, ICONINFO, GetIconInfo};
use windows::Win32::Graphics::Gdi::{
    GetDC, ReleaseDC, GetDIBits, BITMAPINFOHEADER, BI_RGB, DIB_RGB_COLORS,
    GetObjectW, BITMAP, DeleteObject, CreateCompatibleDC, SelectObject, DeleteDC,
};
use windows::core::HSTRING;

const MAX_CACHE_SIZE: usize = 500;

struct LruCache {
    order: VecDeque<String>,
    data: std::collections::HashMap<String, PathBuf>,
}

impl LruCache {
    fn new() -> Self {
        Self {
            order: VecDeque::new(),
            data: std::collections::HashMap::new(),
        }
    }
    
    fn get(&mut self, key: &str) -> Option<PathBuf> {
        if let Some(path) = self.data.get(key) {
            // Move to front (most recently used)
            self.order.retain(|k| k != key);
            self.order.push_front(key.to_string());
            Some(path.clone())
        } else {
            None
        }
    }
    
    fn insert(&mut self, key: String, value: PathBuf) {
        if self.data.contains_key(&key) {
            // Update existing
            self.order.retain(|k| k != &key);
        } else if self.order.len() >= MAX_CACHE_SIZE {
            // Evict least recently used
            if let Some(lru_key) = self.order.pop_back() {
                self.data.remove(&lru_key);
            }
        }
        self.order.push_front(key.clone());
        self.data.insert(key, value);
    }
}

struct IconSystem {
    sys: Mutex<System>,
    path_cache: Mutex<LruCache>,
}

impl IconSystem {
    fn new() -> Self {
        Self {
            sys: Mutex::new(System::new_all()), 
            path_cache: Mutex::new(LruCache::new()),
        }
    }

    fn find_exe_path(&self, process_name: &str) -> Option<PathBuf> {
        // 1. Check Cache
        {
            let mut cache = self.path_cache.lock().unwrap();
            if let Some(path) = cache.get(process_name) {
                if path.exists() {
                    return Some(path);
                }
            }
        }

        // 2. Refresh Processes (Lightweight)
        {
            let mut sys = self.sys.lock().unwrap();
            sys.refresh_processes_specifics(
                ProcessesToUpdate::All, 
                true,
                ProcessRefreshKind::nothing().with_exe(UpdateKind::Always)
            );
            
            for process in sys.processes_by_name(OsStr::new(process_name)) {
                if let Some(exe_path) = process.exe() {
                    if exe_path.exists() {
                        // Cache it using LRU
                        let mut cache = self.path_cache.lock().unwrap();
                        cache.insert(process_name.to_string(), exe_path.to_path_buf());
                        return Some(exe_path.to_path_buf());
                    }
                }
            }
        }

        // 3. Fallback: look in common locations
        let common_paths = [
            PathBuf::from("C:\\Windows\\System32").join(process_name),
            PathBuf::from("C:\\Windows").join(process_name),
        ];

        for path in common_paths {
            if path.exists() {
                let mut cache = self.path_cache.lock().unwrap();
                cache.insert(process_name.to_string(), path.clone());
                return Some(path);
            }
        }
        
        None
    }
}

static ICON_SYSTEM: Lazy<IconSystem> = Lazy::new(|| IconSystem::new());

/// Get the icon for an application, returning it as a base64 encoded PNG
pub fn get_app_icon_base64(process_name: &str, cache_dir: &Path) -> Option<String> {
    let clean_name = process_name.replace(".exe", "");
    let icon_path = cache_dir.join(format!("{}.png", clean_name));

    // 1. Check Cache on Disk (Fastest)
    if icon_path.exists() {
        if let Ok(data) = fs::read(&icon_path) {
            return Some(format!("data:image/png;base64,{}", general_purpose::STANDARD.encode(data)));
        }
    }

    // 2. Find Executable Path (Cached in memory)
    let exe_path = ICON_SYSTEM.find_exe_path(process_name)?;

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

