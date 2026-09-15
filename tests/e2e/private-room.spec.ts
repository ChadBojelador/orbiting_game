import { expect, test, type Page } from '@playwright/test';
import { matchMaker, type Room } from '@colyseus/core';
import type { RoomReservation } from '@ice-water/shared';
import type { LobbyState } from '../../apps/server/src/rooms/lobby-state.js';
import { startServer } from '../../apps/server/src/app.js';
import { readConfig } from '../../apps/server/src/config/environment.js';
let server: Awaited<ReturnType<typeof startServer>>;
test.beforeAll(async () => {
  server = await startServer(
    readConfig({
      GUEST_SESSION_SIGNING_SECRET: 'e2e-only-secret-at-least-32-characters',
      GAME_SERVER_PORT: '2568',
      COUNTDOWN_SECONDS: '1',
      CLIENT_ORIGIN: 'http://localhost:5174',
      DEV_BOT_COUNT: '0',
    }),
    { isReady: async () => true, saveMatchSummary: async () => true, close: async () => {} },
  );
});
test.afterAll(async () => {
  await server?.stop();
});
async function identify(page: Page, name: string) {
  await page.goto('/');
  await page.getByLabel('Display name').fill(name);
  await page.getByRole('button', { name: 'Let’s go' }).click();
  await expect(page.getByRole('button', { name: 'Create private room' })).toBeVisible();
}
async function create(page: Page) {
  const response = page.waitForResponse(
    (r) => r.url().endsWith('/api/rooms') && r.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Create private room' }).click();
  const reservation = (await (await response).json()) as RoomReservation;
  await expect(page.getByLabel('Room invite code')).toBeVisible();
  const room = matchMaker.getLocalRoomById(reservation.seat.roomId) as Room<{ state: LobbyState }>;
  if (!room) throw new Error('Test room not found');
  return { room, code: reservation.inviteCode };
}
async function start(page: Page) {
  await page.getByRole('button', { name: 'Start countdown' }).click();
  await expect(page.getByLabel('Health', { exact: true })).toBeVisible({ timeout: 15000 });
}
test('desktop guests play, shoot, die, respawn, see scores and finish', async ({
  page,
  browser,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await identify(page, 'FPS Host');
  const { room, code } = await create(page);
  const context = await browser.newContext();
  const friend = await context.newPage();
  try {
    await identify(friend, 'FPS Friend');
    await friend.getByLabel('Invite code', { exact: true }).fill(code);
    await friend.getByRole('button', { name: 'Join room', exact: true }).click();
    await expect
      .poll(() => [...room.state.players.values()].filter((player) => player.isConnected).length)
      .toBe(2);
    await expect(page.getByLabel('Connected players')).toHaveText(/2\s*\/ 150 connected/);
    await start(page);
    await page.getByRole('button', { name: 'Enter arena' }).click();
    await expect.poll(() => page.evaluate(() => !!document.pointerLockElement)).toBe(true);
    const a = room.state.players.get(room.state.hostPlayerId)!,
      b = [...room.state.players.values()].find((p) => p.playerId !== a.playerId)!;
    const position = { x: a.x, z: a.z };
    await page.keyboard.down('KeyW');
    await expect.poll(() => Math.hypot(a.x - position.x, a.z - position.z)).toBeGreaterThan(1);
    await page.keyboard.up('KeyW');
    await page.keyboard.press('Space');
    await expect.poll(() => a.y).toBeGreaterThan(0);
    await expect.poll(() => a.isGrounded).toBe(true);
    Object.assign(a, {
      x: -50,
      y: 0,
      z: -30,
      yaw: 0,
      pitch: 0,
      velocityX: 0,
      velocityZ: 0,
      protectedUntil: 0,
      spawnGeneration: a.spawnGeneration + 1,
    });
    Object.assign(b, { x: -50, y: 0, z: -33, hp: 1, protectedUntil: 0 });
    room.broadcastPatch();
    await expect.poll(() => a.inputSequence).toBeGreaterThan(10);
    await page.waitForTimeout(150);
    await page.mouse.down();
    await page.mouse.up();
    await expect(friend.getByText('Eliminated by FPS Host')).toBeVisible();
    await expect(page.getByText('1 / 30 kills')).toBeVisible();
    await expect.poll(() => b.status).toBe('alive');
    await expect(friend.getByText('Eliminated by FPS Host')).toHaveCount(0);
    await page.keyboard.press('KeyR');
    await expect(page.getByText('Reloading…')).toBeVisible();
    await expect(page.getByText('Reloading…')).toHaveCount(0, { timeout: 4000 });
    await page.keyboard.press('Digit2');
    await expect(page.locator('.ammo-display')).toContainText('Snowmelt');
    await page.keyboard.down('Tab');
    await expect(page.getByRole('region', { name: 'Scoreboard' })).toBeVisible();
    await page.keyboard.up('Tab');
    await page.screenshot({ path: 'test-results/fps-desktop.png' });
    a.kills = 30;
    const advance = Reflect.get(room, 'advance') as (now: number) => void;
    advance.call(room, Date.now());
    room.broadcastPatch();
    await expect(page.getByRole('heading', { name: 'FPS Host wins' })).toBeVisible();
    await page.screenshot({ path: 'test-results/fps-results.png' });
    await page.getByRole('button', { name: 'Back to lobby' }).click();
    await expect(page.getByRole('button', { name: 'Create private room' })).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});
for (const mapId of ['frostline', 'island'] as const)
  test(
    'mobile ' + mapId + ' supports simultaneous movement, look and fire without overflow',
    async ({ browser }) => {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      });
      const page = await context.newPage(),
        errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      const cdp = await context.newCDPSession(page);
      // Signed desktop Chrome in this runner may ignore context-level hasTouch.
      // Enable actual CDP touch emulation before loading the client.
      await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
      try {
        await page.goto('/');
        await page.getByLabel('Display name').fill('<>');
        await page.getByRole('button', { name: 'Let’s go' }).tap();
        await expect(page.getByRole('alert')).toContainText('2–20');
        await page.getByLabel('Display name').fill('Touch Player');
        await page.getByRole('button', { name: 'Let’s go' }).tap();
        await page.getByLabel('Invite code', { exact: true }).fill('ABCDEFGH');
        await page.getByRole('button', { name: 'Join room', exact: true }).tap();
        await expect(page.getByRole('alert')).toContainText('Room not found');
        await page.screenshot({ path: 'test-results/fps-lobby-mobile.png', fullPage: true });
        await page.getByLabel('Map', { exact: true }).selectOption(mapId);
        const { room } = await create(page);
        await start(page);
        await expect(page.getByRole('button', { name: 'Fire', exact: true })).toBeVisible();
        const p = room.state.players.get(room.state.hostPlayerId)!,
          before = { x: p.x, z: p.z, yaw: p.yaw };
        const stick = (await page.getByLabel('Movement joystick').boundingBox())!,
          fire = (await page.getByRole('button', { name: 'Fire', exact: true }).boundingBox())!;
        const x = stick.x + stick.width / 2,
          y = stick.y + stick.height / 2;
        await cdp.send('Input.dispatchTouchEvent', {
          type: 'touchStart',
          touchPoints: [{ id: 1, x, y }],
        });
        await cdp.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [{ id: 1, x, y: y - 40 }],
        });
        await cdp.send('Input.dispatchTouchEvent', {
          type: 'touchStart',
          touchPoints: [
            { id: 1, x, y: y - 40 },
            { id: 2, x: 200, y: 350 },
          ],
        });
        await cdp.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [
            { id: 1, x, y: y - 40 },
            { id: 2, x: 245, y: 350 },
          ],
        });
        await cdp.send('Input.dispatchTouchEvent', {
          type: 'touchStart',
          touchPoints: [
            { id: 1, x, y: y - 40 },
            { id: 2, x: 245, y: 350 },
            { id: 3, x: fire.x + fire.width / 2, y: fire.y + fire.height / 2 },
          ],
        });
        await expect.poll(() => Math.hypot(p.x - before.x, p.z - before.z)).toBeGreaterThan(1);
        await expect.poll(() => p.ammo).toBeLessThan(30);
        expect(p.yaw).not.toBe(before.yaw);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await page.getByRole('button', { name: 'Weapon', exact: true }).tap();
        await expect(page.locator('.ammo-display')).toContainText('Snowmelt');
        await page.getByRole('button', { name: 'Scores', exact: true }).tap();
        await expect(page.getByRole('region', { name: 'Scoreboard' })).toBeVisible();
        await page.getByRole('button', { name: 'Scores', exact: true }).tap();
        await expect(page.getByRole('region', { name: 'Scoreboard' })).toHaveCount(0);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
        await page.screenshot({ path: 'test-results/fps-mobile-' + mapId + '.png' });
        await page.setViewportSize({ width: 844, height: 390 });
        await expect(page.getByRole('button', { name: 'Fire', exact: true })).toBeVisible();
        await page.screenshot({ path: 'test-results/fps-mobile-landscape-' + mapId + '.png' });
        await page.getByRole('button', { name: 'Leave room' }).tap();
        expect(errors).toEqual([]);
      } finally {
        await context.close();
      }
    },
  );
test('loadout, duel mode and local settings survive their intended boundaries', async ({
  page,
}) => {
  await identify(page, 'Loadout Guest');
  await page.getByLabel('Game mode', { exact: true }).selectOption('duel');
  await page.getByLabel('Primary weapon').selectOption('sniper');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Field of view', { exact: false }).press('End');
  for (let i = 0; i < 6; i++)
    await page.getByLabel('Field of view', { exact: false }).press('ArrowLeft');
  await page.getByRole('button', { name: 'Done' }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Create private room' })).toBeVisible();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByLabel('Field of view')).toHaveValue('104');
  await page.getByRole('button', { name: 'Done' }).click();
  await page.getByLabel('Game mode', { exact: true }).selectOption('duel');
  await page.getByLabel('Primary weapon').selectOption('sniper');
  const { room } = await create(page);
  await expect.poll(() => room.state.gameMode).toBe('duel');
  await expect
    .poll(() => room.state.players.get(room.state.hostPlayerId)?.primaryWeapon)
    .toBe('sniper');
  await page.screenshot({ path: 'test-results/fps-lobby-desktop.png', fullPage: true });
  await start(page);
  await expect(page.locator('.ammo-display')).toContainText('Icicle');
  await page.getByRole('button', { name: 'Leave room' }).click();
});

test('Frost Island loads its central Fort and uses the selected authoritative map', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await identify(page, 'Island Scout');
  await page.getByLabel('Map', { exact: true }).selectOption('island');
  const { room } = await create(page);
  await expect.poll(() => room.state.mapId).toBe('island');
  await expect.poll(() => room.state.arenaHalfExtent).toBe(80);
  const loaded = page.waitForResponse(
    (response) => response.url().includes('island-fort.glb') && response.status() === 200,
  );
  await start(page);
  await loaded;
  await page.getByRole('button', { name: 'Enter arena' }).click();
  const player = room.state.players.get(room.state.hostPlayerId)!;
  expect(player.y).toBeCloseTo(0.25);
  const before = { x: player.x, z: player.z };
  await page.keyboard.down('KeyW');
  await expect
    .poll(() => Math.hypot(player.x - before.x, player.z - before.z))
    .toBeGreaterThan(1.5);
  await page.keyboard.up('KeyW');
  await page.mouse.down();
  await expect.poll(() => player.ammo).toBeLessThan(30);
  await page.mouse.up();
  await page.screenshot({ path: 'test-results/fps-island.png' });
  expect(errors).toEqual([]);
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => document.pointerLockElement === null)).toBe(true);
  await page.getByRole('button', { name: 'Leave room' }).click();
});
