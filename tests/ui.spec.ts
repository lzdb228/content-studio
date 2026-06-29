import { test, expect } from "@playwright/test";

// ── Helper: login via UI ──────────────────────────
async function login(page: any) {
  await page.goto("/login");
  await page.fill('input[placeholder="用户名"]', "admin");
  await page.fill('input[placeholder="密码"]', "123456");
  await page.click('button[type="submit"]');
  // Mock login sets auth store, then App re-renders and redirects to /dashboard
  await page.waitForURL("**/dashboard", { timeout: 8000 });
  await expect(page.locator("h1")).toContainText("对标管理", { timeout: 5000 });
}

// ═══════════════════════════════════════════════════
// 1. LoginPage
// ═══════════════════════════════════════════════════
test.describe("LoginPage", () => {
  test("renders login form", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("h1")).toContainText("微信公众号内容工厂");
    await expect(page.locator('input[placeholder="用户名"]')).toBeVisible();
    await expect(page.locator('input[placeholder="密码"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toHaveText("登录");
  });

  test("shows error on empty submit", async ({ page }) => {
    await page.goto("/login");
    await page.click('button[type="submit"]');
    await expect(page.locator("text=请输入用户名和密码")).toBeVisible();
  });

  test("login redirects to dashboard", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[placeholder="用户名"]', "admin");
    await page.fill('input[placeholder="密码"]', "123456");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/dashboard");
    await expect(page.locator("h1")).toContainText("对标管理");
  });

  test("unauthenticated redirects to login", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForURL("**/login");
    await expect(page.locator("h1")).toContainText("微信公众号内容工厂");
  });
});

// ═══════════════════════════════════════════════════
// 2. DashboardPage
// ═══════════════════════════════════════════════════
test.describe("DashboardPage", () => {
  test("renders main layout after login", async ({ page }) => {
    await login(page);
    await expect(page.locator("h1")).toContainText("对标管理");
    await expect(page.locator("text=管理你的对标公众号账号")).toBeVisible();
  });

  test("side navigation shows all 6 items", async ({ page }) => {
    await login(page);
    const navItems = ["对标管理", "一键采集", "风格蒸馏", "创作工坊", "素材库", "设置"];
    for (const item of navItems) {
      await expect(page.locator("aside").locator(`text=${item}`)).toBeVisible();
    }
  });

  test("shows loading or content area after login", async ({ page }) => {
    await login(page);
    // API may fail (remote unreachable) → error state; or succeed → empty/data state
    // Either way, the content area should be rendered
    await expect(page.locator("h1")).toContainText("对标管理");
  });

  test("refresh and add buttons visible", async ({ page }) => {
    await login(page);
    await expect(page.locator('button:has-text("刷新")')).toBeVisible();
    await expect(page.locator('button:has-text("添加账号")')).toBeVisible();
  });

  test("navigates to each page from sidebar", async ({ page }) => {
    await login(page);
    // Click each nav item and check heading
    const routes = [
      { label: "对标管理", heading: "对标管理" },
      { label: "一键采集", heading: "一键采集" },
      { label: "素材库", heading: "素材库" },
      { label: "设置", heading: "设置" },
    ];
    for (const { label, heading } of routes) {
      await page.locator("aside").locator(`text=${label}`).click();
      await expect(page.locator("h1")).toContainText(heading);
    }
  });

  test("logout returns to login page", async ({ page }) => {
    await login(page);
    await page.click('button:has-text("退出")');
    await page.waitForURL("**/login");
    await expect(page.locator("h1")).toContainText("微信公众号内容工厂");
  });
});

// ═══════════════════════════════════════════════════
// 3. CollectPage
// ═══════════════════════════════════════════════════
test.describe("CollectPage", () => {
  test("shows initial sync prompt", async ({ page }) => {
    await login(page);
    await page.locator("aside").locator("text=一键采集").click();
    await expect(page.locator("h1")).toContainText("一键采集");
    await expect(page.locator("text=准备同步对标账号")).toBeVisible();
    await expect(page.locator('button:has-text("开始同步")')).toBeVisible();
  });

  test("shows sync button and description", async ({ page }) => {
    await login(page);
    await page.locator("aside").locator("text=一键采集").click();
    await expect(page.locator("text=同步对标账号的最新文章到飞书素材库")).toBeVisible();
  });
});

// ═══════════════════════════════════════════════════
// 4. CreatePage (创作工坊)
// ═══════════════════════════════════════════════════
test.describe("CreatePage", () => {
  test("renders creative workshop layout", async ({ page }) => {
    await login(page);
    await page.locator("aside").locator("text=创作工坊").click();
    await expect(page.locator("h1")).toContainText("创作工坊");
    await expect(page.locator("text=AI 改写 + 去AI扫描 + 保存入库 + 一键发布")).toBeVisible();
  });

  test("shows article type selector with two modes", async ({ page }) => {
    await login(page);
    await page.locator("aside").locator("text=创作工坊").click();
    await expect(page.locator("text=原创创作")).toBeVisible();
    await expect(page.locator("text=对标创作")).toBeVisible();
  });

  test("shows style template selector", async ({ page }) => {
    await login(page);
    await page.locator("aside").locator("text=创作工坊").click();
    await expect(page.locator("text=风格模板：")).toBeVisible();
  });

  test("shows title input and tab switcher", async ({ page }) => {
    await login(page);
    await page.locator("aside").locator("text=创作工坊").click();
    await expect(page.locator('input[placeholder="文章标题..."]')).toBeVisible();
    await expect(page.locator('button:has-text("编辑")')).toBeVisible();
    await expect(page.locator('button:has-text("扫描结果")')).toBeVisible();
    await expect(page.locator('button:has-text("预览")')).toBeVisible();
  });

  test("shows textarea and action buttons", async ({ page }) => {
    await login(page);
    await page.locator("aside").locator("text=创作工坊").click();
    await expect(page.locator('textarea[placeholder="在此输入或粘贴文章内容..."]')).toBeVisible();
    await expect(page.locator('button:has-text("AI改写")')).toBeVisible();
    await expect(page.locator('button:has-text("AI扫描")')).toBeVisible();
    await expect(page.locator('button:has-text("保存入库")')).toBeVisible();
    await expect(page.locator('button:has-text("发布草稿")')).toBeVisible();
  });

  test("switches to preview tab shows empty state", async ({ page }) => {
    await login(page);
    await page.locator("aside").locator("text=创作工坊").click();
    await page.locator('button:has-text("预览")').click();
    await expect(page.locator("text=暂无内容")).toBeVisible();
  });

  test("switches to scan tab shows empty state", async ({ page }) => {
    await login(page);
    await page.locator("aside").locator("text=创作工坊").click();
    await page.locator('button:has-text("扫描结果")').click();
    await expect(page.locator("text=尚未扫描")).toBeVisible();
  });

  test("switches to benchmark mode shows account selector", async ({ page }) => {
    await login(page);
    await page.locator("aside").locator("text=创作工坊").click();
    await page.locator("text=对标创作").click();
    // The label "对标账号" appears inside the benchmark section
    await expect(page.locator("label").filter({ hasText: "对标账号" })).toBeVisible();
  });

  test("style card panel shows available styles", async ({ page }) => {
    await login(page);
    await page.locator("aside").locator("text=创作工坊").click();
    await expect(page.locator("text=可用风格")).toBeVisible();
  });
});

// ═══════════════════════════════════════════════════
// 5. LibraryPage (素材库)
// ═══════════════════════════════════════════════════
test.describe("LibraryPage", () => {
  test("renders library with empty state", async ({ page }) => {
    await login(page);
    await page.locator("aside").locator("text=素材库").click();
    await expect(page.locator("h1")).toContainText("素材库");
    await expect(page.locator("text=素材库为空")).toBeVisible();
  });

  test("shows search input and refresh button", async ({ page }) => {
    await login(page);
    await page.locator("aside").locator("text=素材库").click();
    await expect(page.locator('input[placeholder="搜索标题或公众号..."]')).toBeVisible();
    await expect(page.locator('button:has-text("刷新")')).toBeVisible();
  });

  test("shows article count", async ({ page }) => {
    await login(page);
    await page.locator("aside").locator("text=素材库").click();
    await expect(page.locator("text=0 篇文章")).toBeVisible();
  });

  test("search with no results shows message", async ({ page }) => {
    await login(page);
    await page.locator("aside").locator("text=素材库").click();
    await page.fill('input[placeholder="搜索标题或公众号..."]', "不存在的文章");
    await expect(page.locator("text=无匹配文章")).toBeVisible();
  });
});

// ═══════════════════════════════════════════════════
// 6. DistillPage (风格蒸馏)
// ═══════════════════════════════════════════════════
test.describe("DistillPage", () => {
  test("renders distill wizard", async ({ page }) => {
    await login(page);
    await page.locator("aside").locator("text=风格蒸馏").click();
    await expect(page.locator("h1")).toContainText("风格蒸馏");
    await expect(page.locator("text=搜索公众号 → 拉取最新文章 → 选择蒸馏 → AI 提取写作风格")).toBeVisible();
  });

  test("shows 5-step indicator", async ({ page }) => {
    await login(page);
    await page.locator("aside").locator("text=风格蒸馏").click();
    const steps = ["搜索选择", "文章选择", "内容预览", "风格分析", "保存入库"];
    for (const step of steps) {
      await expect(page.locator(`text=${step}`)).toBeVisible();
    }
  });

  test("step 1 shows search input and batch toggle", async ({ page }) => {
    await login(page);
    await page.locator("aside").locator("text=风格蒸馏").click();
    await expect(page.locator('input[placeholder*="搜索微信公众号名称"]')).toBeVisible();
    await expect(page.locator("text=批量蒸馏模式")).toBeVisible();
  });

  test("next button disabled at step 1 without selection", async ({ page }) => {
    await login(page);
    await page.locator("aside").locator("text=风格蒸馏").click();
    const nextBtn = page.locator('button:has-text("下一步 →")');
    await expect(nextBtn).toBeDisabled();
  });

  test("shows existing style cards panel", async ({ page }) => {
    await login(page);
    await page.locator("aside").locator("text=风格蒸馏").click();
    await expect(page.locator("text=已有风格卡")).toBeVisible();
  });

  test("previous button hidden at step 1", async ({ page }) => {
    await login(page);
    await page.locator("aside").locator("text=风格蒸馏").click();
    const prevBtn = page.locator('button:has-text("上一步")');
    await expect(prevBtn).not.toBeVisible();
  });
});

// ═══════════════════════════════════════════════════
// 7. SettingsPage
// ═══════════════════════════════════════════════════
test.describe("SettingsPage", () => {
  test("renders settings form", async ({ page }) => {
    await login(page);
    await page.locator("aside").locator("text=设置").click();
    await expect(page.locator("h1")).toContainText("设置");
    await expect(page.locator("text=配置飞书连接和内容工厂")).toBeVisible();
  });

  test("shows Feishu API config section", async ({ page }) => {
    await login(page);
    await page.locator("aside").locator("text=设置").click();
    await expect(page.locator("text=飞书 API 配置")).toBeVisible();
    // Use label selector for form fields to avoid ambiguity with guide text
    await expect(page.locator("label").filter({ hasText: "App ID" })).toBeVisible();
    await expect(page.locator("label").filter({ hasText: "App Secret" })).toBeVisible();
    await expect(page.locator("label").filter({ hasText: "内容工厂 Base Token" })).toBeVisible();
    await expect(page.locator('button:has-text("测试连接")')).toBeVisible();
  });

  test("shows setup guide", async ({ page }) => {
    await login(page);
    await page.locator("aside").locator("text=设置").click();
    await expect(page.locator("text=还没有内容工厂？")).toBeVisible();
    const steps = page.locator("ol li");
    await expect(steps).toHaveCount(4);
  });

  test("test connection with empty fields shows error", async ({ page }) => {
    await login(page);
    await page.locator("aside").locator("text=设置").click();
    await page.click('button:has-text("测试连接")');
    await expect(page.locator("text=请填写所有飞书配置字段")).toBeVisible();
  });
});
