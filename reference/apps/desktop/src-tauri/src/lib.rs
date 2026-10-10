//! The desktop shell. It owns the window, menu, process lifecycle, native
//! dialogs, and the native webviews behind browser tabs (`browser`), and
//! nothing else: every feature lives in the Elixir host and its plugins.
//!
//! The shell starts the host with `FATHOM_DESKTOP=1`, waits for the line
//! `FATHOM_READY <url>` on its stdout, and points the window at that URL,
//! which carries a one-time launch token. The host's stdin stays open for the
//! shell's lifetime; closing it on exit tells the host to stop.

mod browser;

use std::io::{BufRead, BufReader};
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use tauri::{AppHandle, Manager, RunEvent, Url};

const SHUTDOWN_GRACE: Duration = Duration::from_secs(5);

struct Host {
    child: Mutex<Option<Child>>,
    stdin: Mutex<Option<ChildStdin>>,
}

/// Development runs the host from source; a bundle runs the release it ships.
fn host_command(app: &AppHandle) -> Command {
    if cfg!(debug_assertions) {
        let mut command = Command::new("mix");
        command
            .arg("phx.server")
            .current_dir(concat!(env!("CARGO_MANIFEST_DIR"), "/../../fathom"));
        command
    } else {
        let release = app
            .path()
            .resource_dir()
            .expect("the bundle has a resource directory")
            .join("fathom");
        let mut command = Command::new(release.join("bin/fathom"));
        command.arg("start");
        command
    }
}

fn start_host(app: &AppHandle) -> std::io::Result<()> {
    let mut child = host_command(app)
        .env("FATHOM_DESKTOP", "1")
        .env("FATHOM_PARENT_STDIN", "1")
        .env("PORT", "0")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::inherit())
        .spawn()?;

    let stdout = child.stdout.take().expect("stdout is piped");
    let stdin = child.stdin.take();

    app.manage(Host {
        child: Mutex::new(Some(child)),
        stdin: Mutex::new(stdin),
    });

    let app = app.clone();

    std::thread::spawn(move || {
        for line in BufReader::new(stdout).lines().map_while(Result::ok) {
            match line.strip_prefix("FATHOM_READY ") {
                Some(url) => open(&app, url.trim()),
                None => println!("{line}"),
            }
        }
    });

    Ok(())
}

fn open(app: &AppHandle, url: &str) {
    match (app.get_webview_window("main"), Url::parse(url)) {
        (Some(window), Ok(url)) => {
            if let Err(error) = window.navigate(url) {
                log::error!("cannot open the host page: {error}");
            }
        }
        _ => log::error!("cannot open the host page at {url}"),
    }
}

/// Close stdin so the host stops its plugins in order; kill it if it lingers.
fn stop_host(app: &AppHandle) {
    let Some(host) = app.try_state::<Host>() else {
        return;
    };

    drop(host.stdin.lock().unwrap().take());

    if let Some(mut child) = host.child.lock().unwrap().take() {
        let deadline = Instant::now() + SHUTDOWN_GRACE;

        while Instant::now() < deadline {
            if let Ok(Some(_)) = child.try_wait() {
                return;
            }

            std::thread::sleep(Duration::from_millis(50));
        }

        let _ = child.kill();
        let _ = child.wait();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        // The native folder picker for choosing where an agent works.
        .plugin(tauri_plugin_dialog::init())
        .manage(browser::Browser::default())
        .invoke_handler(tauri::generate_handler![
            browser::browser,
            browser::browser_message
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            start_host(app.handle())?;
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app, event| {
        if let RunEvent::Exit = event {
            stop_host(app);
        }
    });
}
