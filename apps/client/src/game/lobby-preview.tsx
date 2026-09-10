import { useEffect, useRef, useState } from 'react';

export function LobbyPreview() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasGraphics, setHasGraphics] = useState(true);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let isDisposed = false;
    let destroy: (() => void) | undefined;
    void import('playcanvas')
      .then((pc) => {
        if (isDisposed) return;
        const app = new pc.Application(canvas, {
          graphicsDeviceOptions: { deviceTypes: ['webgl2'], antialias: true, alpha: true },
        });
        app.scene.ambientLight = new pc.Color(0.8, 0.85, 0.9);
        const camera = new pc.Entity('camera');
        camera.addComponent('camera', { clearColor: new pc.Color(0.84, 0.96, 0.92), fov: 38 });
        camera.setPosition(4, 3.5, 6);
        camera.lookAt(0, 0.5, 0);
        app.root.addChild(camera);
        const light = new pc.Entity('sun');
        light.addComponent('light', {
          type: 'directional',
          color: new pc.Color(1, 0.94, 0.8),
          intensity: 1.4,
        });
        light.setEulerAngles(45, 30, 0);
        app.root.addChild(light);
        const shape = (
          name: string,
          type: 'sphere' | 'cylinder' | 'box',
          color: string,
          position: number[],
          scale: number[],
        ) => {
          const entity = new pc.Entity(name);
          const material = new pc.StandardMaterial();
          material.diffuse = new pc.Color().fromString(color);
          material.update();
          entity.addComponent('render', { type, material });
          entity.setPosition(position[0] ?? 0, position[1] ?? 0, position[2] ?? 0);
          entity.setLocalScale(scale[0] ?? 1, scale[1] ?? 1, scale[2] ?? 1);
          app.root.addChild(entity);
          return material;
        };
        const materials = [
          shape('plinth', 'cylinder', '#79D49A', [0, -0.1, 0], [3.8, 0.35, 2.8]),
          shape('water-token', 'sphere', '#48CFE3', [-0.7, 0.65, 0.1], [0.95, 1.3, 0.95]),
          shape('ice-token', 'box', '#BDEFFF', [0.7, 0.6, -0.1], [1, 1.2, 1]),
          shape('water-base', 'cylinder', '#FFF1D1', [-0.7, 0.1, 0.1], [1.2, 0.12, 1.2]),
          shape('ice-base', 'cylinder', '#4056D8', [0.7, 0.1, -0.1], [1.2, 0.12, 1.2]),
        ];
        const resize = () => {
          const parent = canvas.parentElement;
          if (!parent) return;
          app.setCanvasFillMode(pc.FILLMODE_NONE, parent.clientWidth, parent.clientHeight);
          app.setCanvasResolution(pc.RESOLUTION_AUTO);
          app.renderNextFrame = true;
        };
        const observer = new ResizeObserver(resize);
        if (canvas.parentElement) observer.observe(canvas.parentElement);
        resize();
        app.autoRender = false;
        app.start();
        destroy = () => {
          observer.disconnect();
          app.destroy();
          materials.forEach((material) => material.destroy());
        };
      })
      .catch(() => {
        if (!isDisposed) setHasGraphics(false);
      });
    return () => {
      isDisposed = true;
      destroy?.();
    };
  }, []);
  return (
    <div className="preview">
      {hasGraphics ? (
        <canvas
          ref={canvasRef}
          aria-label="A round Water token and a frozen cube on a mint platform"
          role="img"
        />
      ) : (
        <p>Water runs. Ice chases. Everyone has a part to play.</p>
      )}
    </div>
  );
}
