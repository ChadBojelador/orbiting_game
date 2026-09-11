import { expect, test, type BrowserContext, type Page } from '@playwright/test';

async function identify(page: Page, name: string) {
  await page.goto('/');
  await page.getByLabel('Display name').fill(name);
  await page.getByRole('button', { name: 'Let’s go' }).click();
  await expect(page.getByRole('button', { name: 'Create private room' })).toBeVisible();
}

test('six guests create a private room, join, count down, and receive roles', async ({
  browser,
  page,
}) => {
  const contexts: BrowserContext[] = [];
  await identify(page, 'Host Snow');
  await page.getByRole('button', { name: 'Create private room' }).click();
  const invite = page.getByLabel('Room invite code');
  await expect(invite).toBeVisible();
  const code = (await invite.textContent())!;
  await expect(page.getByRole('button', { name: 'Start countdown' })).toBeDisabled();
  try {
    for (let index = 0; index < 5; index++) {
      const context = await browser.newContext();
      contexts.push(context);
      const friend = await context.newPage();
      await identify(friend, `Friend ${index}`);
      await friend.getByLabel('Invite code', { exact: true }).fill(code);
      await friend.getByRole('button', { name: 'Join room' }).click();
      await expect(friend.getByLabel('Room invite code')).toHaveText(code);
      await expect(friend.getByRole('button', { name: 'Start countdown' })).toHaveCount(0);
    }
    await expect(page.getByLabel('Connected players')).toHaveText('6 / 150 connected');
    await page.getByRole('button', { name: 'Start countdown' }).click();
    await expect(page.getByText(/Starting in [1-5]/)).toBeVisible();
    await expect(page.getByText('Teams are set!')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/You’re (Ice|Water)/)).toBeVisible();
    await page.screenshot({ path: 'test-results/lobby-desktop.png', fullPage: true });
    await page.getByRole('button', { name: 'Leave room' }).click();
    await expect(page.getByRole('button', { name: 'Create private room' })).toBeVisible();
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});

test('mobile form handles validation and missing invite codes without overflow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByLabel('Display name').fill('<>');
  await page.getByRole('button', { name: 'Let’s go' }).click();
  await expect(page.getByRole('alert')).toContainText('2–20');
  await page.getByLabel('Display name').fill('Mobile Guest');
  await page.getByRole('button', { name: 'Let’s go' }).click();
  await page.getByLabel('Invite code', { exact: true }).fill('ABCDEFGH');
  await page.getByRole('button', { name: 'Join room' }).click();
  await expect(page.getByRole('alert')).toContainText('Room not found');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/lobby-mobile.png', fullPage: true });
});
