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

test('건강 기록 UI 요소가 페이지에 포함되어 있음', async ({ page }) => {
  await expect(page.locator('#healthDate')).toHaveCount(1);
  await expect(page.locator('#healthMeals')).toHaveCount(1);
  await expect(page.locator('#exportHealthCsv')).toHaveCount(1);
  await expect(page.locator('#healthHistory')).toHaveCount(1);
});

test('건강 기록을 저장하고 새로고침 후에도 유지함', async ({ page }) => {
  const date = '2026-01-17';
  await page.locator('#healthDate').evaluate((el, value) => { el.value = value; }, date);
  await page.locator('#hl-breakfast-food').fill('테스트 계란 2개');
  await page.locator('#hl-breakfast-kcal').fill('156');
  await page.locator('#healthNote').fill('자동 테스트 기록');
  await page.evaluate(() => window.lifeosSaveHealthLog(true));

  const saved = await page.evaluate((date) => {
    const key = Object.keys(localStorage).find(k => k.startsWith('lifeos.health.logs.v1.'));
    const all = key ? JSON.parse(localStorage.getItem(key) || '{}') : {};
    return all[date] || null;
  }, date);
  expect(saved).not.toBeNull();
  expect(saved.meals.breakfast.food).toBe('테스트 계란 2개');
  expect(saved.meals.breakfast.kcal).toBe(156);

  await page.reload();
  const persisted = await page.evaluate((date) => {
    const key = Object.keys(localStorage).find(k => k.startsWith('lifeos.health.logs.v1.'));
    const all = key ? JSON.parse(localStorage.getItem(key) || '{}') : {};
    return all[date] || null;
  }, date);
  expect(persisted).not.toBeNull();
  expect(persisted.meals.breakfast.food).toBe('테스트 계란 2개');
  expect(persisted.note).toBe('자동 테스트 기록');
});

test('저장된 건강 기록을 수정하고 삭제할 수 있음', async ({ page }) => {
  const date = '2026-01-18';
  await page.locator('#healthDate').evaluate((el, value) => { el.value = value; }, date);
  await page.locator('#hl-lunch-food').fill('테스트 닭가슴살');
  await page.evaluate(() => window.lifeosSaveHealthLog(true));

  await page.locator('#hl-lunch-food').fill('수정된 테스트 닭가슴살');
  await page.evaluate(() => window.lifeosSaveHealthLog(true));
  let saved = await page.evaluate((date) => {
    const key = Object.keys(localStorage).find(k => k.startsWith('lifeos.health.logs.v1.'));
    const all = key ? JSON.parse(localStorage.getItem(key) || '{}') : {};
    return all[date] || null;
  }, date);
  expect(saved.meals.lunch.food).toBe('수정된 테스트 닭가슴살');

  page.once('dialog', dialog => dialog.accept());
  await page.locator('[data-health-delete="' + date + '"]').click();
  saved = await page.evaluate((date) => {
    const key = Object.keys(localStorage).find(k => k.startsWith('lifeos.health.logs.v1.'));
    const all = key ? JSON.parse(localStorage.getItem(key) || '{}') : {};
    return all[date] || null;
  }, date);
  expect(saved).toBeNull();
});

test('건강 기록과 루틴 기록의 저장 키 규칙이 분리되어 있음', async ({ page }) => {
  const [healthScript, appScript] = await Promise.all([
    page.request.get('/health-log.js').then(r => r.text()),
    page.request.get('/app.js').then(r => r.text()),
  ]);
  expect(healthScript).toContain('lifeos.health.logs.v1.');
  expect(appScript).toContain('lifeos.records.v1.');
});
