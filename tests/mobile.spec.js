const { test, expect } = require('@playwright/test');

// Mobile regression coverage runs in an isolated Playwright browser context.
// It must never touch a user's real device or production storage.
test.use({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  // This localStorage belongs only to the disposable Playwright context.
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

async function expectNoHorizontalOverflow(page) {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  expect(dimensions.document, JSON.stringify(dimensions)).toBeLessThanOrEqual(dimensions.viewport + 1);
  expect(dimensions.body, JSON.stringify(dimensions)).toBeLessThanOrEqual(dimensions.viewport + 1);
}

test('모바일 첫 화면에서 핵심 조작이 보이고 가로 넘침이 없음', async ({ page }) => {
  await expect(page.locator('#todayView')).toBeVisible();
  await expect(page.locator('#saveBtn')).toBeVisible();
  await expect(page.locator('[data-tab="today"]')).toBeVisible();
  await expect(page.locator('[data-tab="data"]')).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('모바일에서 식단 기록을 저장하고 새로고침 후에도 유지함', async ({ page }) => {
  const date = '2026-10-20';
  await page.locator('#healthDate').evaluate((el, value) => {
    el.value = value;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, date);
  await page.locator('#hl-breakfast-food').fill('모바일 테스트 식단');
  await page.locator('#hl-breakfast-kcal').fill('210');
  await page.locator('#healthNote').fill('모바일 저장 확인');
  await page.evaluate(() => window.lifeosSaveHealthLog(true));

  await expect.poll(async () => page.evaluate(date => {
    const key = Object.keys(localStorage).find(k => k.startsWith('lifeos.health.logs.v1.'));
    const records = key ? JSON.parse(localStorage.getItem(key) || '{}') : {};
    return records[date]?.meals?.breakfast?.food || '';
  }, date)).toBe('모바일 테스트 식단');

  await page.reload();
  await page.locator('#healthDate').evaluate((el, value) => {
    el.value = value;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, date);
  await expect(page.locator('#hl-breakfast-food')).toHaveValue('모바일 테스트 식단');
  await expectNoHorizontalOverflow(page);
});

test('모바일 데이터 관리 화면에서 백업·복원 컨트롤이 화면 밖으로 밀리지 않음', async ({ page }) => {
  await page.locator('[data-tab="data"]').click();
  await expect(page.locator('#dataView')).toBeVisible();
  await expect(page.locator('#exportJson')).toBeVisible();
  await expect(page.locator('#importFile')).toHaveCount(1);
  await expectNoHorizontalOverflow(page);
});

test('모바일 인사이트 화면에서 건강 통계 모드를 바꿀 수 있음', async ({ page }) => {
  await page.locator('[data-tab="insights"]').click();
  await expect(page.locator('#healthStatsMode')).toBeVisible();
  await page.locator('#healthStatsMode').selectOption('diet');
  await page.locator('#healthStatsMode').selectOption('weight');
  await page.locator('#healthStatsMode').selectOption('both');
  await expectNoHorizontalOverflow(page);
});
