use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use rdev::{listen, EventType};

#[derive(Clone, Default, Debug)]
pub struct InputCounts {
    pub keystrokes: u32,
    pub mouse_clicks: u32,
    pub mouse_distance: u32,
}

pub struct InputMonitor {
    counts: Arc<Mutex<InputCounts>>,
}

impl InputMonitor {
    pub fn new() -> Self {
        let counts = Arc::new(Mutex::new(InputCounts::default()));
        let counts_clone = counts.clone();

        thread::spawn(move || {
            // Retry a few times in case the global listener fails to start
            let mut attempt: u32 = 0;
            loop {
                log::info!("InputMonitor: Starting global input listener (attempt {})", attempt + 1);
                let counts = counts_clone.clone();
                let result = listen(move |event| {
                    if let Ok(mut c) = counts.lock() {
                        match event.event_type {
                            EventType::KeyPress(_) => {
                                c.keystrokes += 1;
                            },
                            EventType::ButtonPress(_) => {
                                c.mouse_clicks += 1;
                            },
                            _ => {}
                        }
                    }
                });

                match result {
                    Ok(()) => {
                        log::info!("InputMonitor: Listener stopped unexpectedly");
                        break;
                    }
                    Err(error) => {
                        attempt += 1;
                        log::error!("InputMonitor: Listener error: {:?}", error);
                        if attempt >= 5 {
                            log::error!("InputMonitor: Giving up after {} attempts", attempt);
                            break;
                        }
                        thread::sleep(Duration::from_secs(5));
                    }
                }
            }
            log::info!("InputMonitor: Thread exited");
        });

        Self { counts }
    }

    /// Zero out accumulated counts (e.g. when tracking is (re)started).
    pub fn reset(&self) {
        if let Ok(mut counts) = self.counts.lock() {
            *counts = InputCounts::default();
        }
    }

    pub fn get_and_reset(&self) -> InputCounts {
        if let Ok(mut counts) = self.counts.lock() {
            let result = counts.clone();
            *counts = InputCounts::default();
            result
        } else {
            InputCounts::default()
        }
    }
}
