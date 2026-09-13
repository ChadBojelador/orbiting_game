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
        const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.05;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));

        const scene = new THREE.Scene();
        scene.background = new THREE.Color('#14273a');
        scene.fog = new THREE.FogExp2('#14273a', 0.055);

        const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 60);
        camera.position.set(0, 3.55, 9.4);
        camera.lookAt(0, 1.25, -0.35);

        scene.add(new THREE.HemisphereLight(0xdff8ff, 0x172638, 2.35));
        const sun = new THREE.DirectionalLight(0xfff0cb, 3.1);
        sun.position.set(-5, 9, 6);
        scene.add(sun);
        const portalLight = new THREE.PointLight(0x7eebff, 13, 10, 1.8);
        portalLight.position.set(0, 2.5, -2.9);
        scene.add(portalLight);
        const coralLight = new THREE.PointLight(0xff8d7a, 7, 8, 2);
        coralLight.position.set(-4, 1.2, 1);
        scene.add(coralLight);

        const world = new THREE.Group();
        scene.add(world);

        const addMesh = (
          name: string,
          geometry: THREE.BufferGeometry,
          color: string,
          position: [number, number, number],
          rotation: [number, number, number] = [0, 0, 0],
          scale: [number, number, number] = [1, 1, 1],
          options: { emissive?: string; roughness?: number; opacity?: number } = {},
        ) => {
          const material = new THREE.MeshStandardMaterial({
            color,
            roughness: options.roughness ?? 0.72,
            metalness: 0.04,
            emissive: options.emissive ?? '#000000',
            emissiveIntensity: options.emissive ? 1.25 : 0,
            transparent: options.opacity !== undefined,
            opacity: options.opacity ?? 1,
          });
          const object = new THREE.Mesh(geometry, material);
          object.name = name;
          object.position.set(...position);
          object.rotation.set(...rotation);
          object.scale.set(...scale);
          world.add(object);
          return object;
        };

        addMesh(
          'clubhouse-floor',
          new THREE.CylinderGeometry(8.8, 9.2, 0.5, 64),
          '#263f52',
          [0, -0.24, -0.4],
          [0, 0, 0],
          [1, 1, 0.72],
          { roughness: 0.92 },
        );
        addMesh(
          'center-rink',
          new THREE.CylinderGeometry(3.25, 3.45, 0.18, 64),
          '#31566a',
          [0, 0.05, 0.2],
          [0, 0, 0],
          [1, 1, 0.76],
        );
        addMesh(
          'water-inlay',
          new THREE.TorusGeometry(2.75, 0.085, 10, 80),
          '#48cfe3',
          [0, 0.17, 0.2],
          [Math.PI / 2, 0, 0],
          [1, 0.77, 1],
          { emissive: '#168ca7' },
        );
        addMesh(
          'ice-inlay',
          new THREE.TorusGeometry(3.05, 0.055, 10, 80),
          '#7eebff',
          [0, 0.16, 0.2],
          [Math.PI / 2, 0, 0],
          [1, 0.77, 1],
          { emissive: '#2dbbd2' },
        );

        for (const side of [-1, 1]) {
          addMesh(
            `walkway-${side}`,
            new THREE.BoxGeometry(3.8, 0.12, 1.55),
            '#304b60',
            [side * 4.3, 0.04, 0.15],
            [0, side * -0.11, 0],
            [1, 1, 1],
            { roughness: 0.9 },
          );
          addMesh(
            `board-support-${side}`,
            new THREE.BoxGeometry(3.4, 2.25, 0.26),
            '#203548',
            [side * 4.2, 1.52, -1.35],
            [0, side * -0.13, 0],
            [1, 1, 1],
            { roughness: 0.84 },
          );
          addMesh(
            `board-trim-${side}`,
            new THREE.BoxGeometry(3.55, 0.06, 0.08),
            side < 0 ? '#ff8d7a' : '#7eebff',
            [side * 4.2, 2.66, -1.18],
            [0, side * -0.13, 0],
            [1, 1, 1],
            { emissive: side < 0 ? '#7a2e2b' : '#167c98' },
          );
        }

        const portalMaterial = new THREE.MeshStandardMaterial({
          color: '#7eebff',
          emissive: '#279dbb',
          emissiveIntensity: 1.7,
          roughness: 0.28,
        });
        const portal = new THREE.Mesh(new THREE.TorusGeometry(2.28, 0.13, 12, 72), portalMaterial);
        portal.name = 'clubhouse-portal';
        portal.position.set(0, 2.4, -3.25);
        world.add(portal);
        addMesh(
          'portal-core',
          new THREE.CircleGeometry(2.05, 64),
          '#4056d8',
          [0, 2.4, -3.3],
          [0, 0, 0],
          [1, 1, 1],
          { emissive: '#20329a', opacity: 0.34 },
        );

        const addCrystalCluster = (x: number, z: number, color: string) => {
          for (let index = 0; index < 3; index++) {
            const offset = (index - 1) * 0.28;
            addMesh(
              `crystal-${x}-${index}`,
              new THREE.ConeGeometry(0.22, 1.25, 6),
              color,
              [x + offset, 0.53 + index * 0.09, z - Math.abs(offset) * 0.4],
              [0.03 * index, 0, -offset * 0.25],
              [1 - index * 0.1, 0.85 + index * 0.15, 1 - index * 0.1],
              { emissive: color === '#7eebff' ? '#1b7891' : '#762d38' },
            );
          }
        };
        addCrystalCluster(-6.25, -0.2, '#ff8d7a');
        addCrystalCluster(6.25, -0.2, '#7eebff');
        addCrystalCluster(-4.85, -3.35, '#7eebff');
        addCrystalCluster(4.85, -3.35, '#ff8d7a');

        const snowPositions = new Float32Array(180 * 3);
        for (let index = 0; index < 180; index++) {
          const angle = index * 2.399963;
          const radius = 2.5 + ((index * 37) % 100) / 9;
          snowPositions[index * 3] = Math.cos(angle) * radius;
          snowPositions[index * 3 + 1] = 0.7 + ((index * 53) % 90) / 12;
          snowPositions[index * 3 + 2] = Math.sin(angle) * radius - 1.5;
        }
        const snowGeometry = new THREE.BufferGeometry();
        snowGeometry.setAttribute('position', new THREE.BufferAttribute(snowPositions, 3));
        const snow = new THREE.Points(
          snowGeometry,
          new THREE.PointsMaterial({
            color: '#dff8ff',
            size: 0.055,
            transparent: true,
            opacity: 0.52,
          }),
        );
        snow.name = 'snow-drift';
        world.add(snow);

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

        const hero = factory.instantiate('#48cfe3', 'Wave');
        hero.root.position.set(0, 0.18, 0.55);
        hero.root.rotation.y = THREE.MathUtils.degToRad(-8);
        hero.root.scale.multiplyScalar(1.34);
        world.add(hero.root);

        const iceFriend = factory.instantiate('#7eebff', 'Idle');
        iceFriend.root.position.set(-2.55, 0.08, -2.05);
        iceFriend.root.rotation.y = THREE.MathUtils.degToRad(24);
        iceFriend.root.scale.multiplyScalar(0.78);
        world.add(iceFriend.root);

        const waterFriend = factory.instantiate('#79d49a', 'Idle');
        waterFriend.root.position.set(2.45, 0.08, -2.2);
        waterFriend.root.rotation.y = THREE.MathUtils.degToRad(-18);
        waterFriend.root.scale.multiplyScalar(0.74);
        world.add(waterFriend.root);

        const hasReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        let animationFrame = 0;
        let previousTime = performance.now();
        const render = (time: number) => {
          const delta = Math.min(0.05, (time - previousTime) / 1000);
          previousTime = time;
          if (!hasReducedMotion) {
            hero.update(delta);
            iceFriend.update(delta);
            waterFriend.update(delta);
            portal.rotation.z = time * 0.00008;
            portalMaterial.emissiveIntensity = 1.55 + Math.sin(time * 0.0012) * 0.22;
            snow.rotation.y = time * 0.000018;
            camera.position.x = Math.sin(time * 0.00007) * 0.14;
            camera.lookAt(0, 1.25, -0.35);
          }
          renderer.render(scene, camera);
          animationFrame = requestAnimationFrame(render);
        };
        animationFrame = requestAnimationFrame(render);

        destroy = () => {
          cancelAnimationFrame(animationFrame);
          observer.disconnect();
          scene.traverse((object) => {
            if (!(object instanceof THREE.Mesh) && !(object instanceof THREE.Points)) return;
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
    <div className="lobby-world" aria-hidden="true">
      {hasGraphics ? (
        <canvas ref={canvasRef} />
      ) : (
        <div className="lobby-world-fallback">Ice Ice Water!</div>
      )}
    </div>
  );
}
