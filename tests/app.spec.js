const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
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
  await page.locator('#healthDate').evaluate((el, value) => { el.value = value; el.dispatchEvent(new Event('change', { bubbles: true })); }, date);
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

  let saved = await page.evaluate((date) => {
    const key = Object.keys(localStorage).find(k => k.startsWith('lifeos.health.logs.v1.'));
    const all = key ? JSON.parse(localStorage.getItem(key) || '{}') : {};
    return all[date] || null;
  }, date);
  expect(saved.meals.lunch.food).toBe('테스트 닭가슴살');

  // The history is inside the Data view, so open that tab before using its controls.
  await page.locator('[data-tab="data"]').click();
  const editButton = page.locator('#healthHistory [data-health-edit="' + date + '"]').first();
  await expect(editButton).toBeVisible();
  await editButton.click();

  await expect(page.locator('#todayView')).toBeVisible();
  await expect(page.locator('#healthDate')).toHaveValue(date);
  await expect(page.locator('#hl-lunch-food')).toHaveValue('테스트 닭가슴살');
  await page.locator('#hl-lunch-food').fill('수정된 테스트 닭가슴살');
  await page.evaluate(() => window.lifeosSaveHealthLog(true));

  saved = await page.evaluate((date) => {
    const key = Object.keys(localStorage).find(k => k.startsWith('lifeos.health.logs.v1.'));
    const all = key ? JSON.parse(localStorage.getItem(key) || '{}') : {};
    return all[date] || null;
  }, date);
  expect(saved.meals.lunch.food).toBe('수정된 테스트 닭가슴살');

  await page.locator('[data-tab="data"]').click();
  const deleteButton = page.locator('#healthHistory [data-health-delete="' + date + '"]');
  await expect(deleteButton).toBeVisible();
  page.once('dialog', dialog => dialog.accept());
  await deleteButton.click();

  saved = await page.evaluate((date) => {
    const key = Object.keys(localStorage).find(k => k.startsWith('lifeos.health.logs.v1.'));
    const all = key ? JSON.parse(localStorage.getItem(key) || '{}') : {};
    return all[date] || null;
  }, date);
  expect(saved).toBeNull();
});

test('화면을 다시 그려도 건강 기록 카드가 식단 영역에 유지됨', async ({ page }) => {
  const healthCard = page.locator('#healthLogCard');
  await expect(healthCard).toBeVisible();

  await page.locator('#modeMinimum').click();
  await expect(healthCard).toBeVisible();
  await expect(page.locator('#categories [data-checklist-group="diet"] #healthLogCard')).toHaveCount(1);

  await page.locator('#modeFull').click();
  await expect(healthCard).toBeVisible();
  await expect(page.locator('#categories [data-checklist-group="diet"] #healthLogCard')).toHaveCount(1);
});

test('건강 기록과 루틴 기록의 저장 키 규칙이 분리되어 있음', async ({ page }) => {
  const [healthScript, appScript] = await Promise.all([
    page.request.get('/health-log.js').then(r => r.text()),
    page.request.get('/app.js').then(r => r.text()),
  ]);
  expect(healthScript).toContain('lifeos.health.logs.v1.');
  expect(appScript).toContain('lifeos.records.v1.');
});


test('전체 JSON 백업에 건강 기록과 건강 목표가 포함됨', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('lifeos.health.logs.v1.project1', JSON.stringify({
      '2026-10-14': { weight: 50.8, meals: { breakfast: { food: '테스트 닭가슴살' } } }
    }));
    localStorage.setItem('lifeos.health.goals.v1.project1', JSON.stringify({
      targetWeightKg: 47, dailyTargets: { proteinG: 100 }
    }));
    localStorage.setItem('lifeos.health.logs.v1', JSON.stringify({
      '2026-10-13': { weight: 51.0 }
    }));
    localStorage.setItem('lifeos.health.goals.v1', JSON.stringify({
      targetWeightKg: 46
    }));
  });

  await page.evaluate(() => {
    window.__exportBlobText = null;
    const originalCreateObjectURL = URL.createObjectURL.bind(URL);
    URL.createObjectURL = blob => {
      window.__exportBlobText = blob.text();
      return originalCreateObjectURL(blob);
    };
  });
  await page.locator('#exportJson').click();
  const backup = await page.evaluate(async () => JSON.parse(await window.__exportBlobText));

  expect(backup.version).toBe(3);
  expect(backup.healthData.project1.logs['2026-10-14'].weight).toBe(50.8);
  expect(backup.healthData.project1.goals.targetWeightKg).toBe(47);
  expect(backup.legacyHealth['lifeos.health.logs.v1']['2026-10-13'].weight).toBe(51);
  expect(backup.legacyHealth['lifeos.health.goals.v1'].targetWeightKg).toBe(46);
});

test('JSON 복원은 기존 건강 기록·목표를 보존하며 백업 내용을 병합함', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('lifeos.health.logs.v1.project1', JSON.stringify({
      '2026-10-01': { weight: 52 }, '2026-10-02': { weight: 51.5 }
    }));
    localStorage.setItem('lifeos.health.goals.v1.project1', JSON.stringify({
      targetWeightKg: 46, dailyTargets: { proteinG: 100, carbsG: 100 }
    }));
  });
  const backup = {
    app: 'LIFE OS', version: 3,
    records: { '2026-10-14': { tasks: {}, metrics: {} } },
    projects: [{ id: 'project1', name: '프로젝트 1', startDate: '', targetDate: '' }],
    activeProjectId: 'project1',
    projectData: { project1: { records: {}, settings: {}, groups: [] } },
    healthData: {
      project1: {
        logs: { '2026-10-03': { weight: 50.8 } },
        goals: { targetWeightKg: 47, dailyTargets: { proteinG: 110 } }
      }
    }
  };
  await page.locator('#importFile').setInputFiles({
    name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup))
  });

  const result = await page.evaluate(() => ({
    logs: JSON.parse(localStorage.getItem('lifeos.health.logs.v1.project1')),
    goals: JSON.parse(localStorage.getItem('lifeos.health.goals.v1.project1'))
  }));
  expect(result.logs['2026-10-01'].weight).toBe(52);
  expect(result.logs['2026-10-02'].weight).toBe(51.5);
  expect(result.logs['2026-10-03'].weight).toBe(50.8);
  expect(result.goals.targetWeightKg).toBe(47);
  expect(result.goals.dailyTargets.proteinG).toBe(110);
  expect(result.goals.dailyTargets.carbsG).toBe(100);
});

test('잘못된 JSON 복원은 기존 건강 데이터와 목표를 변경하지 않음', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('lifeos.health.logs.v1.project1', JSON.stringify({
      '2026-10-01': { weight: 52 }
    }));
    localStorage.setItem('lifeos.health.goals.v1.project1', JSON.stringify({
      targetWeightKg: 46
    }));
  });
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#importFile').setInputFiles({
    name: 'invalid-backup.json', mimeType: 'application/json', buffer: Buffer.from('{"app":"WRONG","records":{}}')
  });
  const result = await page.evaluate(() => ({
    logs: JSON.parse(localStorage.getItem('lifeos.health.logs.v1.project1')),
    goals: JSON.parse(localStorage.getItem('lifeos.health.goals.v1.project1'))
  }));
  expect(result.logs['2026-10-01'].weight).toBe(52);
  expect(result.goals.targetWeightKg).toBe(46);
});
