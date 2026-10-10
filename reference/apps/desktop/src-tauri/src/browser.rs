//! Browser tabs: one native webview per tab, laid over the browser dock's
//! viewport in the Fathom page. The page (webview `main`) owns the tab list
//! and calls `browser` with which tab shows and where; page loads, titles,
//! new-window requests, and tab messages go back to it as `fathom:browser`
//! DOM events.
//!
//! The shell knows nothing about what the page does with tabs. The page can
//! give a script that runs in every new tab before the tab's own scripts,
//! run more script in a tab, and listen to one tab. Tab webviews may call
//! only `browser_message` (`capabilities/browser-tabs.json`), and the shell
//! passes a message on only from the tab the page is listening to, so a site
//! cannot reach Fathom unless the person asked for it.

use std::collections::HashSet;
use std::sync::Mutex;

use serde::Deserialize;
use serde_json::{Value, json};
use tauri::webview::{NewWindowResponse, PageLoadEvent};
use tauri::{
    AppHandle, LogicalPosition, LogicalSize, Manager, Rect, Url, Webview, WebviewBuilder,
    WebviewUrl, Window,
};

const PAGE: &str = "main";
const PREFIX: &str = "browser-";

/// Which tab shows, and the viewport it fills, in CSS pixels of the page.
///
/// Child webviews are placed from the top of the window's frame, but on macOS
/// the page starts below the title bar. The page reports its own height so
/// the difference can be added back.
#[derive(Default)]
pub struct Browser(Mutex<Shown>);

#[derive(Default)]
struct Shown {
    active: Option<u64>,
    bounds: Option<Bounds>,
    listening: Option<u64>,
    script: Option<String>,
}

/// Larger messages are refused; a tab should send descriptions, not pages.
const MESSAGE_LIMIT: usize = 256 * 1024;

#[derive(Clone, Copy, Deserialize)]
pub struct Bounds {
    x: f64,
    y: f64,
    width: f64,
    height: f64,
    page_height: f64,
}

#[derive(Deserialize)]
pub struct Page {
    id: u64,
    url: String,
}

#[derive(Deserialize)]
#[serde(tag = "op", rename_all = "snake_case")]
pub enum Op {
    /// The tabs that have pages, and the one to show. Creates and closes
    /// webviews to match; a page's URL is used only when it is created. A
    /// script, when given, runs in every tab created from now on.
    Sync {
        pages: Vec<Page>,
        active: Option<u64>,
        #[serde(default)]
        script: Option<String>,
    },
    /// The tab whose messages reach the page; `None` for no tab.
    Listen {
        id: Option<u64>,
    },
    /// Runs script in a tab's page. Nothing comes back.
    Eval {
        id: u64,
        js: String,
    },
    /// Where the viewport is now; `None` hides every tab.
    Bounds {
        bounds: Option<Bounds>,
    },
    Navigate {
        id: u64,
        url: String,
    },
    Back {
        id: u64,
    },
    Forward {
        id: u64,
    },
    Reload {
        id: u64,
    },
}

#[tauri::command]
pub async fn browser(app: AppHandle, webview: Webview, op: Op) -> Result<(), String> {
    if webview.label() != PAGE {
        return Err("only the Fathom page drives browser tabs".into());
    }

    run(&app, op).map_err(|error| error.to_string())
}

/// A message from a tab's page for the Fathom page.
#[tauri::command]
pub async fn browser_message(
    app: AppHandle,
    webview: Webview,
    message: Value,
) -> Result<(), String> {
    let id = webview
        .label()
        .strip_prefix(PREFIX)
        .and_then(|id| id.parse::<u64>().ok())
        .ok_or_else(|| "only browser tabs send messages".to_string())?;

    if app.state::<Browser>().0.lock().unwrap().listening != Some(id) {
        return Err("Fathom is not listening to this tab".into());
    }

    if message.to_string().len() > MESSAGE_LIMIT {
        return Err("the message is too large".into());
    }

    notify(
        &app,
        json!({"type": "message", "id": id, "message": message}),
    );
    Ok(())
}

fn run(app: &AppHandle, op: Op) -> Result<(), Box<dyn std::error::Error>> {
    let browser = app.state::<Browser>();

    match op {
        Op::Sync {
            pages,
            active,
            script,
        } => {
            let window = app.get_window(PAGE).ok_or("the main window is gone")?;
            let script = {
                let mut shown = browser.0.lock().unwrap();
                if script.is_some() {
                    shown.script = script;
                }
                shown.script.clone()
            };
            let wanted: HashSet<String> = pages.iter().map(|page| label(page.id)).collect();

            for (label, webview) in app.webviews() {
                if label.starts_with(PREFIX) && !wanted.contains(&label) {
                    webview.close()?;
                }
            }

            for page in &pages {
                if app.get_webview(&label(page.id)).is_none() {
                    create(app, &window, page, script.as_deref())?;
                }
            }

            let mut shown = browser.0.lock().unwrap();
            shown.active = active;
            apply(app, &shown)
        }
        Op::Bounds { bounds } => {
            let mut shown = browser.0.lock().unwrap();
            shown.bounds = bounds;
            apply(app, &shown)
        }
        Op::Listen { id } => {
            browser.0.lock().unwrap().listening = id;
            Ok(())
        }
        Op::Eval { id, js } => with_tab(app, id, |tab| Ok(tab.eval(js)?)),
        Op::Navigate { id, url } => with_tab(app, id, |tab| Ok(tab.navigate(url.parse()?)?)),
        Op::Back { id } => with_tab(app, id, |tab| Ok(tab.eval("history.back()")?)),
        Op::Forward { id } => with_tab(app, id, |tab| Ok(tab.eval("history.forward()")?)),
        Op::Reload { id } => with_tab(app, id, |tab| Ok(tab.reload()?)),
    }
}

fn label(id: u64) -> String {
    format!("{PREFIX}{id}")
}

fn with_tab(
    app: &AppHandle,
    id: u64,
    action: impl FnOnce(Webview) -> Result<(), Box<dyn std::error::Error>>,
) -> Result<(), Box<dyn std::error::Error>> {
    match app.get_webview(&label(id)) {
        Some(tab) => action(tab),
        None => Ok(()),
    }
}

/// Shows the active tab at the viewport's bounds and hides the rest.
fn apply(app: &AppHandle, shown: &Shown) -> Result<(), Box<dyn std::error::Error>> {
    for (label, tab) in app.webviews() {
        let Some(id) = label
            .strip_prefix(PREFIX)
            .and_then(|id| id.parse::<u64>().ok())
        else {
            continue;
        };

        match (shown.active == Some(id), shown.bounds) {
            (true, Some(bounds)) => {
                let top = page_top(app, bounds.page_height)?;
                tab.set_bounds(Rect {
                    position: LogicalPosition::new(bounds.x, top + bounds.y).into(),
                    size: LogicalSize::new(bounds.width, bounds.height).into(),
                })?;
                tab.show()?;
            }
            _ => tab.hide()?,
        }
    }

    Ok(())
}

/// How far below the frame's top the page starts.
fn page_top(app: &AppHandle, page_height: f64) -> Result<f64, Box<dyn std::error::Error>> {
    let window = app.get_window(PAGE).ok_or("the main window is gone")?;
    let frame = window
        .inner_size()?
        .to_logical::<f64>(window.scale_factor()?);
    Ok((frame.height - page_height).max(0.0))
}

fn create(
    app: &AppHandle,
    window: &Window,
    page: &Page,
    script: Option<&str>,
) -> Result<Webview, Box<dyn std::error::Error>> {
    let url: Url = page.url.parse()?;
    let id = page.id;
    let (on_load, on_title, on_open) = (app.clone(), app.clone(), app.clone());

    let mut builder = WebviewBuilder::new(label(id), WebviewUrl::External(url));
    if let Some(script) = script {
        builder = builder.initialization_script(script);
    }

    let builder = builder
        .on_page_load(move |_tab, load| {
            let loading = matches!(load.event(), PageLoadEvent::Started);
            notify(
                &on_load,
                json!({"type": "load", "id": id, "url": load.url().as_str(), "loading": loading}),
            );
        })
        .on_document_title_changed(move |_tab, title| {
            notify(
                &on_title,
                json!({"type": "title", "id": id, "title": title}),
            );
        })
        // Links that open a window open a tab instead.
        .on_new_window(move |url, _features| {
            notify(&on_open, json!({"type": "open", "url": url.as_str()}));
            NewWindowResponse::Deny
        });

    let tab = window.add_child(
        builder,
        LogicalPosition::new(0.0, 0.0),
        LogicalSize::new(1.0, 1.0),
    )?;
    tab.hide()?;
    Ok(tab)
}

fn notify(app: &AppHandle, detail: Value) {
    if let Some(page) = app.get_webview(PAGE) {
        let script = format!(
            "window.dispatchEvent(new CustomEvent('fathom:browser', {{detail: {detail}}}))"
        );

        if let Err(error) = page.eval(script) {
            log::error!("cannot notify the Fathom page: {error}");
        }
    }
}
