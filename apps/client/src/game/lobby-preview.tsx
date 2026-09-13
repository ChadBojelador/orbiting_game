import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { loadCharacterModel } from './character-model.js';

export function LobbyPreview() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasGraphics, setHasGraphics] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let isDisposed = false;
    let destroy: (() => void) | undefined;

    void Promise.resolve()
      .then(async () => {
        if (isDisposed) return;
        const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        const scene = new THREE.Scene();
        scene.background = new THREE.Color('#c9eee1');
        scene.fog = new THREE.Fog('#c9eee1', 9, 18);
        const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 50);
        camera.position.set(3.2, 2.45, 4.45);
        camera.lookAt(0, 0.5, 0);
        scene.add(new THREE.HemisphereLight(0xe8fbff, 0x5f7564, 2));
        const sun = new THREE.DirectionalLight(0xffedca, 2);
        sun.position.set(-4, 7, 5);
        scene.add(sun);
        const world = new THREE.Group();
        scene.add(world);

        const shape = (
          name: string,
          color: string,
          position: [number, number, number],
          scale: [number, number, number],
        ) => {
          const material = new THREE.MeshStandardMaterial({ color, roughness: 0.75 });
          const object = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1, 20), material);
          object.name = name;
          object.position.set(...position);
          object.scale.set(...scale);
          world.add(object);
        };
        shape('plinth', '#79D49A', [0, -0.1, 0], [3.8, 0.35, 2.8]);
        shape('water-base', '#FFF1D1', [-0.85, 0.1, 0.1], [1.2, 0.12, 1.2]);
        shape('ice-base', '#4056D8', [0.85, 0.1, -0.1], [1.2, 0.12, 1.2]);

        const prop = (
          name: string,
          geometry: THREE.BufferGeometry,
          color: string,
          position: [number, number, number],
          scale: [number, number, number] = [1, 1, 1],
        ) => {
          const object = new THREE.Mesh(
            geometry,
            new THREE.MeshStandardMaterial({ color, roughness: 0.8 }),
          );
          object.name = name;
          object.position.set(...position);
          object.scale.set(...scale);
          world.add(object);
        };

        prop(
          'shallow-channel',
          new THREE.BoxGeometry(2.4, 0.04, 0.42),
          '#48CFE3',
          [0, 0.13, 0.78],
          [1, 1, 1],
        );
        prop('bridge', new THREE.BoxGeometry(0.8, 0.16, 0.62), '#FF8D7A', [-0.1, 0.23, 0.78]);
        prop('rock-a', new THREE.DodecahedronGeometry(0.22, 0), '#8BB7A0', [-1.9, 0.23, -0.75]);
        prop('rock-b', new THREE.DodecahedronGeometry(0.16, 0), '#70968A', [1.8, 0.2, 0.8]);

        const addTree = (position: [number, number, number], scale: number) => {
          prop('tree-trunk', new THREE.CylinderGeometry(0.1, 0.14, 0.65, 8), '#A96F56', position, [
            scale,
            scale,
            scale,
          ]);
          prop(
            'tree-crown',
            new THREE.IcosahedronGeometry(0.48, 1),
            '#4EAD78',
            [position[0], position[1] + 0.52 * scale, position[2]],
            [scale, scale, scale],
          );
        };
        addTree([-2.2, 0.34, 0.25], 0.9);
        addTree([2.1, 0.32, -0.55], 0.72);

        const addCrystal = (position: [number, number, number], scale: number) => {
          prop('frost-crystal', new THREE.ConeGeometry(0.25, 0.85, 6), '#7EEBFF', position, [
            scale,
            scale,
            scale,
          ]);
        };
        addCrystal([1.55, 0.55, -0.35], 0.8);
        addCrystal([1.86, 0.42, -0.18], 0.52);

        const addFlower = (position: [number, number, number], color: string) => {
          prop(
            'flower-stem',
            new THREE.CylinderGeometry(0.025, 0.025, 0.28, 6),
            '#3E9A6B',
            position,
          );
          prop('flower-head', new THREE.SphereGeometry(0.11, 10, 6), color, [
            position[0],
            position[1] + 0.17,
            position[2],
          ]);
        };
        addFlower([-1.45, 0.35, 0.9], '#FF8D7A');
        addFlower([-1.7, 0.35, 0.72], '#FFF1D1');

        const resize = () => {
          const parent = canvas.parentElement;
          if (!parent) return;
          const width = Math.max(1, parent.clientWidth);
          const height = Math.max(1, parent.clientHeight);
          renderer.setSize(width, height, false);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
        };
        const observer = new ResizeObserver(resize);
        if (canvas.parentElement) observer.observe(canvas.parentElement);
        resize();

        const factory = await loadCharacterModel();
        if (isDisposed) {
          observer.disconnect();
          renderer.dispose();
          return;
        }
        const water = factory.instantiate('#48CFE3', 'Wave');
        water.root.position.set(-0.85, 0.16, 0.1);
        water.root.rotation.y = THREE.MathUtils.degToRad(18);
        world.add(water.root);
        const frozen = factory.instantiate('#BDEFFF', 'Frozen');
        frozen.root.position.set(0.85, 0.16, -0.1);
        world.add(frozen.root);

        let animationFrame = 0;
        let previousTime = performance.now();
        const render = (time: number) => {
          const delta = Math.min(0.05, (time - previousTime) / 1000);
          previousTime = time;
          world.rotation.y = Math.sin(time * 0.00018) * 0.12;
          water.update(delta);
          frozen.update(delta);
          renderer.render(scene, camera);
          animationFrame = requestAnimationFrame(render);
        };
        animationFrame = requestAnimationFrame(render);

        destroy = () => {
          cancelAnimationFrame(animationFrame);
          observer.disconnect();
          scene.traverse((object) => {
            if (!(object instanceof THREE.Mesh)) return;
            object.geometry.dispose();
            const materials = Array.isArray(object.material) ? object.material : [object.material];
            for (const material of materials) material.dispose();
          });
          renderer.dispose();
        };
      })
      .catch(() => setHasGraphics(false));

    return () => {
      isDisposed = true;
      destroy?.();
    };
  }, []);

  return (
    <div className="lobby-preview preview" aria-hidden="true">
      {hasGraphics ? (
        <canvas ref={canvasRef} />
      ) : (
        <div className="preview-fallback">ICE / WATER</div>
      )}
    </div>
  );
}
