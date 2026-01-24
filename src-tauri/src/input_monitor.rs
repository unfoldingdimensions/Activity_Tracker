use std::sync::{Arc, Mutex};
use std::thread;
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
            log::info!("InputMonitor: Starting global input listener thread");
            if let Err(error) = listen(move |event| {
                if let Ok(mut c) = counts_clone.lock() {
                    match event.event_type {
                        EventType::KeyPress(_) => {
                            c.keystrokes += 1;
                            // log::info!("Key pressed! Total: {}", c.keystrokes);
                        },
                        EventType::ButtonPress(_) => {
                            c.mouse_clicks += 1;
                            // log::info!("Mouse clicked! Total: {}", c.mouse_clicks);
                        },
                        _ => {}
                    }
                }
            }) {
                log::error!("InputMonitor: Listener error: {:?}", error);
            }
            log::info!("InputMonitor: Thread exited");
        });

        Self { counts }
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
