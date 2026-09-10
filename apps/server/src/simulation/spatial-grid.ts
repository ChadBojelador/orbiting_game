import { distanceSquared, type Position } from '@ice-water/shared';

export class SpatialGrid<T extends Position & { playerId: string }> {
  private readonly cells = new Map<string, Set<T>>();
  constructor(private readonly cellSize = 4) {}

  rebuild(players: Iterable<T>): void {
    this.cells.clear();
    for (const player of players) {
      const key = `${Math.floor(player.x / this.cellSize)},${Math.floor(player.z / this.cellSize)}`;
      let cell = this.cells.get(key);
      if (!cell) {
        cell = new Set();
        this.cells.set(key, cell);
      }
      cell.add(player);
    }
  }

  nearby(position: Position, radius: number): T[] {
    const found: T[] = [];
    for (
      let x = Math.floor((position.x - radius) / this.cellSize);
      x <= Math.floor((position.x + radius) / this.cellSize);
      x++
    ) {
      for (
        let z = Math.floor((position.z - radius) / this.cellSize);
        z <= Math.floor((position.z + radius) / this.cellSize);
        z++
      ) {
        for (const player of this.cells.get(`${x},${z}`) ?? [])
          if (distanceSquared(position, player) <= radius * radius) found.push(player);
      }
    }
    return found;
  }
}
