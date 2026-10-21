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
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#importFile').setInputFiles({
    name: 'quota-backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup))
  });

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

  await page.locator('#importFile').setInputFiles({
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

  await Promise.all([
    page.waitForNavigation(),
    page.locator('#importFile').setInputFiles({
      name: 'project-switch-backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup))
    })
  ]);

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
  await page.locator('#importFile').setInputFiles({
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
    localStorage.setItem('lifeos.records.v1.project1', JSON.stringify({
      [today]: { tasks, metrics: {}, reflection: { win: '', blocker: '', tomorrow: '' } }
    }));
  }, today);
  await page.reload();
  await expect(page.locator('#dailyReportContent')).toContainText('100%');
  const reportText = await page.locator('#dailyReportContent').innerText();
  expect(reportText).toMatch(/완료한 행동\s*\d+회/);
  expect(reportText).not.toContain('완료한 행동\n0회');
});
