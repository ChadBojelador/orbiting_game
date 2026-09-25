import { describe, expect, it } from 'vitest';
import { Scene, Vector3 } from 'three';
import {
  SNOWFALL_START_MS,
  STORM_BEGUN_DURATION_MS,
  STORM_HEAVY_MS,
  STORM_MAX_MS,
  STORM_MID_MS,
  STORM_WARNING_DURATION_MS,
  STORM_WARNING_START_MS,
  Snowstorm,
  isSnowstormBegunVisible,
  isSnowstormWarningVisible,
  snowAccumulation,
  snowstormIntensity,
} from './snowstorm.js';

describe('Snowstorm mechanic (Frostline only)', () => {
  describe('Map restriction', () => {
    it('is only active on frostline and remains inactive on island and original', () => {
      // Warnings
      expect(isSnowstormWarningVisible(STORM_WARNING_START_MS, 'frostline')).toBe(true);
      expect(isSnowstormWarningVisible(STORM_WARNING_START_MS, 'island')).toBe(false);
      expect(isSnowstormWarningVisible(STORM_WARNING_START_MS, 'original')).toBe(false);

      expect(isSnowstormBegunVisible(SNOWFALL_START_MS, 'frostline')).toBe(true);
      expect(isSnowstormBegunVisible(SNOWFALL_START_MS, 'island')).toBe(false);
      expect(isSnowstormBegunVisible(SNOWFALL_START_MS, 'original')).toBe(false);

      // Intensity & accumulation
      expect(snowstormIntensity(STORM_MID_MS, 'frostline')).toBeGreaterThan(0);
      expect(snowstormIntensity(STORM_MID_MS, 'island')).toBe(0);
      expect(snowstormIntensity(STORM_MID_MS, 'original')).toBe(0);

      expect(snowAccumulation(STORM_MID_MS, 'frostline')).toBeGreaterThan(0);
      expect(snowAccumulation(STORM_MID_MS, 'island')).toBe(0);
      expect(snowAccumulation(STORM_MID_MS, 'original')).toBe(0);
    });
  });

  describe('Warning timings at 4:00 remaining', () => {
    it('shows "SNOWSTORM INCOMING!" warning at 4:00 for 3 seconds then disappears', () => {
      // Before 4:00
      expect(isSnowstormWarningVisible(STORM_WARNING_START_MS + 1, 'frostline')).toBe(false);

      // Exactly at 4:00
      expect(isSnowstormWarningVisible(STORM_WARNING_START_MS, 'frostline')).toBe(true);

      // During the 3-second display window
      expect(isSnowstormWarningVisible(STORM_WARNING_START_MS - 1500, 'frostline')).toBe(true);
      expect(
        isSnowstormWarningVisible(STORM_WARNING_START_MS - STORM_WARNING_DURATION_MS + 1, 'frostline'),
      ).toBe(true);

      // After 3 seconds, warning disappears
      expect(
        isSnowstormWarningVisible(STORM_WARNING_START_MS - STORM_WARNING_DURATION_MS, 'frostline'),
      ).toBe(false);
    });

    it('shows "The snowstorm has begun!" shortly after at 3:56.5 for 3 seconds', () => {
      // Before begun delay
      expect(isSnowstormBegunVisible(SNOWFALL_START_MS + 1, 'frostline')).toBe(false);

      // Exactly at snowfall start (3:56.5 remaining)
      expect(isSnowstormBegunVisible(SNOWFALL_START_MS, 'frostline')).toBe(true);

      // During display window
      expect(isSnowstormBegunVisible(SNOWFALL_START_MS - 1500, 'frostline')).toBe(true);
      expect(
        isSnowstormBegunVisible(SNOWFALL_START_MS - STORM_BEGUN_DURATION_MS + 1, 'frostline'),
      ).toBe(true);

      // After 3 seconds, disappears
      expect(
        isSnowstormBegunVisible(SNOWFALL_START_MS - STORM_BEGUN_DURATION_MS, 'frostline'),
      ).toBe(false);
    });
  });

  describe('Snowfall intensity progression', () => {
    it('does not fall before the snowstorm begins', () => {
      expect(snowstormIntensity(STORM_WARNING_START_MS, 'frostline')).toBe(0);
      expect(snowstormIntensity(SNOWFALL_START_MS, 'frostline')).toBe(0);
    });

    it('starts light shortly after warning and gradually increases to 0.3 at 2:00', () => {
      const early = snowstormIntensity(SNOWFALL_START_MS - 10_000, 'frostline');
      expect(early).toBeGreaterThan(0);
      expect(early).toBeLessThan(0.1);

      expect(snowstormIntensity(STORM_MID_MS, 'frostline')).toBeCloseTo(0.3);
    });

    it('increases to heavier snowfall (0.65) around 1:00 remaining', () => {
      expect(snowstormIntensity(STORM_HEAVY_MS, 'frostline')).toBeCloseTo(0.65);
    });

    it('reaches maximum blizzard intensity (1.0) around 0:10 remaining and stays max until 0:00', () => {
      expect(snowstormIntensity(STORM_MAX_MS, 'frostline')).toBe(1.0);
      expect(snowstormIntensity(5_000, 'frostline')).toBe(1.0);
      expect(snowstormIntensity(0, 'frostline')).toBe(1.0);
    });
  });

  describe('Ground snow accumulation progression', () => {
    it('has zero accumulation before snowfall starts', () => {
      expect(snowAccumulation(SNOWFALL_START_MS, 'frostline')).toBe(0);
    });

    it('has noticeable snow accumulation around 2:00 (0.15)', () => {
      expect(snowAccumulation(STORM_MID_MS, 'frostline')).toBeCloseTo(0.15);
    });

    it('has thick snow accumulation around 1:00 (0.55)', () => {
      expect(snowAccumulation(STORM_HEAVY_MS, 'frostline')).toBeCloseTo(0.55);
    });

    it('has maximum blanket coverage (1.0) around 0:10 remaining through 0:00', () => {
      expect(snowAccumulation(STORM_MAX_MS, 'frostline')).toBe(1.0);
      expect(snowAccumulation(0, 'frostline')).toBe(1.0);
    });
  });

  describe('Snowstorm Three.js lifecycle', () => {
    it('creates GPU points and ground mesh on the scene and disposes cleanly', () => {
      const scene = new Scene();
      const storm = new Snowstorm(scene, 'frostline', 'low');

      expect(scene.children).toContain(storm.group);
      expect(storm.group.name).toBe('SNOWSTORM');
      expect(storm.group.visible).toBe(false);

      const cameraPos = new Vector3(0, 1.7, 0);

      // Before storm: invisible
      storm.update(10, STORM_WARNING_START_MS, cameraPos);
      expect(storm.group.visible).toBe(false);

      // During storm: visible
      storm.update(15, STORM_MID_MS, cameraPos);
      expect(storm.group.visible).toBe(true);

      // Disposes cleanly without errors
      storm.destroy();
      expect(scene.children).not.toContain(storm.group);
    });

    it('remains invisible and inactive when configured for non-frostline map', () => {
      const scene = new Scene();
      const storm = new Snowstorm(scene, 'island', 'low');
      const cameraPos = new Vector3(0, 1.7, 0);

      storm.update(15, STORM_MID_MS, cameraPos);
      expect(storm.group.visible).toBe(false);
      storm.destroy();
    });
  });
});
