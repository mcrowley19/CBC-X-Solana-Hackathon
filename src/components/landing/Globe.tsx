"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { buildLandMask, type LandMask } from "./land-mask";

/*
 * The GoMile globe: a black planet drawn only in white. Continents are a field of dim dots,
 * the limb is a hair of light, and across the land thousands of cars drive at night with their
 * headlights on. No colour anywhere; the headlights are the brightest thing on the page.
 */

const RADIUS = 1;
const CAR_COUNT = 600;
const LAND_DOT_SAMPLES = 48000;
const SEPARATION = 0.045; // minimum spacing between cars, as a chord on the unit sphere
const LOOKAHEAD = 0.006; // radians ahead of a car that must still be land before it drives on
const ROTATION_SPEED = 0.06; // radians per second, about 100 s per revolution

const RAD = 180 / Math.PI;

function landAt(mask: LandMask, p: THREE.Vector3): boolean {
  const lat = Math.asin(Math.max(-1, Math.min(1, p.y))) * RAD;
  const lon = Math.atan2(-p.z, p.x) * RAD;
  return mask.isLand(lat, lon);
}

function randomLandPoint(mask: LandMask, out: THREE.Vector3): THREE.Vector3 {
  for (;;) {
    const y = Math.random() * 2 - 1;
    const theta = Math.random() * Math.PI * 2;
    const r = Math.sqrt(1 - y * y);
    out.set(r * Math.cos(theta), y, r * Math.sin(theta));
    // Nobody drives across Antarctica.
    if (y > -0.85 && landAt(mask, out)) return out;
  }
}

/**
 * Car sprite: the top-down car photo in public/car-top.png (nose up), with a headlight beam
 * painted on above it. The photo has a transparent background, and the sprite is blended
 * additively, so only the car and its lights add to the black globe.
 */
const CAR_IMAGE = "/car-top.png";
const CAR_TEXTURE_W = 256;
const CAR_TEXTURE_H = 512;
const CAR_NOSE = 0.55; // fraction of the texture height where the bonnet's leading edge sits
const CAR_TAIL = 0.8; // fraction where the rear bumper sits
const CAR_CENTRE_V = 1 - (CAR_NOSE + CAR_TAIL) / 2; // car centre, measured from the bottom edge

function makeCarTexture(): THREE.CanvasTexture {
  const W = CAR_TEXTURE_W;
  const H = CAR_TEXTURE_H;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.anisotropy = 4;

  const img = new Image();
  img.src = CAR_IMAGE;
  img
    .decode()
    .then(() => {
      const ctx = canvas.getContext("2d")!;
      ctx.clearRect(0, 0, W, H);

      const noseY = H * CAR_NOSE;
      const tailY = H * CAR_TAIL;
      const carH = tailY - noseY;
      const carW = carH * (img.naturalWidth / img.naturalHeight);
      const left = (W - carW) / 2;

      // Beam: a cone from the headlights (the bonnet's front corners) to the top edge, fading out.
      const beam = ctx.createLinearGradient(0, noseY, 0, 0);
      beam.addColorStop(0, "rgba(255,255,255,0.32)");
      beam.addColorStop(0.3, "rgba(255,255,255,0.08)");
      beam.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = beam;
      ctx.beginPath();
      ctx.moveTo(left + carW * 0.08, noseY + carH * 0.04);
      ctx.lineTo(left + carW * 0.92, noseY + carH * 0.04);
      ctx.lineTo(W * 0.92, 0);
      ctx.lineTo(W * 0.08, 0);
      ctx.closePath();
      ctx.fill();

      // The photo is mid-grey; lift it so the body reads against black at a few pixels wide.
      ctx.filter = "brightness(1.35)";
      ctx.drawImage(img, left, noseY, carW, carH);
      ctx.filter = "none";

      // Headlights: hot cores over the lamps in the photo.
      for (const x of [left + carW * 0.13, left + carW * 0.87]) {
        const y = noseY + carH * 0.07;
        const r = carW * 0.34;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, "rgba(255,255,255,1)");
        g.addColorStop(0.25, "rgba(255,255,255,0.85)");
        g.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }

      texture.needsUpdate = true;
    })
    .catch(() => {
      /* no image: cars stay invisible rather than breaking the page */
    });

  return texture;
}

const LAND_DOT_SHADER = {
  vertex: /* glsl */ `
    uniform float uSize;
    varying float vFacing;
    void main() {
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vec3 n = normalize(normalMatrix * position);
      vFacing = max(0.0, dot(n, normalize(-mv.xyz)));
      gl_Position = projectionMatrix * mv;
      gl_PointSize = uSize / -mv.z;
    }
  `,
  fragment: /* glsl */ `
    uniform float uOpacity;
    varying float vFacing;
    void main() {
      float d = length(gl_PointCoord - 0.5);
      float disc = 1.0 - smoothstep(0.35, 0.5, d);
      float fade = smoothstep(0.0, 0.45, vFacing);
      gl_FragColor = vec4(1.0, 1.0, 1.0, disc * fade * uOpacity);
    }
  `,
};

const BODY_SHADER = {
  vertex: /* glsl */ `
    varying vec3 vNormal;
    varying vec3 vView;
    void main() {
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vNormal = normalize(normalMatrix * normal);
      vView = normalize(-mv.xyz);
      gl_Position = projectionMatrix * mv;
    }
  `,
  fragment: /* glsl */ `
    varying vec3 vNormal;
    varying vec3 vView;
    void main() {
      float facing = max(0.0, dot(vNormal, vView));
      float rim = pow(1.0 - facing, 5.0);
      vec3 base = vec3(0.02);
      vec3 col = base + vec3(1.0) * rim * 0.22;
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

interface Car {
  p: THREE.Vector3; // unit position
  h: THREE.Vector3; // unit heading, tangent to the sphere at p
  speed: number; // radians per second
  size: number;
}

function buildCars(mask: LandMask): Car[] {
  const cars: Car[] = [];
  const tmp = new THREE.Vector3();
  const sep2 = SEPARATION * SEPARATION;
  for (let i = 0; i < CAR_COUNT; i++) {
    // Spawn clear of every car already placed; give up on spacing after enough tries.
    let p = randomLandPoint(mask, new THREE.Vector3());
    for (let attempt = 0; attempt < 40; attempt++) {
      if (cars.every((other) => other.p.distanceToSquared(p) >= sep2)) break;
      p = randomLandPoint(mask, p);
    }
    // Random tangent: project a random vector onto the tangent plane.
    tmp.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5);
    const h = tmp.clone().addScaledVector(p, -tmp.dot(p)).normalize();
    cars.push({ p, h, speed: 0.0025 + Math.random() * 0.005, size: 0.85 + Math.random() * 0.3 });
  }
  return cars;
}

export function Globe({ className }: { className?: string }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    } catch {
      return; // no WebGL: the page still works, just without the globe
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    host.appendChild(renderer.domElement);

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 20);
    camera.position.set(0, 0.5, 3.9);
    camera.lookAt(0, 0, 0);

    // Axial tilt on the outer pivot, spin on the inner group.
    const pivot = new THREE.Group();
    pivot.rotation.z = -0.35;
    pivot.rotation.x = 0.12;
    const globe = new THREE.Group();
    globe.rotation.y = -1.2; // start over the Atlantic, so both Americas and Europe/Africa are lit
    pivot.add(globe);
    scene.add(pivot);

    // Body
    const bodyGeometry = new THREE.SphereGeometry(RADIUS, 96, 96);
    const bodyMaterial = new THREE.ShaderMaterial({
      vertexShader: BODY_SHADER.vertex,
      fragmentShader: BODY_SHADER.fragment,
    });
    globe.add(new THREE.Mesh(bodyGeometry, bodyMaterial));

    const mask = buildLandMask();

    // Continents as dots: a Fibonacci lattice, keeping the points that land on land.
    const dotPositions: number[] = [];
    const golden = Math.PI * (3 - Math.sqrt(5));
    const v = new THREE.Vector3();
    for (let i = 0; i < LAND_DOT_SAMPLES; i++) {
      const y = 1 - (i / (LAND_DOT_SAMPLES - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const theta = golden * i;
      v.set(Math.cos(theta) * r, y, Math.sin(theta) * r);
      if (landAt(mask, v)) dotPositions.push(v.x * 1.002, v.y * 1.002, v.z * 1.002);
    }
    const dotGeometry = new THREE.BufferGeometry();
    dotGeometry.setAttribute("position", new THREE.Float32BufferAttribute(dotPositions, 3));
    const dotMaterial = new THREE.ShaderMaterial({
      vertexShader: LAND_DOT_SHADER.vertex,
      fragmentShader: LAND_DOT_SHADER.fragment,
      uniforms: { uSize: { value: 5.5 * renderer.getPixelRatio() }, uOpacity: { value: 0.32 } },
      transparent: true,
      depthWrite: false,
    });
    globe.add(new THREE.Points(dotGeometry, dotMaterial));

    // Cars: one instanced quad per car, tangent to the surface, headlights pointing along its heading.
    const cars = buildCars(mask);
    const carLength = 0.05;
    const carGeometry = new THREE.PlaneGeometry(carLength * (CAR_TEXTURE_W / CAR_TEXTURE_H), carLength);
    carGeometry.translate(0, (0.5 - CAR_CENTRE_V) * carLength, 0); // the car body sits on its position; the beam is thrown forward
    const carMaterial = new THREE.MeshBasicMaterial({
      map: makeCarTexture(),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const carMesh = new THREE.InstancedMesh(carGeometry, carMaterial, CAR_COUNT);
    carMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    carMesh.frustumCulled = false;
    globe.add(carMesh);

    const m = new THREE.Matrix4();
    const right = new THREE.Vector3();
    const fwd = new THREE.Vector3();
    const up = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const trial = new THREE.Vector3();

    let carScale = 1; // grows as the camera backs off, so headlights stay visible on phones
    const placeCars = () => {
      for (let i = 0; i < cars.length; i++) {
        const c = cars[i];
        const s = c.size * carScale;
        up.copy(c.p);
        fwd.copy(c.h);
        right.crossVectors(fwd, up);
        m.makeBasis(right.multiplyScalar(s), fwd.multiplyScalar(s), up);
        m.setPosition(c.p.x * 1.004, c.p.y * 1.004, c.p.z * 1.004);
        carMesh.setMatrixAt(i, m);
      }
      carMesh.instanceMatrix.needsUpdate = true;
    };

    /**
     * Cars keep their distance: any pair closer than SEPARATION is pushed apart along the
     * surface (only onto land) and each steers away from the other, so they don't just collide again.
     */
    const away = new THREE.Vector3();
    const sep2 = SEPARATION * SEPARATION;
    const separateCars = (dt: number) => {
      for (let i = 0; i < cars.length; i++) {
        const a = cars[i];
        for (let j = i + 1; j < cars.length; j++) {
          const b = cars[j];
          const d2 = a.p.distanceToSquared(b.p);
          if (d2 >= sep2 || d2 === 0) continue;
          const dist = Math.sqrt(d2);
          away.subVectors(a.p, b.p).divideScalar(dist);
          const push = (SEPARATION - dist) * 0.5 * Math.min(1, 4 * dt);
          trial.copy(a.p).addScaledVector(away, push).normalize();
          if (landAt(mask, trial)) a.p.copy(trial);
          trial.copy(b.p).addScaledVector(away, -push).normalize();
          if (landAt(mask, trial)) b.p.copy(trial);
          const steer = 2.5 * dt;
          a.h.addScaledVector(away, steer);
          b.h.addScaledVector(away, -steer);
        }
      }
    };

    const driveCars = (dt: number) => {
      for (const c of cars) {
        // Gentle wander so routes curve like roads rather than great circles.
        q.setFromAxisAngle(c.p, (Math.random() - 0.5) * 0.3 * dt);
        c.h.applyQuaternion(q);

        trial.copy(c.p).addScaledVector(c.h, LOOKAHEAD).normalize();
        if (landAt(mask, trial)) {
          c.p.addScaledVector(c.h, c.speed * dt).normalize();
        } else {
          // Coastline ahead: turn until there is road again, otherwise turn back.
          let turned = false;
          for (let attempt = 0; attempt < 6 && !turned; attempt++) {
            const angle = (attempt + 1) * 0.6 * (Math.random() < 0.5 ? 1 : -1);
            q.setFromAxisAngle(c.p, angle);
            fwd.copy(c.h).applyQuaternion(q);
            trial.copy(c.p).addScaledVector(fwd, LOOKAHEAD).normalize();
            if (landAt(mask, trial)) {
              c.h.copy(fwd);
              c.p.addScaledVector(c.h, c.speed * dt).normalize();
              turned = true;
            }
          }
          if (!turned) c.h.negate();
        }
      }
      separateCars(dt);
      // Keep every heading tangent after moving and jostling.
      for (const c of cars) c.h.addScaledVector(c.p, -c.h.dot(c.p)).normalize();
    };

    placeCars();

    const resize = () => {
      const { clientWidth: w, clientHeight: h } = host;
      if (w === 0 || h === 0) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      // Back the camera off until the whole globe fits across the viewport with a margin, so a
      // phone shows the planet rather than a slice of it.
      const halfH = Math.tan((camera.fov / 2) * (Math.PI / 180));
      const halfW = Math.atan(halfH * camera.aspect);
      const distance = Math.max(3.9, 1 / Math.sin(0.78 * halfW));
      camera.position.set(0, 0.13 * distance, distance);
      camera.lookAt(0, 0, 0);
      carScale = Math.min(1.8, distance / 3.9);
      // Wide screens: sit the globe right of centre so the headline has clear black beneath it.
      // Tall screens: lift it so it sits above the copy.
      const wide = camera.aspect > 1.2;
      pivot.position.set(wide ? 0.14 * distance : 0, wide ? 0 : 0.06 * distance, 0);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(host);

    // The page scrolls on past the globe; once it is out of view, stop drawing until it comes back.
    let raf = 0;
    let visible = true;
    let last = performance.now();
    const tick = (now: number) => {
      if (!visible) {
        raf = 0;
        return;
      }
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!reduceMotion) globe.rotation.y += ROTATION_SPEED * dt;
      driveCars(reduceMotion ? dt * 0.4 : dt);
      placeCars();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    const visibility = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && raf === 0) {
        last = performance.now();
        raf = requestAnimationFrame(tick);
      }
    });
    visibility.observe(host);
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      visibility.disconnect();
      observer.disconnect();
      bodyGeometry.dispose();
      bodyMaterial.dispose();
      dotGeometry.dispose();
      dotMaterial.dispose();
      carGeometry.dispose();
      carMaterial.map?.dispose();
      carMaterial.dispose();
      renderer.dispose();
      host.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={hostRef} className={className} aria-hidden="true" />;
}
