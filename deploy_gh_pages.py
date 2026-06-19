#!/usr/bin/env python3
"""Deploy portal + app to GitHub Pages (HashRouter build)"""
import os, sys, json, base64, urllib.request, shutil

TOKEN = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
if not TOKEN:
    print("ERROR: Set GITHUB_TOKEN or GH_TOKEN environment variable")
    sys.exit(1)
OWNER, REPO = "lzdb228", "content-studio"
API = f"https://api.github.com/repos/{OWNER}/{REPO}/git"
HEADERS = {"Authorization": f"token {TOKEN}", "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"}

def gh(method, path, data=None):
    url = f"{API}/{path}"
    req = urllib.request.Request(url, method=method, headers=HEADERS)
    if data: req.data = json.dumps(data).encode()
    with urllib.request.urlopen(req) as r: return json.loads(r.read())

DIST = "/xingliu-brain/products/content-studio/dist"
DEPLOY = "/tmp/gh_deploy_v2"
if os.path.exists(DEPLOY): shutil.rmtree(DEPLOY)
os.makedirs(f"{DEPLOY}/app", exist_ok=True)

# Copy build
shutil.copytree(DIST, f"{DEPLOY}/app", dirs_exist_ok=True)

PORTAL = """<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>星流原型工坊</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);min-height:100vh;color:#e2e8f0;display:flex;flex-direction:column;align-items:center;padding:60px 24px}
    h1{font-size:2.5rem;font-weight:700;background:linear-gradient(135deg,#6366f1,#8b5cf6,#a78bfa);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:8px}
    .sub{color:#94a3b8;font-size:1rem;margin-bottom:48px}
    .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:24px;max-width:960px;width:100%}
    .card{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:32px;transition:all .3s;text-decoration:none;color:inherit;display:block}
    .card:hover{background:rgba(99,102,241,.12);border-color:rgba(99,102,241,.4);transform:translateY(-4px);box-shadow:0 12px 40px rgba(99,102,241,.15)}
    .icon{font-size:2rem;margin-bottom:16px}
    .card h2{font-size:1.25rem;font-weight:600;margin-bottom:8px;color:#f1f5f9}
    .card p{font-size:.875rem;color:#94a3b8;line-height:1.6}
    .badge{display:inline-block;font-size:.75rem;padding:2px 10px;border-radius:20px;margin-top:12px;background:rgba(99,102,241,.2);color:#a5b4fc}
    .ft{margin-top:80px;color:#475569;font-size:.75rem}
  </style>
</head>
<body>
<h1>星流原型工坊</h1>
<p class="sub">内容工坊 &amp; 更多产品 · 快速原型验证</p>
<div class="grid">
<a href="./app/" class="card"><div class="icon">📝</div><h2>内容工坊</h2><p>多平台采集→蒸馏→二创→发布。对标账号管理、AI改写、一键发布微信公众号。</p><span class="badge">Phase 1 MVP</span></a>
<div class="card" style="opacity:.4;pointer-events:none"><div class="icon">🔮</div><h2>更多产品即将上线</h2><p>新产品原型将陆续部署到这里。</p><span class="badge">规划中</span></div>
</div>
<p class="ft">xingliu-brain · GitHub Pages · prototype.fuyexingqiu.cn</p>
</body>
</html>"""

def blob(data):
    b = base64.b64encode(data if isinstance(data,bytes) else data.encode()).decode()
    return gh("POST","blobs",{"content":b,"encoding":"base64"})["sha"]

tree_entries = []
tree_entries.append({"path":"index.html","mode":"100644","type":"blob","sha":blob(PORTAL)})

for root,dirs,files in os.walk(f"{DEPLOY}/app"):
    for f in files:
        path = os.path.join(root,f)
        rel = os.path.relpath(path, DEPLOY)
        with open(path,"rb") as fh:
            tree_entries.append({"path":rel,"mode":"100644","type":"blob","sha":blob(fh.read())})
        print(f"  + {rel}")

print(f"\n{len(tree_entries)} files")
tree_sha = gh("POST","trees",{"tree":tree_entries})["sha"]
main_sha = gh("GET","refs/heads/main")["object"]["sha"]
commit_sha = gh("POST","commits",{"message":"deploy: portal + HashRouter app","tree":tree_sha,"parents":[main_sha]})["sha"]
gh("PATCH","refs/heads/gh-pages",{"sha":commit_sha,"force":True})

# Trigger build
urllib.request.urlopen(urllib.request.Request(
    f"https://api.github.com/repos/{OWNER}/{REPO}/pages/builds",
    method="POST", headers=HEADERS))

print(f"\n=== DONE ===")
print(f"https://lzdb228.github.io/content-studio/")
