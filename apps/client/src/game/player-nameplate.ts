import { CanvasTexture, LinearFilter, Sprite, SpriteMaterial, SRGBColorSpace } from 'three';

const NAMEPLATE_WIDTH = 256;
const NAMEPLATE_HEIGHT = 64;

export type NameplateTone = 'enemy' | 'friend' | 'protected';

export function createPlayerNameplate(displayName: string): Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = NAMEPLATE_WIDTH;
  canvas.height = NAMEPLATE_HEIGHT;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D is required for player nameplates');

  context.textAlign = 'center';
  context.textBaseline = 'middle';
  const fontFamily = 'Bahnschrift, "Segoe UI", sans-serif';
  let fontSize = 27;
  context.font = `600 ${fontSize}px ${fontFamily}`;
  const maxTextWidth = NAMEPLATE_WIDTH - 28;
  const initialTextWidth = context.measureText(displayName).width;
  if (initialTextWidth > maxTextWidth) {
    fontSize *= maxTextWidth / initialTextWidth;
    context.font = `600 ${fontSize}px ${fontFamily}`;
  }
  const measuredWidth = Math.min(NAMEPLATE_WIDTH, context.measureText(displayName).width + 28);
  const left = (NAMEPLATE_WIDTH - measuredWidth) / 2;

  context.fillStyle = 'rgba(12, 31, 48, 0.82)';
  context.beginPath();
  context.roundRect(left, 6, measuredWidth, 48, 8);
  context.fill();
  context.strokeStyle = 'rgba(237, 246, 250, 0.72)';
  context.lineWidth = 2;
  context.stroke();

  context.lineJoin = 'round';
  context.strokeStyle = '#10283b';
  context.lineWidth = 6;
  context.strokeText(displayName, NAMEPLATE_WIDTH / 2, 29);
  context.fillStyle = '#ffffff';
  context.fillText(displayName, NAMEPLATE_WIDTH / 2, 29);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.needsUpdate = true;

  const material = new SpriteMaterial({
    map: texture,
    transparent: true,
    alphaTest: 0.08,
    depthWrite: false,
    sizeAttenuation: false,
    toneMapped: false,
  });
  const nameplate = new Sprite(material);
  nameplate.name = `nameplate-${displayName}`;
  nameplate.scale.set(0.34, 0.085, 1);
  nameplate.renderOrder = 3;
  return nameplate;
}

export function setNameplateTone(nameplate: Sprite, tone: NameplateTone): void {
  const color = tone === 'protected' ? 0xf3b747 : tone === 'friend' ? 0x74d9ec : 0xffffff;
  (nameplate.material as SpriteMaterial).color.setHex(color);
}

export function disposePlayerNameplate(nameplate: Sprite): void {
  const material = nameplate.material as SpriteMaterial;
  material.map?.dispose();
  material.dispose();
  nameplate.removeFromParent();
}
