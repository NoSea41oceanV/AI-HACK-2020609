#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const required = [
  'PLAYWRIGHT_MODULE',
  'STAFF_E2E_BASE_URL',
  'STAFF_E2E_AUTH_URL',
  'STAFF_E2E_FIRESTORE_URL',
  'STAFF_E2E_PROJECT_ID',
  'STAFF_E2E_OUTPUT_DIR',
];
const missing = required.filter((name) => !process.env[name]?.trim());
if (missing.length) {
  console.error(`[SKIP] ローカルスタッフE2Eは未実行です。不足: ${missing.join(', ')}`);
  process.exit(2);
}

function loopbackUrl(name) {
  const url = new URL(process.env[name].trim());
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) {
    throw new Error(`${name} はloopbackのHTTP URLにしてください。`);
  }
  if (url.username || url.password) throw new Error(`${name} に認証情報を含めないでください。`);
  return url.toString().replace(/\/$/, '');
}

const appUrl = loopbackUrl('STAFF_E2E_BASE_URL');
const authUrl = loopbackUrl('STAFF_E2E_AUTH_URL');
const firestoreUrl = loopbackUrl('STAFF_E2E_FIRESTORE_URL');
const projectId = process.env.STAFF_E2E_PROJECT_ID.trim();
if (!/^demo-[a-z0-9-]+$/.test(projectId)) throw new Error('STAFF_E2E_PROJECT_ID は demo- で始まるローカル用IDにしてください。');

const repositoryRoot = path.resolve(__dirname, '..');
const outputDir = path.resolve(process.env.STAFF_E2E_OUTPUT_DIR.trim());
const outputRelative = path.relative(repositoryRoot, outputDir);
if (outputRelative === '' || (!outputRelative.startsWith(`..${path.sep}`) && outputRelative !== '..')) {
  throw new Error('STAFF_E2E_OUTPUT_DIR はリポジトリ外を指定してください。');
}
fs.mkdirSync(outputDir, { recursive: true });

const playwright = require(path.resolve(process.env.PLAYWRIGHT_MODULE.trim()));
const launchOptions = { headless: true };
if (process.env.PLAYWRIGHT_EXECUTABLE_PATH?.trim()) launchOptions.executablePath = path.resolve(process.env.PLAYWRIGHT_EXECUTABLE_PATH.trim());

const password = 'LocalOnly-PawPair-2026!';
const email = `staff-e2e-${Date.now()}@example.invalid`;
const firestoreBase = `${firestoreUrl}/v1/projects/${projectId}/databases/(default)/documents`;

async function responseJson(response, label) {
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(`${label} failed: HTTP ${response.status}, ${payload.error?.message ?? text}`);
  return payload;
}

async function createSyntheticFacility() {
  const auth = await responseJson(await fetch(`${authUrl}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  }), 'Auth emulator signup');
  if (!auth.localId || !auth.idToken) throw new Error('Auth emulator did not return localId/idToken.');

  const adminHeaders = { Authorization: 'Bearer owner', 'content-type': 'application/json' };
  const write = async (documentPath, fields) => responseJson(await fetch(`${firestoreBase}/${documentPath}`, {
    method: 'PATCH', headers: adminHeaders, body: JSON.stringify({ fields }),
  }), `Seed ${documentPath}`);
  const now = new Date().toISOString();
  await write(`facilities/${auth.localId}`, { active: { booleanValue: true } });
  await Promise.all([
    write(`facilities/${auth.localId}/staffProfiles/staff-sora`, { active: { booleanValue: true }, name: { stringValue: 'そら' }, createdAt: { timestampValue: now } }),
    write(`facilities/${auth.localId}/staffProfiles/staff-rin`, { active: { booleanValue: true }, name: { stringValue: 'りん' }, createdAt: { timestampValue: now } }),
  ]);

  const pets = [
    ['e2e-coco', 'ココ', 'トイプードル', 3, 4.2, 4, 5, 2, 2, 1, ['chase', 'fetch'], [], '人が好きで、ボール遊びへの反応が良い。'],
    ['e2e-mugi', 'むぎ', '柴犬', 4, 9.8, 4, 4, 2, 3, 2, ['chase', 'tug'], [], '遊びの誘いが上手で、適度な休憩を取れる。'],
    ['e2e-sora', 'そら', 'チワワ', 8, 2.7, 2, 2, 4, 2, 1, ['gentle', 'solo'], ['e2e-hana'], '静かな場所では落ち着く。急な接近に注意。'],
    ['e2e-hana', 'ハナ', 'フレンチブルドッグ', 2, 10.5, 3, 4, 2, 3, 2, ['wrestle', 'tug'], [], '短時間の力強い遊びを好む。'],
  ];
  await Promise.all(pets.map(([id, name, breed, age, weight, energy, social, anxiety, assertive, guarding, styles, blocked, notes]) => write(
    `facilities/${auth.localId}/demoPets/${id}`,
    {
      name: { stringValue: name }, breed: { stringValue: breed }, ageYears: { doubleValue: age }, weightKg: { doubleValue: weight },
      energyLevel: { integerValue: String(energy) }, sociability: { integerValue: String(social) }, anxietyLevel: { integerValue: String(anxiety) },
      assertiveness: { integerValue: String(assertive) }, resourceGuarding: { integerValue: String(guarding) },
      playStyles: { arrayValue: { values: styles.map((value) => ({ stringValue: value })) } },
      hardBlockedPetIds: { arrayValue: { values: blocked.map((value) => ({ stringValue: value })) } },
      notes: { stringValue: notes }, updatedAt: { stringValue: now },
    },
  )));
  return { facilityId: auth.localId, idToken: auth.idToken };
}

async function values(locator) {
  const result = [];
  for (let index = 0; index < await locator.count(); index += 1) result.push(await locator.nth(index).inputValue());
  return result;
}

async function validSwap(page, selects, original) {
  for (let left = 0; left < original.length; left += 1) {
    for (let right = left + 1; right < original.length; right += 1) {
      if (original[left] === original[right]) continue;
      await selects.nth(left).selectOption(original[right]);
      await selects.nth(right).selectOption(original[left]);
      if (await page.getByText('重複・同室不可・定員・未割当の問題はありません。').isVisible()) return [left, right];
      await page.getByRole('button', { name: /に戻す$/ }).click();
    }
  }
  throw new Error('有効な部屋間swapを作れませんでした。');
}

async function newestSnapshot(facilityId, idToken) {
  const payload = await responseJson(await fetch(`${firestoreBase}/facilities/${facilityId}/demoMatchingSnapshots?pageSize=25`, {
    headers: { Authorization: `Bearer ${idToken}` },
  }), 'Read matching snapshots');
  const documents = payload.documents ?? [];
  documents.sort((left, right) => (right.fields?.createdAt?.stringValue ?? '').localeCompare(left.fields?.createdAt?.stringValue ?? ''));
  return documents[0] ?? null;
}

let activeBrowser;
(async () => {
  const fixture = await createSyntheticFacility();
  const browser = await playwright.chromium.launch(launchOptions);
  activeBrowser = browser;
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const consoleProblems = [];
  page.on('console', (message) => { if (['error', 'warning'].includes(message.type())) consoleProblems.push(`${message.type()}: ${message.text()}`); });
  page.on('pageerror', (error) => consoleProblems.push(`pageerror: ${error.message}`));

  await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
  await page.getByLabel('メールアドレス').fill(email);
  await page.getByLabel('パスワード').fill(password);
  await page.getByRole('button', { name: 'ログイン', exact: true }).click();
  await page.getByRole('heading', { name: '操作するスタッフを選択' }).waitFor();
  await page.getByRole('button', { name: 'そら', exact: true }).click();
  await page.getByRole('heading', { name: '登録Pet一覧' }).waitFor();
  await page.getByText('ココ', { exact: true }).first().waitFor();

  if (!await page.title()) throw new Error('Page title is empty.');
  if ((await page.locator('body').innerText()).includes('Internal Server Error')) throw new Error('Framework error overlay found.');
  await page.getByRole('button', { name: '詳細を見る' }).first().click();
  await page.getByRole('heading', { name: /の性格と候補相性/ }).waitFor();
  await page.locator('.candidate-list button').first().click();
  await page.getByRole('heading', { name: '相性カルテ' }).waitFor();
  await page.screenshot({ path: path.join(outputDir, 'staff-dashboard-desktop.png'), fullPage: true });

  const selects = page.locator('.assignment-editor select');
  const original = await values(selects);
  if (original.length !== 4) throw new Error(`Expected 4 assignment selects, got ${original.length}.`);
  const crossRoom = original.findIndex((roomId, index) => index > 0 && roomId !== original[0]);
  if (crossRoom < 0) throw new Error('Could not find pets in different rooms.');
  await selects.nth(0).selectOption(original[crossRoom]);
  await page.getByText(/定員2頭を超えています/).waitFor();
  if (!await page.getByRole('button', { name: '最終案を確定' }).isDisabled()) throw new Error('Capacity conflict must disable confirmation.');
  await page.locator('#assignment-review').screenshot({ path: path.join(outputDir, 'staff-assignment-conflict.png') });
  await selects.nth(0).selectOption('');
  await page.getByText(/が未割当です/).waitFor();
  if (!await page.getByRole('button', { name: '最終案を確定' }).isDisabled()) throw new Error('Unassigned pet must disable confirmation.');
  await page.getByRole('button', { name: /に戻す$/ }).click();
  const labels = await selects.evaluateAll((items) => items.map((item) => item.getAttribute('aria-label')));
  const soraIndex = labels.indexOf('そらの最終割当');
  const hanaIndex = labels.indexOf('ハナの最終割当');
  if (soraIndex < 0 || hanaIndex < 0) throw new Error('Hard-constraint fixture pets were not rendered.');
  await selects.nth(soraIndex).selectOption(original[hanaIndex]);
  await page.getByText(/同室不可の組み合わせ/).last().waitFor();
  if (!await page.getByRole('button', { name: '最終案を確定' }).isDisabled()) throw new Error('Hard conflict must disable confirmation.');
  await page.getByRole('button', { name: /に戻す$/ }).click();

  await validSwap(page, selects, original);
  const firstFinal = await values(selects);
  await page.getByRole('button', { name: '最終案を確定' }).click();
  await page.getByText('この部屋割りを確定して保存しました。').waitFor();
  await page.getByRole('button', { name: '確定済み' }).waitFor();
  await page.screenshot({ path: path.join(outputDir, 'staff-assignment-confirmed.png'), fullPage: false });

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '操作するスタッフを選択' }).waitFor();
  await page.getByRole('button', { name: 'そら', exact: true }).click();
  await page.getByRole('heading', { name: '登録Pet一覧' }).waitFor();
  if (JSON.stringify(await values(page.locator('.assignment-editor select'))) !== JSON.stringify(firstFinal)) throw new Error('Confirmed assignment was not restored after reload.');

  await page.getByRole('button', { name: '担当を変更' }).click();
  await page.getByRole('button', { name: 'りん', exact: true }).click();
  await page.getByRole('heading', { name: '登録Pet一覧' }).waitFor();
  const rinSelects = page.locator('.assignment-editor select');
  await validSwap(page, rinSelects, await values(rinSelects));
  await page.getByRole('button', { name: '最終案を確定' }).click();
  await page.getByText('この部屋割りを確定して保存しました。').waitFor();
  const latest = await newestSnapshot(fixture.facilityId, fixture.idToken);
  if (latest?.fields?.status?.stringValue !== 'confirmed' || latest.fields?.changedByStaffId?.stringValue !== 'staff-rin' || latest.fields?.confirmedByStaffId?.stringValue !== 'staff-rin') {
    throw new Error('Latest saved snapshot does not contain staff-rin change/confirmation audit fields.');
  }

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileWidth = await page.evaluate(() => ({ clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
  if (mobileWidth.scrollWidth > mobileWidth.clientWidth) throw new Error(`Mobile horizontal overflow: ${JSON.stringify(mobileWidth)}`);
  await page.screenshot({ path: path.join(outputDir, 'staff-dashboard-mobile.png'), fullPage: true });
  if (consoleProblems.length) throw new Error(`Console problems: ${consoleProblems.join(' | ')}`);

  console.log(JSON.stringify({ fixture: 'synthetic non-PII facility, 2 staff, 4 pets', desktop: '1440x1000', mobile: '390x844', mobileWidth, latestAuditStaff: 'staff-rin', consoleProblems }, null, 2));
  await browser.close();
  activeBrowser = undefined;
})().catch(async (error) => {
  if (activeBrowser) await activeBrowser.close().catch(() => undefined);
  console.error(`[FAIL] ${error.stack || error.message}`);
  process.exitCode = 1;
});
