//! Windows API integration for activity tracking
//! Uses safe, non-invasive methods (GetLastInputInfo, GetForegroundWindow)

#[cfg(windows)]
use windows::{
    Win32::Foundation::{CloseHandle, HWND, MAX_PATH},
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
        let process_name = get_process_name(process_id)
            .unwrap_or_else(|| "Unknown".to_string());

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

        // The windows crate returns raw (non-owning) HANDLEs from OpenProcess,
        // so we must close it explicitly. Called once per second by the
        // tracking loop, so leaking here would grow the process table over time.
        let _ = CloseHandle(handle);

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
            let idle_ms = if tick_count >= last_input.dwTime {
                tick_count - last_input.dwTime
            } else {
                // Handle GetTickCount rollover (happens every ~49.7 days)
                // When tick_count wraps around, last_input.dwTime will be larger
                (u32::MAX - last_input.dwTime) + tick_count
            };
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

/// Get the current timestamp in ISO 8601 format (Local)
pub fn get_timestamp() -> String {
    chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true)
}

/// Get today's date in YYYY-MM-DD format
pub fn get_today() -> String {
    chrono::Local::now().format("%Y-%m-%d").to_string()
}
