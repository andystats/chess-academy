import { useEffect, useRef } from 'react';
import * as THREE from 'three';

function makeKing() {
  const group = new THREE.Group();

  const material = new THREE.MeshStandardMaterial({
    color: '#101114',
    roughness: 0.42,
    metalness: 0.18,
  });
  const edgeMaterial = new THREE.MeshStandardMaterial({
    color: '#e07020',
    roughness: 0.36,
    metalness: 0.3,
  });

  const profile = [
    [0.0, -2.1],
    [0.92, -2.1],
    [1.08, -1.9],
    [0.72, -1.7],
    [0.66, -1.15],
    [0.5, -0.85],
    [0.6, -0.48],
    [0.46, -0.25],
    [0.34, 0.55],
    [0.52, 0.8],
    [0.38, 1.02],
    [0.28, 1.28],
    [0.0, 1.28],
  ].map(([x, y]) => new THREE.Vector2(x, y));

  const body = new THREE.Mesh(new THREE.LatheGeometry(profile, 96), material);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const baseRing = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.045, 14, 96), edgeMaterial);
  baseRing.rotation.x = Math.PI / 2;
  baseRing.position.y = -1.86;
  group.add(baseRing);

  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.04, 14, 96), edgeMaterial);
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 0.82;
  group.add(collar);

  const crossStem = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.62, 0.15), material);
  crossStem.position.y = 1.64;
  crossStem.castShadow = true;
  group.add(crossStem);

  const crossArm = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.13, 0.15), material);
  crossArm.position.y = 1.76;
  crossArm.castShadow = true;
  group.add(crossArm);

  const crownGlow = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.025, 12, 72), edgeMaterial);
  crownGlow.rotation.x = Math.PI / 2;
  crownGlow.position.y = 1.34;
  group.add(crownGlow);

  return group;
}

export default function StylizedKingScene({ className = 'h-[18rem] w-full md:h-[24rem] lg:h-[26rem]' }) {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    camera.position.set(0, 0.2, 8.4);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.width = '100%';
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    const king = makeKing();
    king.rotation.x = -0.08;
    scene.add(king);

    const key = new THREE.DirectionalLight('#ffffff', 3.1);
    key.position.set(3, 4, 5);
    key.castShadow = true;
    scene.add(key);

    const fill = new THREE.DirectionalLight('#38c6ff', 1.4);
    fill.position.set(-4, 2, 3);
    scene.add(fill);

    const rim = new THREE.DirectionalLight('#5bfdb2', 1.1);
    rim.position.set(0, 3, -4);
    scene.add(rim);

    scene.add(new THREE.AmbientLight('#ffffff', 1.4));

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(2.35, 96),
      new THREE.ShadowMaterial({ color: '#0a0a0a', opacity: 0.14 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -2.15;
    floor.receiveShadow = true;
    scene.add(floor);

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame = 0;
    let disposed = false;

    const resize = () => {
      const rect = mount.getBoundingClientRect();
      const width = Math.max(1, rect.width);
      const height = Math.max(1, rect.height);
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    const animate = () => {
      if (disposed) return;
      if (!reduceMotion) {
        king.rotation.y += 0.006;
        king.position.y = Math.sin(performance.now() * 0.0012) * 0.035;
      }
      renderer.render(scene, camera);
      frame = window.requestAnimationFrame(animate);
    };

    resize();
    window.addEventListener('resize', resize);
    animate();

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      mount.removeChild(renderer.domElement);
      renderer.dispose();
      scene.traverse((object) => {
        if (!object.isMesh) return;
        object.geometry?.dispose();
        if (Array.isArray(object.material)) object.material.forEach((m) => m.dispose());
        else object.material?.dispose();
      });
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className={className}
      aria-label="Spinning stylized chess king"
      role="img"
    />
  );
}
