use serde::{Deserialize, Serialize};
use std::process::{Command, Child};
use std::sync::Mutex;
use tauri::State;
use tauri_plugin_store::StoreExt;

#[allow(dead_code)]

// ── Auth ──────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct AuthToken {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_in: Option<u64>,
}

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

/// 调用 xingliu-plus-uniapp 认证接口
#[tauri::command]
async fn login(req: LoginRequest) -> Result<AuthToken, String> {
    let client = reqwest::Client::new();
    let resp = client
        .post("http://127.0.0.1:5504/auth/userLogin")
        .json(&serde_json::json!({
            "userName": req.username,
            "password": req.password,
            "authType": "password"
        }))
        .header("isEncrypt", "true")
        .send()
        .await
        .map_err(|e| format!("认证服务不可用: {}", e))?;

    let body: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let code = body.get("code").and_then(|v| v.as_i64()).unwrap_or(-1);

    if code != 200 {
        let msg = body.get("msg").and_then(|v| v.as_str()).unwrap_or("未知错误");
        return Err(msg.to_string());
    }

    let data = body.get("data").ok_or("响应格式异常")?;
    Ok(AuthToken {
        access_token: data["access_token"].as_str().unwrap_or("").to_string(),
        refresh_token: data["refresh_token"].as_str().map(|s| s.to_string()),
        expires_in: data["expires_in"].as_u64(),
    })
}

// ── Secrets ────────────────────────────────────────

#[tauri::command]
fn store_secret(app: tauri::AppHandle, key: String, value: String) -> Result<(), String> {
    let store = app.store("secrets.json").map_err(|e| e.to_string())?;
    store.set(key, serde_json::Value::String(value));
    store.save().map_err(|e| e.to_string())
}

#[tauri::command]
fn get_secret(app: tauri::AppHandle, key: String) -> Result<Option<String>, String> {
    let store = app.store("secrets.json").map_err(|e| e.to_string())?;
    let val: Option<serde_json::Value> = store.get(key);
    Ok(val.and_then(|v| v.as_str().map(|s| s.to_string())))
}

// ── Feishu API ─────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct FeishuTable {
    pub name: String,
    pub table_id: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FeishuRecord {
    pub id: String,
    pub fields: serde_json::Value,
}

/// 获取飞书多维表格的表列表
#[tauri::command]
async fn get_feishu_tables(app_id: String, app_secret: String, base_token: String) -> Result<Vec<FeishuTable>, String> {
    let token = get_tenant_token(&app_id, &app_secret).await?;
    let client = reqwest::Client::new();
    let resp = client
        .get(&format!("https://open.feishu.cn/open-apis/bitable/v1/apps/{}/tables", base_token))
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .map_err(|e| format!("飞书 API 错误: {}", e))?;

    let body: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let items = body["data"]["items"].as_array().ok_or("响应格式异常")?;

    Ok(items.iter().map(|t| FeishuTable {
        name: t["name"].as_str().unwrap_or("").to_string(),
        table_id: t["table_id"].as_str().unwrap_or("").to_string(),
    }).collect())
}

/// 获取飞书多维表格的记录列表
#[tauri::command]
async fn get_feishu_records(
    app_id: String, app_secret: String,
    base_token: String, table_id: String,
    page_size: Option<u32>,
) -> Result<Vec<FeishuRecord>, String> {
    let token = get_tenant_token(&app_id, &app_secret).await?;
    let client = reqwest::Client::new();
    let size = page_size.unwrap_or(50);

    let resp = client
        .get(&format!(
            "https://open.feishu.cn/open-apis/bitable/v1/apps/{}/tables/{}/records?page_size={}",
            base_token, table_id, size
        ))
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .map_err(|e| format!("飞书 API 错误: {}", e))?;

    let body: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let items = body["data"]["items"].as_array().ok_or("响应格式异常")?;

    Ok(items.iter().map(|r| FeishuRecord {
        id: r["record_id"].as_str().unwrap_or("").to_string(),
        fields: r["fields"].clone(),
    }).collect())
}

async fn get_tenant_token(app_id: &str, app_secret: &str) -> Result<String, String> {
    let client = reqwest::Client::new();
    let resp = client
        .post("https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal")
        .json(&serde_json::json!({
            "app_id": app_id,
            "app_secret": app_secret
        }))
        .send()
        .await
        .map_err(|e| format!("获取飞书 token 失败: {}", e))?;

    let body: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    body["tenant_access_token"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or("飞书 token 响应异常".to_string())
}

// ── Sidecar ─────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct CollectResult {
    pub success: bool,
    pub account_name: String,
    pub new_articles: u32,
    pub updated_articles: u32,
    pub error: Option<String>,
}

pub struct SidecarProcess(Mutex<Option<Child>>);

/// 启动 FastAPI sidecar
#[tauri::command]
fn start_sidecar() -> Result<String, String> {
    // Check if Python is available
    let python = if Command::new("python3").arg("--version").output().is_ok() {
        "python3"
    } else if Command::new("python").arg("--version").output().is_ok() {
        "python"
    } else {
        return Err("Python 未安装，请先安装 Python 3.10+".to_string());
    };

    // Launch FastAPI sidecar
    let child = Command::new(python)
        .args(["-m", "uvicorn", "sidecar.main:app", "--host", "127.0.0.1", "--port", "5200"])
        .current_dir(env!("CARGO_MANIFEST_DIR")) // src-tauri/ dir
        .spawn()
        .map_err(|e| format!("启动 sidecar 失败: {}", e))?;

    Ok(format!("Sidecar 已启动: {} (pid: {})", python, child.id()))
}

/// 触发全部对标账号采集
#[tauri::command]
async fn sync_all_accounts() -> Result<Vec<CollectResult>, String> {
    let client = reqwest::Client::new();
    let resp = client
        .post("http://127.0.0.1:5200/api/collect/sync")
        .timeout(std::time::Duration::from_secs(300))
        .send()
        .await
        .map_err(|e| format!("Sidecar 不可用: {}", e))?;

    let results: Vec<CollectResult> = resp.json().await.map_err(|e| e.to_string())?;
    Ok(results)
}

// ── App Entry ───────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            login,
            store_secret,
            get_secret,
            get_feishu_tables,
            get_feishu_records,
            sync_all_accounts,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
