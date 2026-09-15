import { WEAPONS, type WeaponId } from '@ice-water/shared';
import type { PlayerState } from '../rooms/lobby-state.js';

interface SlotState {
  id: WeaponId;
  ammo: number;
  reserve: number;
}
export class WeaponController {
  private readonly inventories = new Map<string, SlotState[]>();
  reset(player: PlayerState): void {
    const ids: WeaponId[] = [player.primaryWeapon, 'pistol', 'ice-pick'];
    this.inventories.set(
      player.playerId,
      ids.map((id) => ({ id, ammo: WEAPONS[id].magazineSize, reserve: WEAPONS[id].reserveAmmo })),
    );
    player.currentWeaponSlot = 0;
    player.reloadUntil = 0;
    player.fireReadyAt = 0;
    this.sync(player);
  }
  tick(player: PlayerState, now: number): void {
    if (!player.reloadUntil || now < player.reloadUntil) return;
    const slot = this.slot(player);
    const needed = Math.min(WEAPONS[slot.id].magazineSize - slot.ammo, slot.reserve);
    slot.ammo += needed;
    slot.reserve -= needed;
    player.reloadUntil = 0;
    this.sync(player);
  }
  reload(player: PlayerState, now: number): string | null {
    this.tick(player, now);
    const slot = this.slot(player),
      stats = WEAPONS[slot.id];
    if (
      stats.slot === 'melee' ||
      player.reloadUntil ||
      slot.ammo >= stats.magazineSize ||
      !slot.reserve
    )
      return 'Cannot reload';
    player.reloadUntil = now + stats.reloadMs;
    return null;
  }
  switch(player: PlayerState, slot: number): void {
    player.reloadUntil = 0;
    player.currentWeaponSlot = slot;
    this.sync(player);
  }
  fire(player: PlayerState, now: number): string | null {
    this.tick(player, now);
    const slot = this.slot(player);
    if (player.reloadUntil || now < player.fireReadyAt) return 'Weapon is not ready';
    if (slot.ammo === 0) return 'Magazine is empty';
    if (WEAPONS[slot.id].slot !== 'melee') slot.ammo--;
    player.fireReadyAt = now + WEAPONS[slot.id].fireRateMs;
    player.protectedUntil = 0;
    this.sync(player);
    return null;
  }
  private slot(player: PlayerState): SlotState {
    if (!this.inventories.has(player.playerId)) this.reset(player);
    return this.inventories.get(player.playerId)![player.currentWeaponSlot]!;
  }
  private sync(player: PlayerState): void {
    const slot = this.slot(player);
    player.weaponId = slot.id;
    player.ammo = slot.ammo;
    player.reserveAmmo = slot.reserve;
  }
}
