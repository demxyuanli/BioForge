// Backend and Ollama process state.
use std::process::Child;
use std::sync::Mutex;

#[cfg(windows)]
pub(crate) struct JobHandleGuard(pub(crate) windows::Win32::Foundation::HANDLE);

#[cfg(windows)]
unsafe impl Send for JobHandleGuard {}
#[cfg(windows)]
unsafe impl Sync for JobHandleGuard {}

#[cfg(windows)]
impl Drop for JobHandleGuard {
    fn drop(&mut self) {
        unsafe {
            let _ = windows::Win32::Foundation::CloseHandle(self.0);
        }
    }
}

pub struct BackendProcess {
    #[allow(dead_code)]
    pub child: Child,
    #[cfg(windows)]
    pub(crate) _job: Option<JobHandleGuard>,
}

pub struct BackendState {
    pub process: Mutex<Option<BackendProcess>>,
}

pub struct OllamaState {
    pub process: Mutex<Option<Child>>,
}
