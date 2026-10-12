const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
});

test('앱 초기화와 핵심 화면 표시', async ({ page }) => {
  await expect(page.locator('#todayView')).toBeVisible();
  await expect(page.locator('#saveBtn')).toBeVisible();
  await expect(page.locator('#exportJson')).toHaveCount(1);
  await expect(page.locator('#importFile')).toHaveCount(1);
});

test('건강 기록 입력란과 내보내기 기능 표시', async ({ page }) => {
  await expect(page.locator('#healthDate')).toBeVisible();
  await expect(page.locator('#healthMeals')).toBeVisible();
  await expect(page.locator('#hl-breakfast-food')).toBeVisible();
  await expect(page.locator('#exportHealthCsv')).toBeVisible();
  await page.locator('#healthDate').fill('2026-10-12');
  await page.locator('#hl-breakfast-food').fill('자동 테스트 닭가슴살');
  await expect(page.locator('#hl-breakfast-food')).toHaveValue('자동 테스트 닭가슴살');
});

test('건강 기록과 루틴 기록은 별도 저장 키를 사용', async ({ page }) => {
  const keys = await page.evaluate(() => Object.keys(localStorage));
  expect(keys.some(k => /^lifeos\.health\.logs\.v1\./.test(k))).toBe(true);
  expect(keys.some(k => /^lifeos\.records\.v1\./.test(k))).toBe(true);
  expect(keys.filter(k => /^lifeos\.health\.logs\.v1\./.test(k))
    .every(k => !/^lifeos\.records\.v1\./.test(k))).toBe(true);
});