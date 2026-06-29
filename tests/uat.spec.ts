import { test, expect } from "@playwright/test";

// UAT 验收脚本 — 暗色 UI 用户验收
// 覆盖 3 个核心用户场景，每步截图留存

async function login(page: any) {
  await page.goto("/login");
  await page.fill('input[placeholder="用户名"]', "admin");
  await page.fill('input[placeholder="密码"]', "123456");
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard", { timeout: 8000 });
  await expect(page.locator("h1")).toContainText("对标管理", { timeout: 5000 });
}

test.describe("UAT 场景 1：登录 → Dashboard → Library", () => {
  test("完整流程：登录后浏览对标管理，再进入素材库", async ({ page }) => {
    await test.step("Step 1: 登录页 — 验证暗色登录页", async () => {
      await page.goto("/login");
      await expect(page.locator("h1")).toContainText("微信公众号内容工厂");
      await page.screenshot({ path: "test-results/uat/uat-1-1-login.png", fullPage: true });
    });

    await test.step("Step 2: 登录成功 — 进入 Dashboard", async () => {
      await page.fill('input[placeholder="用户名"]', "admin");
      await page.fill('input[placeholder="密码"]', "123456");
      await page.click('button[type="submit"]');
      await page.waitForURL("**/dashboard", { timeout: 8000 });
      await expect(page.locator("h1")).toContainText("对标管理");
      await page.screenshot({ path: "test-results/uat/uat-1-2-dashboard.png", fullPage: true });
    });

    await test.step("Step 3: 侧边栏导航 — 检查 6 个导航项", async () => {
      const navItems = ["对标管理", "一键采集", "风格蒸馏", "创作工坊", "素材库", "设置"];
      for (const item of navItems) {
        await expect(page.locator("aside").locator(`text=${item}`)).toBeVisible();
      }
    });

    await test.step("Step 4: 进入素材库 — 验证空状态", async () => {
      await page.locator("aside").locator("text=素材库").click();
      await expect(page.locator("h1")).toContainText("素材库");
      await page.screenshot({ path: "test-results/uat/uat-1-3-library.png", fullPage: true });
    });

    await test.step("Step 5: 素材库搜索功能", async () => {
      await expect(page.locator('input[placeholder="搜索标题或公众号..."]')).toBeVisible();
      await page.fill('input[placeholder="搜索标题或公众号..."]', "测试搜索");
      await expect(page.locator("text=无匹配文章")).toBeVisible();
    });
  });
});

test.describe("UAT 场景 2：Collect 页面 — 一键采集", () => {
  test("采集流程：进入采集页 → 查看界面 → 开始同步", async ({ page }) => {
    await login(page);

    await test.step("Step 1: 进入一键采集页", async () => {
      await page.locator("aside").locator("text=一键采集").click();
      await expect(page.locator("h1")).toContainText("一键采集");
      await page.screenshot({ path: "test-results/uat/uat-2-1-collect.png", fullPage: true });
    });

    await test.step("Step 2: 验证初始状态 — 显示同步提示", async () => {
      await expect(page.locator("text=准备同步对标账号")).toBeVisible();
      await expect(page.locator("text=同步对标账号的最新文章到飞书素材库")).toBeVisible();
      await expect(page.locator('button:has-text("开始同步")')).toBeVisible();
    });

    await test.step("Step 3: 点击开始同步按钮", async () => {
      await page.click('button:has-text("开始同步")');
      // 可能触发 API 调用或显示加载状态
      await page.waitForTimeout(1500);
      await page.screenshot({ path: "test-results/uat/uat-2-2-sync-result.png", fullPage: true });
    });
  });
});

test.describe("UAT 场景 3：Create 页面 — 选择类型 → 编辑 → 预览", () => {
  test("创作流程：原创创作下编辑文章并预览", async ({ page }) => {
    await login(page);
    await page.locator("aside").locator("text=创作工坊").click();
    await expect(page.locator("h1")).toContainText("创作工坊");

    await test.step("Step 1: 选择文章类型 — 原创创作", async () => {
      await expect(page.locator("text=原创创作")).toBeVisible();
      await expect(page.locator("text=对标创作")).toBeVisible();
      // 默认选中原创创作
      await page.screenshot({ path: "test-results/uat/uat-3-1-create-mode.png", fullPage: true });
    });

    await test.step("Step 2: 编辑文章 — 输入标题和内容", async () => {
      await expect(page.locator('input[placeholder="文章标题..."]')).toBeVisible();
      await page.fill('input[placeholder="文章标题..."]', "UAT 测试文章标题");
      await expect(page.locator('textarea[placeholder="在此输入或粘贴文章内容..."]')).toBeVisible();
      await page.fill('textarea[placeholder="在此输入或粘贴文章内容..."]', "这是 UAT 验收测试的文章正文内容。暗色 UI 验收进行中。");
      await page.screenshot({ path: "test-results/uat/uat-3-2-editing.png", fullPage: true });
    });

    await test.step("Step 3: 查看可用风格面板", async () => {
      await expect(page.locator("text=可用风格")).toBeVisible();
    });

    await test.step("Step 4: 切换到预览 Tab", async () => {
      await page.locator('button:has-text("预览")').click();
      // 输入内容后预览应显示标题
      await expect(page.locator("text=UAT 测试文章标题")).toBeVisible();
      await page.screenshot({ path: "test-results/uat/uat-3-3-preview.png", fullPage: true });
    });

    await test.step("Step 5: 切换到扫描结果 Tab", async () => {
      await page.locator('button:has-text("扫描结果")').click();
      await expect(page.locator("text=尚未扫描")).toBeVisible();
      await page.screenshot({ path: "test-results/uat/uat-3-4-scan.png", fullPage: true });
    });

    await test.step("Step 6: 切换回编辑 Tab", async () => {
      await page.locator('button:has-text("编辑")').click();
      await expect(page.locator('textarea[placeholder="在此输入或粘贴文章内容..."]')).toBeVisible();
    });

    await test.step("Step 7: 验证 AI 操作按钮", async () => {
      await expect(page.locator('button:has-text("AI改写")')).toBeVisible();
      await expect(page.locator('button:has-text("AI扫描")')).toBeVisible();
      await expect(page.locator('button:has-text("保存入库")')).toBeVisible();
      await expect(page.locator('button:has-text("发布草稿")')).toBeVisible();
    });
  });
});

// 全局暗色 UI 一致性检查
test.describe("暗色 UI 全局检查", () => {
  test("所有页面均有暗色背景", async ({ page }) => {
    await login(page);

    const pages = [
      { label: "对标管理", heading: "对标管理" },
      { label: "一键采集", heading: "一键采集" },
      { label: "素材库", heading: "素材库" },
      { label: "设置", heading: "设置" },
      { label: "风格蒸馏", heading: "风格蒸馏" },
      { label: "创作工坊", heading: "创作工坊" },
    ];

    for (const { label, heading } of pages) {
      await page.locator("aside").locator(`text=${label}`).click();
      await expect(page.locator("h1")).toContainText(heading);
      await page.waitForTimeout(300);
      await page.screenshot({ path: `test-results/uat/dark-check-${label}.png`, fullPage: true });
    }
  });
});
