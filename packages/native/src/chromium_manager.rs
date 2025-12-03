use napi::bindgen_prelude::*;
use napi_derive::napi;
use chromiumoxide::Browser;
use chromiumoxide::BrowserConfig;
use futures::StreamExt;
use std::sync::Arc;
use tokio::sync::Mutex;
use std::collections::HashMap;

// Global browser instances storage
lazy_static::lazy_static! {
    static ref BROWSERS: Arc<Mutex<HashMap<String, Arc<Browser>>>> = Arc::new(Mutex::new(HashMap::new()));
}

#[napi(object)]
pub struct ChromiumInstance {
    pub id: String,
    pub url: String,
    pub port: u32,
}

#[napi(object)]
pub struct ChromiumConfig {
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub headless: Option<bool>,
    pub disable_default_args: Option<bool>,
}

/// Launch a new Chromium browser instance with full control
#[napi]
pub async fn launch_chromium_browser(
    config: Option<ChromiumConfig>,
) -> Result<ChromiumInstance> {
    let cfg = config.unwrap_or(ChromiumConfig {
        width: Some(1920),
        height: Some(1080),
        headless: Some(false),
        disable_default_args: Some(false),
    });

    let mut browser_config = BrowserConfig::builder();

    if let Some(width) = cfg.width {
        if let Some(height) = cfg.height {
            browser_config = browser_config.window_size(width, height);
        }
    }

    if let Some(headless) = cfg.headless {
        if headless {
            browser_config = browser_config.with_head();
        }
    }

    let browser_cfg = browser_config.build()
        .map_err(|e| Error::new(Status::GenericFailure, format!("Failed to build config: {}", e)))?;

    let (browser, mut handler) = Browser::launch(browser_cfg)
        .await
        .map_err(|e| Error::new(Status::GenericFailure, format!("Failed to launch browser: {}", e)))?;

    // Spawn handler task
    let _handle = tokio::spawn(async move {
        while let Some(h) = handler.next().await {
            if h.is_err() {
                break;
            }
        }
    });

    let id = format!("chromium_{}", std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis());

    // Chrome DevTools Protocol default port
    let port = 9222;
    let browser_arc = Arc::new(browser);

    // Store browser instance
    let mut browsers = BROWSERS.lock().await;
    browsers.insert(id.clone(), browser_arc);

    Ok(ChromiumInstance {
        id,
        url: String::from("about:blank"),
        port,
    })
}

/// Navigate to a URL in the browser
#[napi]
pub async fn navigate_to_url(instance_id: String, url: String) -> Result<bool> {
    let browsers = BROWSERS.lock().await;
    let browser = browsers.get(&instance_id)
        .ok_or_else(|| Error::new(Status::InvalidArg, "Browser instance not found"))?;

    let page = browser.new_page(&url)
        .await
        .map_err(|e| Error::new(Status::GenericFailure, format!("Failed to create page: {}", e)))?;

    page.goto(&url)
        .await
        .map_err(|e| Error::new(Status::GenericFailure, format!("Failed to navigate: {}", e)))?;

    Ok(true)
}

/// Execute JavaScript in the browser
#[napi]
pub async fn execute_js_in_browser(
    instance_id: String,
    script: String,
) -> Result<String> {
    let browsers = BROWSERS.lock().await;
    let browser = browsers.get(&instance_id)
        .ok_or_else(|| Error::new(Status::InvalidArg, "Browser instance not found"))?;

    let pages = browser.pages().await
        .map_err(|e| Error::new(Status::GenericFailure, format!("Failed to get pages: {}", e)))?;

    if let Some(page) = pages.first() {
        let result = page.evaluate(script.as_str())
            .await
            .map_err(|e| Error::new(Status::GenericFailure, format!("Failed to execute JS: {}", e)))?;

        let json_value = serde_json::to_string(&result.value())
            .unwrap_or_else(|_| String::from("{}"));

        Ok(json_value)
    } else {
        Err(Error::new(Status::GenericFailure, "No active page found"))
    }
}

/// Take a screenshot of the browser page
#[napi]
pub async fn take_browser_screenshot(
    instance_id: String,
    output_path: String,
) -> Result<String> {
    let browsers = BROWSERS.lock().await;
    let browser = browsers.get(&instance_id)
        .ok_or_else(|| Error::new(Status::InvalidArg, "Browser instance not found"))?;

    let pages = browser.pages().await
        .map_err(|e| Error::new(Status::GenericFailure, format!("Failed to get pages: {}", e)))?;

    if let Some(page) = pages.first() {
        let screenshot = page.screenshot(chromiumoxide::page::ScreenshotParams::builder().build())
            .await
            .map_err(|e| Error::new(Status::GenericFailure, format!("Failed to take screenshot: {}", e)))?;

        std::fs::write(&output_path, screenshot)
            .map_err(|e| Error::new(Status::GenericFailure, format!("Failed to write screenshot: {}", e)))?;

        Ok(output_path)
    } else {
        Err(Error::new(Status::GenericFailure, "No active page found"))
    }
}

/// Get page HTML content
#[napi]
pub async fn get_page_content(instance_id: String) -> Result<String> {
    let browsers = BROWSERS.lock().await;
    let browser = browsers.get(&instance_id)
        .ok_or_else(|| Error::new(Status::InvalidArg, "Browser instance not found"))?;

    let pages = browser.pages().await
        .map_err(|e| Error::new(Status::GenericFailure, format!("Failed to get pages: {}", e)))?;

    if let Some(page) = pages.first() {
        let content = page.content()
            .await
            .map_err(|e| Error::new(Status::GenericFailure, format!("Failed to get content: {}", e)))?;

        Ok(content)
    } else {
        Err(Error::new(Status::GenericFailure, "No active page found"))
    }
}

/// Close the browser instance
#[napi]
pub async fn close_chromium_browser(instance_id: String) -> Result<bool> {
    let mut browsers = BROWSERS.lock().await;

    if browsers.remove(&instance_id).is_some() {
        // Browser will be dropped and cleaned up automatically
        Ok(true)
    } else {
        Err(Error::new(Status::InvalidArg, "Browser instance not found"))
    }
}
