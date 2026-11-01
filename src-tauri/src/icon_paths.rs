//! Where an app's executable lives — the lookup the icon extractor needs.
//!
//! Icons are cached as PNGs on disk, so a path is resolved once per app per machine, not per frame, which is why
//! this can afford to look further than the running process table. It had to: before this module existed the only
//! strategies were "a process with that name is running right now" and "the file is in System32 or C:\\Windows", so
//! any app that was closed at the moment its icon was first requested fell back to a letter tile for good.
//! Measured on the installed app: **14 icons for 124 apps in the database**.
//!
//! Resolution order, cheapest first:
//! 1. in-memory cache of paths already resolved
//! 2. a running process with that name (`sysinfo`)
//! 3. the registry's `App Paths` entries and the `DisplayIcon` of installed programs
//! 4. the `InstallLocation` of an installed program, probed for that exact file name
//! 5. System32 / Windows / SysWOW64, which cover the inbox Windows tools
//!
//! Every strategy lowercases: names are stored lowercase (D-021) while Windows reports the casing baked into the
//! binary, and NTFS path lookups being case-insensitive is a property of the filesystem, not of this code.

use std::collections::{HashMap, VecDeque};
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use once_cell::sync::Lazy;
use sysinfo::{ProcessRefreshKind, ProcessesToUpdate, System, UpdateKind};

/// Bound on the path cache. Measured distinct apps all-time is 122, so this never evicts in practice.
const MAX_CACHE_SIZE: usize = 500;

/// How deep to look inside an install directory for the executable. Two levels covers
/// `…\App\{bin,resources}\app.exe` layouts without turning a miss into a directory walk.
const INSTALL_SCAN_DEPTH: usize = 2;

/// Ceiling on directories visited by the program-files sweep, so a miss cannot turn into a full disk walk.
/// `C:\Program Files` on this machine holds ~1,600 directories at that depth.
const SCAN_DIRECTORY_BUDGET: usize = 3000;

/// Depth and budget for the registry's install locations. Deeper than the general sweep because these folders are one
/// application each — `Program Files\Git` is where Git's own `usr\bin` and `mingw64\bin` live.
const INSTALL_DIR_SCAN_DEPTH: usize = 2;
const INSTALL_DIR_SCAN_BUDGET: usize = 1_500;

struct LruCache {
    order: VecDeque<String>,
    data: HashMap<String, PathBuf>,
}

impl LruCache {
    fn new() -> Self {
        Self {
            order: VecDeque::new(),
            data: HashMap::new(),
        }
    }

    fn get(&mut self, key: &str) -> Option<PathBuf> {
        if let Some(path) = self.data.get(key) {
            self.order.retain(|k| k != key);
            self.order.push_front(key.to_string());
            Some(path.clone())
        } else {
            None
        }
    }

    fn insert(&mut self, key: String, value: PathBuf) {
        if self.data.contains_key(&key) {
            self.order.retain(|k| k != &key);
        } else if self.order.len() >= MAX_CACHE_SIZE {
            if let Some(lru_key) = self.order.pop_back() {
                self.data.remove(&lru_key);
            }
        }
        self.order.push_front(key.clone());
        self.data.insert(key, value);
    }
}

/// What the registry knows about installed programs, collected once per session.
///
/// Building this walks a few hundred uninstall entries, which is fine once and wasteful per app, so it is a lazy
/// static rather than a per-lookup call.
struct InstalledPrograms {
    /// lowercased executable file name -> full path
    by_exe_name: HashMap<String, PathBuf>,
    /// install directories worth probing for an executable nobody named
    install_dirs: Vec<PathBuf>,
    /// lowercased executable file name -> target, from the Start Menu shortcuts
    start_menu: HashMap<String, PathBuf>,
    /// lowercased executable file name -> path, from one bounded sweep of the install roots
    program_exes: HashMap<String, PathBuf>,
    /// lowercased executable file name -> path, from a deeper sweep of each registry install location
    install_dir_exes: HashMap<String, PathBuf>,
    /// lowercased executable file name -> the packaged app's own logo PNG
    appx_logos: HashMap<String, PathBuf>,
}

impl InstalledPrograms {
    #[cfg(windows)]
    fn collect() -> Self {
        use winreg::enums::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE, KEY_READ};
        use winreg::RegKey;

        const APP_PATHS: &str = r"Microsoft\Windows\CurrentVersion\App Paths";
        const UNINSTALL: &str = r"Microsoft\Windows\CurrentVersion\Uninstall";

        let mut by_exe_name = HashMap::new();
        let mut install_dirs = Vec::new();

        for hive in [HKEY_LOCAL_MACHINE, HKEY_CURRENT_USER] {
            let root = RegKey::predef(hive);
            // `WOW6432Node` goes between `Software` and `Microsoft`, not in front of the whole path — getting that
            // order wrong silently reads nothing, which is how this started and why qBittorrent had no icon.
            for view in ["", r"WOW6432Node\"] {
                // App Paths: the documented answer for "where is chrome.exe", keyed by the exe name itself.
                if let Ok(app_paths) =
                    root.open_subkey_with_flags(&format!(r"Software\{view}{APP_PATHS}"), KEY_READ)
                {
                    for name in app_paths.enum_keys().flatten() {
                        if let Ok(sub) = app_paths.open_subkey_with_flags(&name, KEY_READ) {
                            if let Ok(path) = sub.get_value::<String, _>("") {
                                record_exe(&mut by_exe_name, Path::new(path.trim_matches('"')));
                            }
                        }
                    }
                }

                // Uninstall entries: DisplayIcon usually points at the executable, InstallLocation at its folder.
                if let Ok(uninstall) =
                    root.open_subkey_with_flags(&format!(r"Software\{view}{UNINSTALL}"), KEY_READ)
                {
                    for name in uninstall.enum_keys().flatten() {
                        let Ok(entry) = uninstall.open_subkey_with_flags(&name, KEY_READ) else {
                            continue;
                        };
                        if let Ok(icon) = entry.get_value::<String, _>("DisplayIcon") {
                            // "C:\path\app.exe,0" — the trailing index is not part of the path.
                            let path = icon.split(',').next().unwrap_or("").trim().trim_matches('"');
                            record_exe(&mut by_exe_name, Path::new(path));
                        }
                        if let Ok(location) = entry.get_value::<String, _>("InstallLocation") {
                            let dir = PathBuf::from(location.trim().trim_matches('"'));
                            if dir.is_dir() && !install_dirs.contains(&dir) {
                                install_dirs.push(dir);
                            }
                        }
                    }
                }
            }
        }

        let install_dir_exes = install_location_exes(&install_dirs);
        Self {
            by_exe_name,
            install_dirs,
            start_menu: start_menu_exes(),
            program_exes: program_dir_exes(),
            install_dir_exes,
            appx_logos: appx_logos(),
        }
    }

    #[cfg(not(windows))]
    fn collect() -> Self {
        Self {
            by_exe_name: HashMap::new(),
            install_dirs: Vec::new(),
            start_menu: HashMap::new(),
            program_exes: HashMap::new(),
            install_dir_exes: HashMap::new(),
            appx_logos: HashMap::new(),
        }
    }
}

/// Keep an executable path only when the file is actually there and has an executable extension.
fn record_exe(map: &mut HashMap<String, PathBuf>, path: &Path) {
    if !path.is_file() {
        return;
    }
    let Some(name) = path.file_name() else {
        return;
    };
    let name = name.to_string_lossy().to_lowercase();
    if !name.ends_with(".exe") {
        return;
    }
    map.entry(name).or_insert_with(|| path.to_path_buf());
}

static INSTALLED: Lazy<InstalledPrograms> = Lazy::new(InstalledPrograms::collect);

struct PathResolver {
    sys: Mutex<System>,
    cache: Mutex<LruCache>,
}

impl PathResolver {
    fn new() -> Self {
        Self {
            sys: Mutex::new(System::new_all()),
            cache: Mutex::new(LruCache::new()),
        }
    }

    fn find(&self, process_name: &str) -> Option<PathBuf> {
        let wanted = process_name.to_lowercase();
        let file_name = Path::new(&wanted)
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| wanted.clone());

        if let Some(path) = self.cache.lock().ok().and_then(|mut c| c.get(&wanted)) {
            if path.exists() {
                return Some(path);
            }
        }

        let found = self
            .from_running_process(&wanted)
            .or_else(|| INSTALLED.by_exe_name.get(&file_name).cloned())
            .or_else(|| from_install_dirs(&file_name))
            .or_else(|| from_system_dirs(&file_name));

        if let Some(path) = &found {
            if let Ok(mut cache) = self.cache.lock() {
                cache.insert(wanted, path.clone());
            }
        }
        found
    }

    fn from_running_process(&self, wanted: &str) -> Option<PathBuf> {
        let mut sys = self.sys.lock().ok()?;
        sys.refresh_processes_specifics(
            ProcessesToUpdate::All,
            true,
            ProcessRefreshKind::nothing().with_exe(UpdateKind::Always),
        );
        for process in sys.processes().values() {
            if process.name().to_string_lossy().to_lowercase() != wanted {
                continue;
            }
            if let Some(exe_path) = process.exe() {
                if exe_path.exists() {
                    return Some(exe_path.to_path_buf());
                }
            }
        }
        None
    }
}

/// Probe each known install directory for the file name, then the collected maps.
///
/// The per-directory depth scan that used to sit here is gone: `program_dir_exes` already walked those roots once, so
/// a second walk per name bought nothing and cost the backfill 116 s.
fn from_install_dirs(file_name: &str) -> Option<PathBuf> {
    for dir in &INSTALLED.install_dirs {
        let direct = dir.join(file_name);
        if direct.is_file() {
            return Some(direct);
        }
    }
    INSTALLED
        .install_dir_exes
        .get(file_name)
        .cloned()
        .or_else(|| INSTALLED.start_menu.get(file_name).cloned())
        .or_else(|| INSTALLED.program_exes.get(file_name).cloned())
        .or_else(|| INSTALLED.appx_logos.get(file_name).cloned())
}

/// Where everything the user can launch from the Start Menu actually lives.
///
/// This is the strategy that finds the apps the registry only half-describes: launchers nested four levels deep
/// (`…\Epic Games\Launcher\Portal\Binaries\Win64\EpicGamesLauncher.exe`), games installed on another drive, and
/// anything whose uninstall entry carries no `InstallLocation`. A shortcut is the one place Windows records a target
/// for every app the user can start, and it is what the user themselves sees.
///
/// COM is initialised here rather than at startup so the collector works on whichever thread first needs it; a fresh
/// apartment per call is cheap next to walking a few hundred `.lnk` files, which happens once per session.
#[cfg(windows)]
fn start_menu_exes() -> HashMap<String, PathBuf> {
    use std::ffi::OsString;
    use std::os::windows::ffi::OsStrExt;
    use windows::core::Interface;
    use windows::Win32::System::Com::{
        CoCreateInstance, CoInitializeEx, CoUninitialize, IPersistFile, CLSCTX_INPROC_SERVER,
        COINIT_APARTMENTTHREADED,
    };
    use windows::Win32::UI::Shell::{IShellLinkW, ShellLink};

    let mut map = HashMap::new();
    let mut roots: Vec<PathBuf> = Vec::new();
    for var in ["ProgramData", "APPDATA"] {
        if let Ok(value) = std::env::var(var) {
            roots.push(
                PathBuf::from(value)
                    .join(r"Microsoft\Windows\Start Menu\Programs"),
            );
        }
    }
    roots.retain(|root| root.is_dir());
    if roots.is_empty() {
        return map;
    }

    let mut links = Vec::new();
    for root in &roots {
        collect_link_files(root, 4, &mut links);
    }

    let init = unsafe { CoInitializeEx(None, COINIT_APARTMENTTHREADED) };
    if init.is_err() {
        // Already initialised on this thread is fine; anything else means "no shortcuts today".
        return map;
    }

    for link in links {
        // SAFETY: CoCreateInstance returns a valid IShellLinkW or an error; the OsString -> UTF-16 buffer passed to
        // IPersistFile::Load outlives the call.
        let resolved = unsafe {
            let shell_link: windows::core::Result<IShellLinkW> =
                CoCreateInstance(&ShellLink, None, CLSCTX_INPROC_SERVER);
            match shell_link {
                Ok(link_obj) => {
                    let persist: windows::core::Result<IPersistFile> = link_obj.cast();
                    match persist {
                        Ok(persist) => {
                            let wide: Vec<u16> = OsString::from(&link)
                                .encode_wide()
                                .chain(std::iter::once(0))
                                .collect();
                            let pcwstr = windows::core::PCWSTR(wide.as_ptr());
                            if persist.Load(pcwstr, windows::Win32::System::Com::STGM_READ).is_ok() {
                                let mut buffer = [0u16; 1024];
                                if link_obj
                                    .GetPath(&mut buffer, std::ptr::null_mut(), 0)
                                    .is_ok()
                                {
                                    let len = buffer.iter().position(|c| *c == 0).unwrap_or(0);
                                    PathBuf::from(String::from_utf16_lossy(&buffer[..len]))
                                } else {
                                    PathBuf::new()
                                }
                            } else {
                                PathBuf::new()
                            }
                        }
                        Err(_) => PathBuf::new(),
                    }
                }
                Err(_) => PathBuf::new(),
            }
        };
        if resolved.as_os_str().is_empty() {
            continue;
        }
        record_exe(&mut map, &resolved);
    }

    unsafe { CoUninitialize() };
    map
}

#[cfg(not(windows))]
fn start_menu_exes() -> HashMap<String, PathBuf> {
    HashMap::new()
}

/// Depth-bounded walk for `.lnk` files.
fn collect_link_files(dir: &Path, depth: usize, out: &mut Vec<PathBuf>) {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            if depth > 0 {
                collect_link_files(&path, depth - 1, out);
            }
        } else if path
            .extension()
            .map(|ext| ext.to_string_lossy().eq_ignore_ascii_case("lnk"))
            .unwrap_or(false)
        {
            out.push(path);
        }
    }
}

/// Icons for packaged (MSIX/Store) apps: `executable name -> the package's own logo PNG`.
///
/// These apps have no executable a caller could extract an icon from — the binary lives under
/// `C:\Program Files\WindowsApps\<Package>\…`, which `ExtractIconExW` cannot read even when the file can be opened, and
/// the name in the tracker is the packaged executable (`claude.exe`, `windowsterminal.exe`) rather than anything the
/// registry's uninstall list knows about. The package manifest states the logo itself, so it is read from there.
///
/// The package list comes from the per-user AppModel repository, which needs no elevation. Each `PackageRoot` is
/// readable by path even though listing `WindowsApps` is denied — the directory ACL allows traversing a named package.
#[cfg(windows)]
fn appx_logos() -> HashMap<String, PathBuf> {
    use winreg::enums::{HKEY_CURRENT_USER, KEY_READ};
    use winreg::RegKey;

    const PACKAGES: &str =
        r"Software\Classes\Local Settings\Software\Microsoft\Windows\CurrentVersion\AppModel\Repository\Packages";

    let mut map = HashMap::new();
    let Ok(key) = RegKey::predef(HKEY_CURRENT_USER).open_subkey_with_flags(PACKAGES, KEY_READ) else {
        return map;
    };

    for name in key.enum_keys().flatten() {
        let Ok(entry) = key.open_subkey_with_flags(&name, KEY_READ) else {
            continue;
        };
        let Ok(root) = entry.get_value::<String, _>("PackageRootFolder") else {
            continue;
        };
        let root = PathBuf::from(root.trim());
        let Ok(manifest) = std::fs::read_to_string(root.join("AppxManifest.xml")) else {
            continue;
        };
        for (exe, logo) in manifest_icons(&manifest) {
            let logo_path = resolve_assets(&root, &logo);
            if let Some(path) = logo_path {
                map.entry(exe.to_lowercase()).or_insert(path);
            }
        }
    }
    map
}

#[cfg(not(windows))]
fn appx_logos() -> HashMap<String, PathBuf> {
    HashMap::new()
}

/// Pull `(executable, logo)` pairs out of an `AppxManifest.xml`.
///
/// Deliberately a scan rather than an XML parser: the manifest is a flat, machine-generated document and the only
/// thing needed is the executable each `<Application>` names and the logo its `<uap:VisualElements>` declares. A
/// parser dependency for two attributes would be the larger commitment.
fn manifest_icons(manifest: &str) -> Vec<(String, String)> {
    let mut out = Vec::new();
    for chunk in manifest.split("<Application ").skip(1) {
        let Some(exe) = attribute(chunk, "Executable=\"") else {
            continue;
        };
        // Every Application carries its own VisualElements; the first logo attribute wins.
        let logo = attribute(chunk, "Square44x44Logo=\"")
            .or_else(|| attribute(chunk, "Square150x150Logo=\""))
            .or_else(|| attribute(chunk, "Logo=\""));
        let Some(logo) = logo else { continue };
        let exe_name = exe
            .rsplit(['\\', '/'])
            .next()
            .unwrap_or(&exe)
            .to_string();
        out.push((exe_name, logo.replace('\\', "/")));
    }
    out
}

fn attribute(chunk: &str, prefix: &str) -> Option<String> {
    let start = chunk.find(prefix)? + prefix.len();
    let rest = &chunk[start..];
    let end = rest.find('"')?;
    let value = rest[..end].trim();
    if value.is_empty() {
        None
    } else {
        Some(value.to_string())
    }
}

/// Turn a manifest logo path into a file that exists.
///
/// Manifests name the unqualified asset (`Assets\Square44x44Logo.png`) while the package ships qualified variants
/// (`…targetsize-44.png`, `…scale-150.png`). The assets folder can be listed, so the closest variant is chosen rather
/// than guessed: exact name first, then the same stem with any qualifier, preferring the one sized for the taskbar.
fn resolve_assets(root: &Path, logo: &str) -> Option<PathBuf> {
    let base = root.join(logo);
    if base.is_file() {
        return Some(base);
    }
    let dir = base.parent()?;
    let stem = base.file_stem()?.to_string_lossy().to_string();
    let entries = std::fs::read_dir(dir).ok()?;
    let mut candidates: Vec<PathBuf> = entries
        .flatten()
        .map(|entry| entry.path())
        .filter(|path| {
            path.file_name()
                .map(|name| name.to_string_lossy().starts_with(&format!("{stem}.")))
                .unwrap_or(false)
                && path
                    .extension()
                    .map(|ext| ext.eq_ignore_ascii_case("png"))
                    .unwrap_or(false)
        })
        .collect();
    candidates.sort_by_key(|path| {
        let name = path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_lowercase();
        // A 24 px list wants something at or just above 44 px; a 16 px asset is visibly soft and a 150 px tile is
        // wasted bytes, so the order is explicit rather than "any qualified variant".
        if name.contains("targetsize-44") {
            0
        } else if name.contains("targetsize-48") || name.contains("scale-200") {
            1
        } else if name.contains("targetsize-32") || name.contains("scale-150") {
            2
        } else if name.contains("targetsize-24") || name.contains("scale-125") {
            3
        } else if name.contains("targetsize-16") || name.contains("scale-100") {
            4
        } else {
            5
        }
    });
    candidates.into_iter().next()
}

/// Sweep the registry's install locations a level or two deeper than the general pass.
///
/// This is what finds the executables that live inside an application's own tree rather than beside its uninstaller:
/// `…\Git\mingw64\bin\git-credential-manager.exe` and `…\Git\usr\bin\mintty.exe` are three levels below the folder Git
/// registers, and the two-level sweep of `Program Files` never reaches them. The tree is small and known — that is the
/// point of using the registry's own answer instead of walking `Program Files` further.
///
/// Bounded by a shared directory budget, like every other sweep: a pathological install location must not turn a miss
/// into a disk walk.
fn install_location_exes(dirs: &[PathBuf]) -> HashMap<String, PathBuf> {
    let mut map = HashMap::new();
    let mut budget = INSTALL_DIR_SCAN_BUDGET;
    for dir in dirs {
        collect_exes(dir, INSTALL_DIR_SCAN_DEPTH, &mut budget, &mut map);
        if budget == 0 {
            log::debug!("Install-location sweep stopped at its directory budget");
            break;
        }
    }
    map
}

/// One bounded sweep of the directories programs actually install into, mapping every executable found.
///
/// Done once per session rather than once per miss: a per-name walk over the same roots cost **116 s** to backfill
/// 124 apps, almost all of it directories re-read for names that were never there. The result is a map, so a miss is
/// now a hash lookup.
///
/// The budget is deliberate: `%LOCALAPPDATA%\Programs` alone holds thousands of directories counting Python shims,
/// and this must never become a walk of the disk.
#[cfg_attr(not(windows), allow(dead_code))]
fn program_dir_exes() -> HashMap<String, PathBuf> {
    let mut roots = Vec::new();
    if let Ok(local) = std::env::var("LOCALAPPDATA") {
        // `Programs` holds the per-user installs; the bare root is worth including too — a Squirrel-style app lives at
        // `%LOCALAPPDATA%\<Vendor>pp-<version>\<app>.exe`, two levels down, and four of the eight apps this sweep
        // finds on this machine are found there rather than under Programs.
        roots.push(PathBuf::from(&local).join("Programs"));
        roots.push(PathBuf::from(&local));
    }
    for var in ["PROGRAMFILES", "PROGRAMFILES(X86)"] {
        if let Ok(value) = std::env::var(var) {
            roots.push(PathBuf::from(value));
        }
    }
    if let Ok(drive) = std::env::var("SystemDrive") {
        roots.push(PathBuf::from(format!("{drive}\\Program Files")));
    }
    roots.retain(|root| root.is_dir());

    let mut map = HashMap::new();
    let mut budget = SCAN_DIRECTORY_BUDGET;
    for root in &roots {
        collect_exes(root, INSTALL_SCAN_DEPTH, &mut budget, &mut map);
        if budget == 0 {
            break;
        }
    }
    map
}

fn collect_exes(
    dir: &Path,
    depth: usize,
    budget: &mut usize,
    out: &mut HashMap<String, PathBuf>,
) {
    if *budget == 0 {
        return;
    }
    *budget -= 1;
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            if depth > 0 {
                collect_exes(&path, depth - 1, budget, out);
            }
        } else if path
            .extension()
            .map(|ext| ext.to_string_lossy().eq_ignore_ascii_case("exe"))
            .unwrap_or(false)
        {
            if let Some(name) = path.file_name() {
                out.entry(name.to_string_lossy().to_lowercase())
                    .or_insert(path);
            }
        }
        if *budget == 0 {
            return;
        }
    }
}

/// The inbox tools: System32 first, then SysWOW64 and the Windows root.
fn from_system_dirs(file_name: &str) -> Option<PathBuf> {
    let root = std::env::var("SystemRoot").unwrap_or_else(|_| r"C:\Windows".to_string());
    for dir in [format!(r"{root}\System32"), format!(r"{root}\SysWOW64"), root] {
        let candidate = PathBuf::from(dir).join(file_name);
        if candidate.is_file() {
            return Some(candidate);
        }
    }
    None
}

static RESOLVER: Lazy<PathResolver> = Lazy::new(PathResolver::new);

/// Full path of the executable behind a stored process name, or `None` when nothing on this machine matches.
pub fn resolve(process_name: &str) -> Option<PathBuf> {
    RESOLVER.find(process_name)
}
