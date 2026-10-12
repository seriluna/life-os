const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
  });
  await page.goto('/');
});

test('앱 초기화와 핵심 화면 표시', async ({ page }) => {
  await expect(page.locator('#todayView')).toBeVisible();
  await expect(page.locator('#saveBtn')).toBeVisible();
  await expect(page.locator('#exportJson')).toBeVisible();
  await expect(page.locator('#importFile')).toHaveCount(1);
});

test('식단·체중 기록을 저장하고 새로고침 후 유지', async ({ page }) => {
  await page.locator('#healthDate').fill('2026-10-12');
  await page.locator('#healthMeals').fill('자동 테스트 닭가슴살');
  await page.locator('#healthNote').fill('자동 테스트 기록');
  await page.locator('#saveBtn').click();

  await expect.poll(async () => page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('lifeos.health.logs.v1') || '{}');
    return JSON.stringify(data);
  })).toContain('자동 테스트 닭가슴살');

  await page.reload();
  await expect(page.locator('#healthMeals')).toHaveValue(/자동 테스트 닭가슴살/);
});

test('식단 기록 키는 루틴 기록 키와 분리되어 있음', async ({ page }) => {
  const keys = await page.evaluate(() => ({
    health: localStorage.getItem('lifeos.health.logs.v1'),
    routines: localStorage.getItem('lifeos.records.v1.project1'),
  }));
  expect(keys.health).not.toBe(keys.routines);
});