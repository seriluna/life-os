const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

async function openDataManagement(page) {
  await page.locator('[data-tab="data"]').click();
  await expect(page.locator('#dataView')).toBeVisible();
}

async function restoreBackup(page, file, { expectError = false, expectNavigation = false } = {}) {
  await openDataManagement(page);
  await page.locator('#importFile').setInputFiles(file);
  await expect(page.locator('#backupFilePreview')).toContainText('전체 백업 형식 확인 완료');
  const dialogTypes = [];
  const handler = async dialog => { dialogTypes.push(dialog.type()); await dialog.accept(); };
  page.on('dialog', handler);
  const navigation = expectNavigation ? page.waitForNavigation() : null;
  await page.locator('#restoreJson').click();
  if (navigation) await navigation;
  if (expectError) await expect(page.locator('#backupRestoreStatus')).toContainText('백업 복원 실패');
  else if (!expectNavigation) await expect(page.locator('#restoreJson')).toBeDisabled();
  page.off('dialog', handler);
  return dialogTypes;
}

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

test('날짜를 바꿔도 건강 기록 카드가 식단 영역에 유지됨', async ({ page }) => {
  const healthCard = page.locator('#healthLogCard');
  await expect(healthCard).toBeVisible();

  await page.locator('[data-tab="today"]').click();
  await page.locator('#recordDate').fill('2026-10-15');
  await page.locator('#recordDate').dispatchEvent('change');

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
  await page.locator('[data-tab="data"]').click();
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
  await restoreBackup(page, {
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
  await page.locator('#importFile').setInputFiles({
    name: 'invalid-backup.json', mimeType: 'application/json', buffer: Buffer.from('{"app":"WRONG","records":{}}')
  });
  await expect(page.locator('#restoreJson')).toBeDisabled();
  await expect(page.locator('#backupRestoreStatus')).toContainText('복원할 수 없는 파일');
  const result = await page.evaluate(() => ({
    logs: JSON.parse(localStorage.getItem('lifeos.health.logs.v1.project1')),
    goals: JSON.parse(localStorage.getItem('lifeos.health.goals.v1.project1'))
  }));
  expect(result.logs['2026-10-01'].weight).toBe(52);
  expect(result.goals.targetWeightKg).toBe(46);
});


test('저장 용량 초과 시 JSON 복원은 기존 데이터를 롤백해 보존함', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('lifeos.health.logs.v1.project1', JSON.stringify({
      '2026-10-01': { weight: 52 }
    }));
    localStorage.setItem('lifeos.health.goals.v1.project1', JSON.stringify({
      targetWeightKg: 46, dailyTargets: { proteinG: 100 }
    }));
    localStorage.setItem('lifeos.records.v1.project1', JSON.stringify({
      '2026-10-01': { metrics: { weight: 52 } }
    }));
  });

  const backup = {
    app: 'LIFE OS', version: 3,
    records: { '2026-10-20': { tasks: {}, metrics: { weight: 49 } } },
    projects: [{ id: 'project1', name: '프로젝트 1', startDate: '', targetDate: '' }],
    activeProjectId: 'project1',
    projectData: { project1: { records: { '2026-10-20': { metrics: { weight: 49 } } } } },
    healthData: {
      project1: {
        logs: { '2026-10-20': { weight: 49 } },
        goals: { targetWeightKg: 45, dailyTargets: { proteinG: 120 } }
      }
    }
  };

  await page.evaluate(() => {
    const originalSetItem = Storage.prototype.setItem;
    let shouldFail = true;
    Storage.prototype.setItem = function(key, value) {
      if (shouldFail && key === 'lifeos.health.goals.v1.project1') {
        shouldFail = false;
        throw new DOMException('Quota exceeded', 'QuotaExceededError');
      }
      return originalSetItem.call(this, key, value);
    };
  });
  const dialogTypes = await restoreBackup(page, {
    name: 'quota-backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup))
  }, { expectError: true });
  expect(dialogTypes).toContain('confirm');
  expect(dialogTypes).toContain('alert');

  const result = await page.evaluate(() => ({
    healthLogs: JSON.parse(localStorage.getItem('lifeos.health.logs.v1.project1')),
    healthGoals: JSON.parse(localStorage.getItem('lifeos.health.goals.v1.project1')),
    projectRecords: JSON.parse(localStorage.getItem('lifeos.records.v1.project1')),
    mainRecords: JSON.parse(localStorage.getItem('lifeos.records.v1') || '{}')
  }));
  expect(result.healthLogs).toEqual({ '2026-10-01': { weight: 52 } });
  expect(result.healthGoals).toEqual({ targetWeightKg: 46, dailyTargets: { proteinG: 100 } });
  expect(result.projectRecords).toEqual({ '2026-10-01': { metrics: { weight: 52 } } });
  expect(result.mainRecords['2026-10-20']).toBeUndefined();
});


test('JSON 복원 후 건강 기록이 화면과 목표 입력란에 표시됨', async ({ page }) => {
  const backup = {
    app: 'LIFE OS', version: 3,
    records: {},
    projects: [{ id: 'project1', name: '프로젝트 1', startDate: '', targetDate: '' }],
    activeProjectId: 'project1',
    projectData: { project1: { records: {}, settings: {}, groups: [] } },
    healthData: {
      project1: {
        logs: {
          '2026-10-19': {
            date: '2026-10-19', weight: 50.4, note: '복원 화면 검증',
            meals: { breakfast: { food: '복원 테스트 식사', kcal: 200, protein: 20 } },
            dailyTotals: { kcal: 200, carbs: 10, protein: 20, fat: 5 }
          }
        },
        goals: { targetWeightKg: 47, dailyTargets: { caloriesKcal: 1300, carbsG: 100, proteinG: 110, fatG: 40 } }
      }
    }
  };

  await restoreBackup(page, {
    name: 'ui-restore-backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup))
  });

  // Restore imports records without changing the currently selected date.
  // Select the restored date to verify the form renders the saved entry.
  await page.locator('#healthDate').evaluate((el, value) => {
    el.value = value;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, '2026-10-19');
  await expect(page.locator('#hl-breakfast-food')).toHaveValue('복원 테스트 식사');
  await expect(page.locator('#hl-goal-weight')).toHaveValue('47');
  await expect(page.locator('#hl-goal-protein')).toHaveValue('110');

  await page.locator('[data-tab="data"]').click();
  await expect(page.locator('#healthHistory')).toContainText('복원 테스트 식사');
  await expect(page.locator('#healthHistory')).toContainText('50.4 kg');
});


test('JSON 복원으로 활성 프로젝트가 바뀌면 해당 프로젝트의 건강 기록을 즉시 표시함', async ({ page }) => {
  const today = await page.evaluate(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const backup = {
    app: 'LIFE OS', version: 3,
    records: {},
    projects: [{ id: 'project2', name: '복원 프로젝트', startDate: '', targetDate: '' }],
    activeProjectId: 'project2',
    projectData: { project2: { records: {}, settings: {}, groups: [] } },
    healthData: {
      project2: {
        logs: {
          '2026-10-18': {
            date: '2026-10-18', weight: 49.8, note: '활성 프로젝트 전환 테스트',
            meals: { breakfast: { food: '프로젝트 전환 식사', kcal: 180, protein: 18 } },
            dailyTotals: { kcal: 180, carbs: 12, protein: 18, fat: 4 }
          }
        },
        goals: { targetWeightKg: 46, dailyTargets: { caloriesKcal: 1250, carbsG: 95, proteinG: 105, fatG: 38 } }
      }
    }
  };

  await restoreBackup(page, {
    name: 'project-switch-backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup))
  }, { expectNavigation: true });

  await page.locator('#healthDate').evaluate((el, value) => {
    el.value = value;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, '2026-10-18');
  await expect(page.locator('#hl-breakfast-food')).toHaveValue('프로젝트 전환 식사');
  await expect(page.locator('#hl-goal-weight')).toHaveValue('46');
  await expect(page.locator('#hl-goal-protein')).toHaveValue('105');
  await page.locator('[data-tab="data"]').click();
  await expect(page.locator('#healthHistory')).toContainText('프로젝트 전환 식사');
  await expect(page.locator('#healthHistory')).toContainText('49.8 kg');

  // Return to the routine screen before interacting with its hidden checkboxes.
  await page.locator('[data-tab="today"]').click();
  // After restore changes the active project, a fresh app state must save routine data to project2.
  await page.locator('[data-task="contact"]').check();
  await page.locator('#saveBtn').click();
  const projectRecords = await page.evaluate(() => ({
    project1: JSON.parse(localStorage.getItem('lifeos.records.v1.project1') || '{}'),
    project2: JSON.parse(localStorage.getItem('lifeos.records.v1.project2') || '{}'),
    active: localStorage.getItem('lifeos.activeProject.v1')
  }));
  expect(projectRecords.active).toBe('project2');
  expect(projectRecords.project2[today].tasks.contact).toBe(true);
  // The app may initialize an empty record for today in the default project; it must not mark this task there.
  expect(projectRecords.project1[today]?.tasks?.contact).not.toBe(true);
});


test('식단 입력 후 날짜를 바꿔도 자동 저장되어 기록이 유지됨', async ({ page }) => {
  const date = '2026-10-19';
  await page.locator('#healthDate').evaluate((el, value) => { el.value = value; el.dispatchEvent(new Event('change', { bubbles: true })); }, date);
  await page.locator('#hl-breakfast-food').fill('자동 저장 테스트 닭가슴살 100g');
  await page.locator('#hl-breakfast-food').evaluate(el => el.dispatchEvent(new Event('change', { bubbles: true })));
  await page.locator('#healthDate').evaluate((el, value) => { el.value = value; el.dispatchEvent(new Event('change', { bubbles: true })); }, '2026-10-20');
  const saved = await page.evaluate(date => { const key = Object.keys(localStorage).find(k => k.startsWith('lifeos.health.logs.v1.')); return JSON.parse(localStorage.getItem(key) || '{}')[date] || null; }, date);
  expect(saved).not.toBeNull();
  expect(saved.meals.breakfast.food).toBe('자동 저장 테스트 닭가슴살 100g');
});

test('식단·몸무게 통계에서 세 가지 보기 모드를 제공함', async ({ page }) => {
  await page.locator('[data-tab="insights"]').click();
  await expect(page.locator('#healthStatsMode')).toHaveCount(1);
  await expect(page.locator('#healthStatsMode option')).toHaveCount(3);
  await page.locator('#healthStatsMode').selectOption('diet');
  await page.locator('#healthStatsMode').selectOption('weight');
  await page.locator('#healthStatsMode').selectOption('both');
});


test('실행 항목 삭제는 범위를 선택하면 즉시 저장됨', async ({ page }) => {
  await page.locator('[data-tab="data"]').click();
  const deleteButton = page.locator('#groupEditorList [data-delete-action]').first();
  const beforeCount = await page.locator('#groupEditorList [data-delete-action]').count();
  await expect(deleteButton).toBeVisible();
  await deleteButton.click();

  const dialog = page.locator('#taskScopeDialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('선택한 날짜만')).toBeVisible();
  await expect(dialog.getByText('직접 지정한 기간만')).toBeVisible();
  await expect(dialog.getByText('프로젝트 전체 기간')).toBeVisible();
  await dialog.locator('[name="scopeMode"][value="date"]').check();
  await dialog.locator('button[type="submit"]').click();

  const scopeData = await page.evaluate(() => {
    const raw = localStorage.getItem('lifeos.checklist.taskScopes.v1.project1');
    return raw ? JSON.parse(raw) : null;
  });
  expect(scopeData).not.toBeNull();
  expect(Object.keys(scopeData).length).toBeGreaterThan(0);
  const ranges = Object.values(scopeData)[0];
  expect(ranges).toHaveLength(1);
  expect(ranges[0].startDate).toBe(ranges[0].endDate);
  await page.reload();
  await page.locator('[data-tab="data"]').click();
  await expect(page.locator('#groupEditorList [data-delete-action]')).toHaveCount(beforeCount);
});

test('실행 항목 이름 수정은 지정한 기간에만 적용하고 즉시 저장됨', async ({ page }) => {
  await page.locator('[data-tab="data"]').click();
  const editButton = page.locator('#groupEditorList [data-edit-action]').first();
  await expect(editButton).toBeVisible();
  page.once('dialog', dialog => dialog.accept('기간 한정 수정 항목'));
  await editButton.click();

  const dialog = page.locator('#taskScopeDialog');
  await expect(dialog).toBeVisible();
  await dialog.locator('[name="scopeMode"][value="range"]').check();
  await dialog.locator('#taskScopeStart').fill('2026-10-01');
  await dialog.locator('#taskScopeEnd').fill('2026-10-10');
  await dialog.locator('button[type="submit"]').click();

  const saved = await page.evaluate(() => {
    const groups = JSON.parse(localStorage.getItem('lifeos.checklist.groups.v1.project1') || '[]');
    const history = JSON.parse(localStorage.getItem('lifeos.checklist.labelHistory.v1.project1') || '{}');
    const taskId = groups[0].tasks[0][0];
    return { task: groups[0].tasks.find(t => t[0] === taskId), history: history[taskId] };
  });
  expect(saved.task[1]).toBe('기간 한정 수정 항목');
  expect(saved.history.changes.some(c => c.date === '2026-10-01' && c.endDate === '2026-10-10' && c.label === '기간 한정 수정 항목')).toBe(true);
});


test('JSON 백업에 기간별 실행 항목 수정·삭제 설정이 포함됨', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('lifeos.checklist.labelHistory.v1.project1', JSON.stringify({
      contact: { baseLabel: '잠재 고객 접촉 1회', changes: [{ date: '2026-10-01', endDate: '2026-10-10', label: '기간 한정 연락' }] }
    }));
    localStorage.setItem('lifeos.checklist.taskScopes.v1.project1', JSON.stringify({
      marketing: [{ startDate: '2026-10-05', endDate: '2026-10-07' }]
    }));
  });
  await page.locator('[data-tab="data"]').click();
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
  expect(backup.projectData.project1.labelHistory.contact.changes[0].label).toBe('기간 한정 연락');
  expect(backup.projectData.project1.taskScopes.marketing[0].startDate).toBe('2026-10-05');
});


test('실행 항목 추가도 선택한 날짜 범위에만 표시되고 저장됨', async ({ page }) => {
  await page.locator('[data-tab="data"]').click();
  await page.locator('#addActionName0').fill('기간 한정 실행 항목');
  await page.locator('[data-add-action="0"]').click();

  const dialog = page.locator('#taskScopeDialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('선택한 날짜만')).toBeVisible();
  await expect(dialog.getByText('직접 지정한 기간만')).toBeVisible();
  await expect(dialog.getByText('프로젝트 전체 기간', { exact: true })).toBeVisible();
  await dialog.locator('[name="scopeMode"][value="range"]').check();
  await dialog.locator('#taskScopeStart').fill('2026-10-01');
  await dialog.locator('#taskScopeEnd').fill('2026-10-10');
  await dialog.locator('button[type="submit"]').click();

  const saved = await page.evaluate(() => {
    const groups = JSON.parse(localStorage.getItem('lifeos.checklist.groups.v1.project1') || '[]');
    const active = JSON.parse(localStorage.getItem('lifeos.checklist.taskActiveScopes.v1.project1') || '{}');
    const task = groups.flatMap(g => g.tasks).find(t => t[1] === '기간 한정 실행 항목');
    return { task, scope: task ? active[task[0]] : null };
  });
  expect(saved.task).toBeTruthy();
  expect(saved.scope).toEqual([{ startDate: '2026-10-01', endDate: '2026-10-10' }]);

  await page.locator('[data-tab="today"]').click();
  await page.locator('#recordDate').fill('2026-10-15');
  await page.locator('#recordDate').dispatchEvent('change');
  await expect(page.locator('[data-task="' + saved.task[0] + '"]')).toHaveCount(0);
  await page.locator('#recordDate').fill('2026-10-05');
  await page.locator('#recordDate').dispatchEvent('change');
  await expect(page.locator('[data-task="' + saved.task[0] + '"]')).toBeVisible();
});

test('JSON 백업과 복원은 실행 항목 추가 범위도 보존함', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('lifeos.checklist.taskActiveScopes.v1.project1', JSON.stringify({
      scopedTask: [{ startDate: '2026-10-01', endDate: '2026-10-10' }]
    }));
  });
  await page.locator('[data-tab="data"]').click();
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
  expect(backup.projectData.project1.taskActiveScopes.scopedTask[0].startDate).toBe('2026-10-01');

  await restoreBackup(page, {
    name: 'scoped-add-backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(backup))
  });
  const restored = await page.evaluate(() => JSON.parse(localStorage.getItem('lifeos.checklist.taskActiveScopes.v1.project1') || '{}'));
  expect(restored.scopedTask[0].endDate).toBe('2026-10-10');
});

test('같은 프로젝트에 JSON 복원하면 체크리스트 화면도 즉시 갱신됨', async ({ page }) => {
  const backup = {
    app: 'LIFE OS', version: 3, records: {},
    projects: [{ id: 'project1', name: '프로젝트 1', startDate: '', targetDate: '' }],
    activeProjectId: 'project1',
    projectData: {
      project1: {
        records: {},
        groups: [{ id: 'restored', name: '복원된 영역', icon: '📌', desc: '복원 테스트', tasks: [['restoredTask', '복원된 실행 항목']] }]
      }
    }
  };

  await restoreBackup(page, {
    name: 'restore-checklist.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup))
  });

  await page.locator('[data-tab="today"]').click();
  await expect(page.locator('[data-checklist-group="restored"]')).toContainText('복원된 영역');
  await expect(page.locator('[data-task="restoredTask"]')).toBeVisible();
  await page.locator('[data-tab="data"]').click();
  await expect(page.locator('#groupEditorList')).toContainText('복원된 실행 항목');
});

test('JSON 복원은 기간별 실행 항목 수정·삭제 설정도 보존함', async ({ page }) => {
  const backup = {
    app: 'LIFE OS', version: 3, records: {},
    projects: [{ id: 'project1', name: '프로젝트 1', startDate: '', targetDate: '' }],
    activeProjectId: 'project1',
    projectData: {
      project1: {
        records: {},
        labelHistory: { contact: { baseLabel: '기존 이름', changes: [{ date: '2026-10-01', endDate: '2026-10-10', label: '복원 이름' }] } },
        taskScopes: { marketing: [{ startDate: '2026-10-05', endDate: '2026-10-07' }] }
      }
    }
  };
  await restoreBackup(page, {
    name: 'scoped-checklist-backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup))
  });
  const result = await page.evaluate(() => ({
    history: JSON.parse(localStorage.getItem('lifeos.checklist.labelHistory.v1.project1') || '{}'),
    scopes: JSON.parse(localStorage.getItem('lifeos.checklist.taskScopes.v1.project1') || '{}')
  }));
  expect(result.history.contact.changes[0].label).toBe('복원 이름');
  expect(result.scopes.marketing[0].endDate).toBe('2026-10-07');
});

test('누적 리포트 실행률은 기간별 제외 설정을 반영함', async ({ page }) => {
  const today = await page.evaluate(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  await page.evaluate((today) => {
    const storedGroups = JSON.parse(localStorage.getItem('lifeos.checklist.groups.v1.project1') || '[]');
    const taskIds = [...new Set([
      ...storedGroups.flatMap(group => (group.tasks || []).map(task => task[0])),
      ...[...document.querySelectorAll('[data-task]')].map(el => el.dataset.task)
    ])];
    const scopes = { marketing: [{ startDate: today, endDate: today }] };
    const tasks = Object.fromEntries(taskIds.map(id => [id, id !== 'marketing']));
    localStorage.setItem('lifeos.checklist.taskScopes.v1.project1', JSON.stringify(scopes));
    const nextRecords = { ...records, [today]: { tasks, metrics: {}, reflection: { win: '', blocker: '', tomorrow: '' } } };
    localStorage.setItem('lifeos.records.v1.project1', JSON.stringify(nextRecords));
    records = nextRecords;
    renderDailyReport();
  }, today);
  await expect(page.locator('#dailyReportContent')).toContainText('100%');
  const reportText = await page.locator('#dailyReportContent').innerText();
  expect(reportText).toMatch(/완료한 행동\s*\d+회/);
  expect(reportText).not.toContain('완료한 행동\n0회');
});

test('프로젝트 대시보드는 연도별 프로젝트 기간과 상태를 시각화함', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('lifeos.projects.v1', JSON.stringify([
      { id: 'project1', name: '2025 프로젝트', startDate: '2025-03-01', targetDate: '2025-08-31', description: '이전 연도' },
      { id: 'project2', name: '2026 프로젝트', startDate: '2026-01-01', targetDate: '2026-12-31', description: '현재 연도' },
      { id: 'project3', name: '기간 미설정 프로젝트', startDate: '', targetDate: '' }
    ]));
    localStorage.setItem('lifeos.activeProject.v1', 'project2');
  });
  await page.reload();
  await page.locator('[data-tab="data"]').click();
  await expect(page.locator('#projectList')).toContainText('2025 프로젝트');
  await expect(page.locator('#projectList')).toContainText('2026 프로젝트');
  await expect(page.locator('#projectList')).toContainText('기간 미설정 프로젝트');
  await expect(page.locator('#projectList .project-progress-track')).toHaveCount(3);
  await page.locator('#projectYearFilter').selectOption('2025');
  await expect(page.locator('#projectList')).toContainText('2025 프로젝트');
  await expect(page.locator('#projectList')).not.toContainText('2026 프로젝트');
  await expect(page.locator('#projectDashboardMetrics')).toContainText('1개');
});

test('백업 복원은 파일 형식 확인 후 명시적으로 복원할 때만 적용됨', async ({ page }) => {
  await openDataManagement(page);
  const backup = {
    app: 'LIFE OS', version: 3,
    records: { '2026-10-20': { tasks: {}, metrics: { weight: 49 } } },
    projects: [{ id: 'project1', name: '프로젝트 1', startDate: '', targetDate: '' }],
    activeProjectId: 'project1',
    projectData: { project1: { records: {}, settings: {}, groups: [] } }
  };
  await page.locator('#importFile').setInputFiles({
    name: 'preview-backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup))
  });
  await expect(page.locator('#backupFilePreview')).toContainText('preview-backup.json');
  await expect(page.locator('#restoreJson')).toBeEnabled();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('lifeos.records.v1.project1') || '{}')['2026-10-20'])).toBeUndefined();
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#restoreJson').click();
  await expect(page.locator('#restoreJson')).toBeDisabled();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('lifeos.records.v1.project1') || '{}')['2026-10-20'].metrics.weight)).toBe(49);
});

test('목표 설정은 일일 기록 저장과 분리되어 날짜가 바뀌어도 유지됨', async ({ page }) => {
  await page.locator('[data-tab="data"]').click();
  await page.locator('#goalSettingsPanel').evaluate(el => { el.open = true; });
  await page.locator('#hl-goal-weight').fill('47.5');
  await page.locator('#hl-goal-calories').fill('1400');
  await page.locator('#hl-goal-protein').fill('110');
  await page.locator('#saveHealthGoals').click();

  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('lifeos.health.goals.v1.project1') || '{}'));
  expect(saved.targetWeightKg).toBe(47.5);
  expect(saved.dailyTargets.caloriesKcal).toBe(1400);
  expect(saved.dailyTargets.proteinG).toBe(110);

  await page.locator('[data-tab="today"]').click();
  await page.locator('#healthDate').evaluate(el => {
    el.value = '2026-10-01';
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.locator('[data-tab="data"]').click();
  await page.locator('#goalSettingsPanel').evaluate(el => { el.open = true; });
  await expect(page.locator('#hl-goal-weight')).toHaveValue('47.5');
  await expect(page.locator('#hl-goal-calories')).toHaveValue('1400');
  await expect(page.locator('#hl-goal-protein')).toHaveValue('110');
});


test('프로젝트 대시보드는 기간 시각화와 연도별 필터를 제공함', async ({ page }) => {
  await openDataManagement(page);
  await page.evaluate(() => {
    localStorage.setItem('lifeos.projects.v1', JSON.stringify([
      { id: 'project1', name: '2025-26 프로젝트', description: '연도 필터 테스트', startDate: '2025-11-01', targetDate: '2026-02-15' },
      { id: 'project2', name: '2027 프로젝트', description: '미래 프로젝트', startDate: '2027-01-01', targetDate: '2027-12-31' }
    ]));
    localStorage.setItem('lifeos.activeProject.v1', 'project1');
  });
  await page.reload();
  await openDataManagement(page);

  await expect(page.locator('#projectDashboard')).toBeVisible();
  await expect(page.locator('#projectList')).toContainText('2025-26 프로젝트');
  await expect(page.locator('#projectList')).toContainText('2027 프로젝트');
  await expect(page.locator('#projectYearFilter option[value="2025"]')).toHaveCount(1);
  await expect(page.locator('#projectYearFilter option[value="2026"]')).toHaveCount(1);
  await expect(page.locator('#projectYearFilter option[value="2027"]')).toHaveCount(1);
  await expect(page.locator('#projectDashboardMetrics')).toContainText('표시 프로젝트');

  await page.locator('#projectYearFilter').selectOption('2026');
  await expect(page.locator('#projectList')).toContainText('2025-26 프로젝트');
  await expect(page.locator('#projectList')).not.toContainText('2027 프로젝트');
  await expect(page.locator('#projectList .project-progress-track')).toHaveCount(1);

  await page.locator('#projectYearFilter').selectOption('2027');
  await expect(page.locator('#projectList')).toContainText('2027 프로젝트');
  await expect(page.locator('#projectList')).not.toContainText('2025-26 프로젝트');
});

test('목표 설정은 접을 수 있고 저장 동작을 유지함', async ({ page }) => {
  await openDataManagement(page);
  const panel = page.locator('#goalSettingsPanel');
  await expect(panel).toBeVisible();
  await expect(panel).not.toHaveAttribute('open', '');
  await panel.locator('summary').click();
  await expect(page.locator('#goalCarbs')).toBeVisible();
  await page.locator('#goalCarbs').fill('125');
  await page.locator('#saveSettings').click();
  const settings = await page.evaluate(() => {
    const key = Object.keys(localStorage).find(k => k.startsWith('lifeos.settings.v1.'));
    return key ? JSON.parse(localStorage.getItem(key)) : null;
  });
  expect(settings.carbs).toBe(125);
});

test('전체 백업 파일은 먼저 미리보기하고 취소할 수 있음', async ({ page }) => {
  await openDataManagement(page);
  const backup = {
    app: 'LIFE OS', version: 3,
    records: { '2026-10-20': { tasks: {}, metrics: {} } },
    projects: [{ id: 'project1', name: '프로젝트 1', startDate: '', targetDate: '' }],
    activeProjectId: 'project1',
    projectData: { project1: { records: {}, settings: {}, groups: [] } },
    healthData: { project1: { logs: {}, goals: {} } }
  };
  await page.locator('#importFile').setInputFiles({
    name: 'life-os-backup-test.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(backup))
  });
  await expect(page.locator('#backupFilePreview')).toContainText('life-os-backup-test.json');
  await expect(page.locator('#backupFilePreview')).toContainText('전체 백업 형식 확인 완료');
  await expect(page.locator('#restoreJson')).toBeEnabled();

  await page.locator('#cancelRestore').click();
  await expect(page.locator('#restoreJson')).toBeDisabled();
  await expect(page.locator('#backupFilePreview')).toContainText('아직 파일을 선택하지 않았어');
});

 
test('체크인 입력과 식단 입력은 자동 저장되고 공복 몸무게 입력은 하나만 제공함', async ({ page }) => {
  await expect(page.locator('#m_weight')).toHaveCount(1);
  await expect(page.locator('#hl-weight')).toHaveCount(0);
  await page.locator('#reflectionWin').fill('자동 저장 회고 테스트');
  await page.locator('#m_weight').fill('52.1');
  await page.locator('#hl-breakfast-food').fill('자동 저장 식단 테스트');
  await expect.poll(async () => page.evaluate(() => {
    const recordKey = Object.keys(localStorage).find(k => k.startsWith('lifeos.records.v1.'));
    const healthKey = Object.keys(localStorage).find(k => k.startsWith('lifeos.health.logs.v1.'));
    const date = document.querySelector('#recordDate').value;
    const record = recordKey ? JSON.parse(localStorage.getItem(recordKey) || '{}')[date] : null;
    const health = healthKey ? JSON.parse(localStorage.getItem(healthKey) || '{}')[date] : null;
    return { reflection: record?.reflection?.win || '', weight: record?.metrics?.weight, healthWeight: health?.weight, food: health?.meals?.breakfast?.food || '' };
  })).toEqual({ reflection: '자동 저장 회고 테스트', weight: 52.1, healthWeight: 52.1, food: '자동 저장 식단 테스트' });
});

test('메인 화면과 성과 분석에서 요청된 누적 지표를 표시하지 않음', async ({ page }) => {
  await expect(page.locator('#paidCustomers')).toHaveCount(0);
  await expect(page.locator('#iRevenue')).toHaveCount(0);
  await expect(page.getByText('유료 고객 누적', { exact: true })).toHaveCount(0);
  await expect(page.getByText('사업 결제액 누적', { exact: true })).toHaveCount(0);
});


test('서비스워커가 HTML에서 참조하는 현재 스크립트 버전을 캐싱함', async ({ page }) => {
  const scriptVersions = await page.evaluate(() => ({
    app: document.querySelector('script[src^="app.js"]')?.getAttribute('src'),
    health: document.querySelector('script[src^="health-log.js"]')?.getAttribute('src')
  }));
  const serviceWorker = await page.evaluate(async () => {
    const response = await fetch('./sw.js', { cache: 'no-store' });
    return response.text();
  });
  expect(scriptVersions.app).toBe('app.js?v=58');
  expect(scriptVersions.health).toBe('health-log.js?v=28');
  expect(serviceWorker).toContain('"./app.js?v=58"');
  expect(serviceWorker).toContain('"./health-log.js?v=28"');
});


test('건강 자동 저장 실패를 알리고 기존 건강 기록을 보존함', async ({ page }) => {
  const date = await page.locator('#healthDate').inputValue();
  const key = 'lifeos.health.logs.v1.project1';
  await page.evaluate(({ key, date }) => {
    localStorage.setItem(key, JSON.stringify({ [date]: { date, weight: 50, note: '기존 합성 기록', meals: {} } }));
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name, value) {
      if (name === key) throw new DOMException('Quota exceeded', 'QuotaExceededError');
      return originalSetItem.call(this, name, value);
    };
  }, { key, date });
  await page.locator('#hl-breakfast-food').fill('저장 실패 합성 테스트');
  await expect(page.locator('#toast')).toContainText('자동 저장에 실패했어');
  const preserved = await page.evaluate(({ key, date }) => JSON.parse(localStorage.getItem(key) || '{}')[date], { key, date });
  expect(preserved.note).toBe('기존 합성 기록');
  expect(preserved.weight).toBe(50);
});


test('체크인 자동 저장 실패를 알리고 기존 루틴 기록을 보존함', async ({ page }) => {
  const date = await page.locator('#recordDate').inputValue();
  const key = await page.evaluate(() => Object.keys(localStorage).find(k => k.startsWith('lifeos.records.v1.')));
  await page.evaluate(({ key, date }) => {
    const existing = JSON.parse(localStorage.getItem(key) || '{}');
    existing[date] = { ...(existing[date] || {}), reflection: { win: '기존 회고', blocker: '', tomorrow: '' }, metrics: { ...(existing[date]?.metrics || {}), weight: 51.2 } };
    localStorage.setItem(key, JSON.stringify(existing));
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name, value) {
      if (name === key) throw new DOMException('Quota exceeded', 'QuotaExceededError');
      return originalSetItem.call(this, name, value);
    };
  }, { key, date });
  await page.locator('#reflectionWin').fill('저장 실패 새 회고');
  await expect(page.locator('#toast')).toContainText('기록 자동 저장에 실패했어');
  const preserved = await page.evaluate(({ key, date }) => JSON.parse(localStorage.getItem(key) || '{}')[date], { key, date });
  expect(preserved.reflection.win).toBe('기존 회고');
  expect(preserved.metrics.weight).toBe(51.2);
});

 
test('성과 리포트는 연속 기록과 별개로 프로젝트 전체 완료 행동 수를 축하함', async ({ page }) => {
  const today = await page.evaluate(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  await page.evaluate((today) => {
    const key = 'lifeos.records.v1.project1';
    const previous = JSON.parse(localStorage.getItem(key) || '{}');
    previous['2026-01-02'] = { tasks: { contact: true, marketing: true }, metrics: {}, reflection: {} };
    previous[today] = { tasks: { contact: true }, metrics: {}, reflection: {} };
    localStorage.setItem(key, JSON.stringify(previous));
    records = previous;
    renderDailyReport();
  }, today);
  await expect(page.locator('#dailyReportContent')).toContainText('프로젝트 누적 성취 · 3회 완료');
  await expect(page.locator('#dailyReportContent')).toContainText('연속 기록 일수가 아니라 프로젝트 전체 기간');
  await expect(page.locator('#dailyReportContent')).toContainText('다음 성취 기준은 10회');
});


test('메인 통계 선택은 새로고침 후 유지되고 기존 기록을 변경하지 않음', async ({ page }) => {
  const picker = page.locator('#homeStatsPicker');
  await expect(picker).toBeVisible();
  await expect(picker.locator('option:checked')).toHaveCount(3);

  const recordKey = 'lifeos.records.v1.project1';
  const syntheticRecords = {
    '2026-10-20': { tasks: { contact: true }, metrics: { weight: 50.2 }, reflection: { win: '합성 기록 유지 확인' } }
  };
  await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: recordKey, value: syntheticRecords });
  // Reload so the app's in-memory record cache starts from the seeded localStorage value.
  await page.reload();
  await expect(page.locator('#homeStatsPicker')).toBeVisible();

  await picker.selectOption(['streak']);
  await expect(page.locator('[data-home-stat="streak"]')).toBeVisible();
  await expect(page.locator('[data-home-stat="doneCount"]')).toBeHidden();
  await expect(page.locator('[data-home-stat="monthRate"]')).toBeHidden();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('lifeos.homeStats.v1') || '[]'))).toEqual(['streak']);

  await page.reload();
  await expect(page.locator('#homeStatsPicker option:checked')).toHaveCount(1);
  await expect.poll(() => page.locator('#homeStatsPicker').evaluate(el => Array.from(el.selectedOptions).map(option => option.value))).toEqual(['streak']);
  await expect(page.locator('[data-home-stat="streak"]')).toBeVisible();
  await expect(page.locator('[data-home-stat="doneCount"]')).toBeHidden();
  const savedRecords = await page.evaluate(key => JSON.parse(localStorage.getItem(key) || '{}'), recordKey);
  // App initialization may create today's blank record; the seeded historical record must remain unchanged.
  expect(savedRecords['2026-10-20']).toEqual(syntheticRecords['2026-10-20']);
});
