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
    last_mouse_pos: Arc<Mutex<Option<(f64, f64)>>>,
}

impl InputMonitor {
    pub fn new() -> Self {
        let counts = Arc::new(Mutex::new(InputCounts::default()));
        let last_mouse_pos = Arc::new(Mutex::new(None));

        let counts_clone = counts.clone();
        let last_mouse_pos_clone = last_mouse_pos.clone();

        thread::spawn(move || {
            // Retry a few times in case the global listener fails to start
            let mut attempt: u32 = 0;
            loop {
                log::info!("InputMonitor: Starting global input listener (attempt {})", attempt + 1);
                let counts = counts_clone.clone();
                let last_mouse_pos = last_mouse_pos_clone.clone();
                let result = listen(move |event| {
                    if let Ok(mut c) = counts.lock() {
                        match event.event_type {
                            EventType::KeyPress(_) => {
                                c.keystrokes += 1;
                            },
                            EventType::ButtonPress(_) => {
                                c.mouse_clicks += 1;
                            },
                            EventType::MouseMove { x, y } => {
                                // Accumulate Manhattan distance between consecutive
                                // cursor positions (screen pixels). The first event
                                // after a (re)start has no reference point and is
                                // skipped. Lock order: counts -> last_mouse_pos.
                                let mut last = last_mouse_pos.lock().unwrap();
                                if let Some((lx, ly)) = *last {
                                    c.mouse_distance += ((x - lx).abs() + (y - ly).abs()) as u32;
                                }
                                *last = Some((x, y));
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
    /// The last known cursor position is also cleared so the first mouse
    /// move after a restart is not counted as travel distance.
    pub fn reset(&self) {
        if let Ok(mut counts) = self.counts.lock() {
            *counts = InputCounts::default();
        }
        if let Ok(mut last) = self.last_mouse_pos.lock() {
            *last = None;
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
