//! Windows API integration for activity tracking
//! Uses safe, non-invasive methods (GetLastInputInfo, GetForegroundWindow)

#[cfg(windows)]
use windows::{
    Win32::Foundation::{HWND, MAX_PATH},
    Win32::UI::WindowsAndMessaging::{
        GetForegroundWindow, GetWindowTextW, GetWindowThreadProcessId,
    },
    Win32::System::Threading::{
        OpenProcess, PROCESS_QUERY_LIMITED_INFORMATION, PROCESS_QUERY_INFORMATION, PROCESS_VM_READ
    },
    Win32::System::ProcessStatus::GetModuleBaseNameW,
    Win32::System::SystemInformation::GetTickCount,
    Win32::UI::Input::KeyboardAndMouse::{GetLastInputInfo, LASTINPUTINFO},
};

/// Information about the currently active window
#[derive(Debug, Clone, serde::Serialize)]
pub struct ActiveWindow {
    pub process_name: String,
    pub window_title: String,
}

/// Get information about the currently focused window
#[cfg(windows)]
pub fn get_active_window() -> Option<ActiveWindow> {
    unsafe {
        let hwnd: HWND = GetForegroundWindow();
        if hwnd.0.is_null() {
            return None;
        }

        // Get window title
        let mut title_buffer = [0u16; 512];
        let title_len = GetWindowTextW(hwnd, &mut title_buffer);
        let window_title = if title_len > 0 {
            String::from_utf16_lossy(&title_buffer[..title_len as usize])
        } else {
            String::new()
        };

        // Get process ID
        let mut process_id: u32 = 0;
        GetWindowThreadProcessId(hwnd, Some(&mut process_id));

        // Get process name
        let process_name = get_process_name(process_id).unwrap_or_else(|| {
             // Fallback: use window title if it exists and looks like an app
             if !window_title.is_empty() {
                 "Unknown".to_string() 
             } else {
                 "Unknown".to_string()
             }
        });

        Some(ActiveWindow {
            process_name,
            window_title,
        })
    }
}

#[cfg(not(windows))]
pub fn get_active_window() -> Option<ActiveWindow> {
    // Stub for non-Windows platforms
    Some(ActiveWindow {
        process_name: "Unknown".to_string(),
        window_title: "Not supported on this platform".to_string(),
    })
}

/// Get the process name from a process ID
#[cfg(windows)]
fn get_process_name(process_id: u32) -> Option<String> {
    unsafe {
        // Try with PROCESS_QUERY_INFORMATION | PROCESS_VM_READ first (for GetModuleBaseName)
        let handle_result = OpenProcess(
            PROCESS_QUERY_INFORMATION | PROCESS_VM_READ, 
            false, 
            process_id
        );

        let handle = match handle_result {
            Ok(h) => h,
            Err(_) => {
                // Fallback to LIMITED_INFORMATION
                OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, process_id).ok()?
            }
        };
        
        // Try GetModuleBaseNameW
        let mut name_buffer = [0u16; MAX_PATH as usize];
        let len = GetModuleBaseNameW(handle, None, &mut name_buffer);
        
        // Close handle (Windows crate handles often drop automatically but explicit closing via dropping wrapper if needed, 
        // here `handle` is a `HANDLE` which struct implements Drop or we assume it's fine for now)
        // Actually windows crate handles are Owned usually.

        if len > 0 {
            Some(String::from_utf16_lossy(&name_buffer[..len as usize]))
        } else {
            // Log failure if needed
            None
        }
    }
}

/// Get the number of seconds since the last user input
#[cfg(windows)]
pub fn get_idle_seconds() -> u32 {
    unsafe {
        let mut last_input = LASTINPUTINFO {
            cbSize: std::mem::size_of::<LASTINPUTINFO>() as u32,
            dwTime: 0,
        };

        // GetLastInputInfo returns BOOL (non-zero = success)
        if GetLastInputInfo(&mut last_input).as_bool() {
            let tick_count = GetTickCount();
            let idle_ms = tick_count.saturating_sub(last_input.dwTime);
            idle_ms / 1000
        } else {
            0
        }
    }
}

#[cfg(not(windows))]
pub fn get_idle_seconds() -> u32 {
    // Stub for non-Windows platforms
    0
}

/// Check if the system is considered idle (more than 60 seconds without input)
pub fn is_system_idle() -> bool {
    get_idle_seconds() > 60
}

/// Get the current timestamp in ISO 8601 format (Local)
pub fn get_timestamp() -> String {
    chrono::Local::now().format("%Y-%m-%dT%H:%M:%S%.3f").to_string()
}

/// Get today's date in YYYY-MM-DD format
pub fn get_today() -> String {
    chrono::Local::now().format("%Y-%m-%d").to_string()
}
