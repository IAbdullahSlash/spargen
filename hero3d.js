import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

// keep in sync with --bg in styles.css (dark and light)
const BG = { dark: new THREE.Color("#06070b"), light: new THREE.Color("#f6f5f1") };
const INK = new THREE.Color("#12141c");
const WHITE = new THREE.Color("#ffffff");

/* ======================================================================
   Floating panels: glass dashboard cards — ERP chart, CRM list,
   custom-app trend line and ops donut — drifting in 3D
   ====================================================================== */
// ERP, CRM, Custom, Ops — glowing tones for night, deeper tones for day
const SYS = {
  dark: ["#8b7bff", "#38d9f5", "#ff6a2b", "#b6f36a"].map((c) => new THREE.Color(c)),
  light: ["#6b5cf0", "#0e9fbf", "#f2551a", "#5f9e1f"].map((c) => new THREE.Color(c)),
};

function roundedRect(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

function buildPanels(rig) {
  const deck = new THREE.Group();
  rig.add(deck);
  const PW = 2.3, PH = 1.5;
  const shape = roundedRect(PW, PH, 0.14);
  const fillGeo = new THREE.ShapeGeometry(shape, 10);
  const outline = new THREE.BufferGeometry().setFromPoints(shape.getPoints(64).map((p) => new THREE.Vector3(p.x, p.y, 0)));

  // every material carries a night style (additive glow) and a day style (solid ink)
  const themed = [];
  let light = false;
  const mat = (Kind, dark, day) => {
    const m = new Kind({ transparent: true, depthWrite: false });
    themed.push({ m, dark: { add: true, opacity: 1, ...dark }, day: { opacity: 1, ...day } });
    return m;
  };
  const plane = (w, h, dark, day) => new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat(THREE.MeshBasicMaterial, dark, day));

  const slots = [[-1.25, 0.95, 0.2], [1.15, 0.7, -0.5], [-0.95, -0.85, -0.3], [1.35, -1.0, 0.35]]; // ERP, CRM, Custom, Ops
  const anim = [];
  const cards = slots.map((slot, i) => {
    const col = SYS.dark[i], deep = SYS.light[i];
    const c = new THREE.Group();
    const face = new THREE.Mesh(fillGeo, mat(THREE.MeshBasicMaterial,
      { color: col.clone().multiplyScalar(0.07).add(new THREE.Color(0x0c0e16)), opacity: 0.9, add: false },
      { color: WHITE.clone().lerp(deep, 0.06), opacity: 0.95 }));
    c.add(face);
    c.add(new THREE.LineLoop(outline, mat(THREE.LineBasicMaterial, { color: col, opacity: 0.7 }, { color: deep, opacity: 0.9 })));
    const head = plane(0.7, 0.07, { color: WHITE, opacity: 0.25 }, { color: INK, opacity: 0.14 });
    head.position.set(-PW / 2 + 0.5, PH / 2 - 0.2, 0.01);
    c.add(head);
    for (let d = 0; d < 3; d++) {
      const dot = new THREE.Mesh(new THREE.CircleGeometry(0.03, 12), mat(THREE.MeshBasicMaterial,
        { color: d ? new THREE.Color(0x3a4058) : col, add: false }, { color: d ? new THREE.Color(0xd3d6df) : deep }));
      dot.position.set(PW / 2 - 0.2 - d * 0.1, PH / 2 - 0.2, 0.01);
      c.add(dot);
    }

    if (i === 0) { // ERP: bar chart
      const bars = [];
      for (let b = 0; b < 8; b++) {
        const m = plane(0.16, 1, { color: col, opacity: 0.75 }, { color: deep, opacity: 0.85 });
        m.geometry.translate(0, 0.5, 0);
        m.position.set(-0.85 + b * 0.24, -PH / 2 + 0.18, 0.01);
        c.add(m);
        bars.push(m);
      }
      anim.push((t) => bars.forEach((m, b) => (m.scale.y = 0.25 + 0.65 * (0.5 + 0.5 * Math.sin(t * 1.3 + b * 0.7)))));
    } else if (i === 1) { // CRM: pipeline rows, one highlighted at a time
      const rows = [];
      for (let r = 0; r < 4; r++) {
        const m = plane(1.85, 0.16, { color: col }, { color: deep });
        m.position.set(0, 0.28 - r * 0.24, 0.01);
        c.add(m);
        rows.push(m);
        const tag = plane(0.32, 0.08, { color: col, opacity: 0.6 }, { color: deep, opacity: 0.8 });
        tag.position.set(0.68, 0.28 - r * 0.24, 0.02);
        c.add(tag);
      }
      anim.push((t) => {
        const a = Math.floor(t / 0.9) % 4;
        const [hi, lo] = light ? [0.2, 0.07] : [0.35, 0.1];
        rows.forEach((m, r) => (m.material.opacity = r === a ? hi : lo));
      });
    } else if (i === 2) { // Custom: live trend line
      const N = 40, pts = new Float32Array(N * 3);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(pts, 3));
      c.add(new THREE.Line(geo, mat(THREE.LineBasicMaterial, { color: col.clone().multiplyScalar(1.6), add: false }, { color: deep })));
      anim.push((t) => {
        for (let k = 0; k < N; k++) {
          const x = -0.95 + (k / (N - 1)) * 1.9;
          pts.set([x, -0.35 + (k / N) * 0.6 + 0.16 * Math.sin(k * 0.55 + t * 1.6), 0.02], k * 3);
        }
        geo.attributes.position.needsUpdate = true;
      });
    } else { // Ops: donut + stat rows
      const donut = new THREE.Group();
      donut.position.set(-0.5, -0.12, 0.01);
      c.add(donut);
      let a0 = 0;
      [0.45, 0.3, 0.25].forEach((f, s) => {
        donut.add(new THREE.Mesh(new THREE.RingGeometry(0.3, 0.44, 48, 1, a0 * Math.PI * 2, f * Math.PI * 2 - 0.06), mat(THREE.MeshBasicMaterial,
          { color: col.clone().multiplyScalar(1.3 - s * 0.35), add: false },
          { color: deep.clone().lerp(WHITE, s * 0.3) })));
        a0 += f;
      });
      for (let r = 0; r < 3; r++) {
        const m = plane(0.8 - r * 0.15, 0.07, { color: WHITE, opacity: 0.2 }, { color: INK, opacity: 0.14 });
        m.position.set(0.55, 0.1 - r * 0.2, 0.01);
        c.add(m);
      }
      anim.push((t) => (donut.rotation.z = -t * 0.4));
    }
    const anchor = new THREE.Object3D();
    anchor.position.set(PW / 2, PH / 2, 0);
    c.add(anchor);
    // draw back-to-front: each card's face first, then its contents on top
    const depth = [...slots].sort((a, b) => a[2] - b[2]).indexOf(slot);
    c.traverse((o) => (o.renderOrder = depth * 2 + 1));
    face.renderOrder = depth * 2;
    deck.add(c);
    return { c, anchor, base: slot, ph: i * 1.7 };
  });

  return {
    scale: 0.8,
    bloom: [0.35, 0.35, 0.3],
    labelAnchors: cards.map((c) => c.anchor),
    setTheme(isLight) {
      light = isLight;
      themed.forEach(({ m, dark, day }) => {
        const s = isLight ? day : dark;
        m.color.copy(s.color);
        m.opacity = s.opacity;
        m.blending = s.add ? THREE.AdditiveBlending : THREE.NormalBlending;
        m.needsUpdate = true;
      });
    },
    update(t, dt, mouse, scroll, intro) {
      deck.rotation.y = -0.38 + mouse.x * 0.2;
      deck.rotation.x = 0.1 + mouse.y * 0.08;
      const spread = 1 + (1 - intro) * 0.6 + scroll * 0.5;
      cards.forEach(({ c, base, ph }, i) => {
        c.position.set(base[0] * spread, base[1] * spread + Math.sin(t * 0.8 + ph) * 0.06, base[2] + (i % 2 ? -1 : 1) * scroll * 0.6);
      });
      anim.forEach((f) => f(t));
    },
  };
}

/* ====================================================================== */
export function initHero(canvas, labelEls) {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hero = canvas.parentElement;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));

  const scene = new THREE.Scene();
  scene.background = BG.dark.clone();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(0, 0, 11);

  const world = new THREE.Group();
  const rig = new THREE.Group();
  world.add(rig);
  scene.add(world);

  const v = buildPanels(rig);

  /* quiet starfield (dust motes by day) */
  const DUST = innerWidth < 700 ? 500 : 1100;
  const dustPos = new Float32Array(DUST * 3);
  const dustSize = new Float32Array(DUST);
  for (let i = 0; i < DUST; i++) {
    const r = 7 + Math.random() * 20;
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    dustPos.set([r * Math.sin(ph) * Math.cos(th), r * Math.sin(ph) * Math.sin(th) * 0.6, r * Math.cos(ph) - 6], i * 3);
    dustSize[i] = Math.random() * 1.2 + 0.4;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
  dustGeo.setAttribute("aSize", new THREE.BufferAttribute(dustSize, 1));
  const dustMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uPR: { value: renderer.getPixelRatio() }, uColor: { value: new THREE.Color(0.85, 0.87, 1.0) }, uAlpha: { value: 0.35 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute float aSize; uniform float uTime; uniform float uPR; varying float vA;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vA = 0.6 + 0.4 * sin(uTime * 1.2 + position.x * 3.0 + position.y * 2.0);
        gl_PointSize = aSize * uPR * (18.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uAlpha; varying float vA;
      void main(){
        float a = smoothstep(0.5, 0.0, length(gl_PointCoord - 0.5));
        gl_FragColor = vec4(uColor, a * vA * uAlpha);
      }`,
  });
  const dust = new THREE.Points(dustGeo, dustMat);
  scene.add(dust);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), ...v.bloom);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  /* theme: follow <html data-theme>, switched by the nav toggle */
  function applyTheme() {
    const isLight = document.documentElement.dataset.theme === "light";
    scene.background.copy(isLight ? BG.light : BG.dark);
    bloom.enabled = !isLight; // glow washes out on a light background
    dustMat.blending = isLight ? THREE.NormalBlending : THREE.AdditiveBlending;
    dustMat.uniforms.uColor.value.set(isLight ? 0x6a7088 : 0xd9deff);
    dustMat.uniforms.uAlpha.value = isLight ? 0.3 : 0.35;
    dustMat.needsUpdate = true;
    v.setTheme(isLight);
  }
  applyTheme();
  new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  /* layout: keep the visual in the right-hand area, clear of the headline */
  let W = 1, H = 1;
  function resize() {
    W = hero.clientWidth; H = hero.clientHeight;
    renderer.setSize(W, H, false);
    composer.setSize(W, H);
    bloom.resolution.set(W, H);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    const wide = W > 980;
    camera.position.z = wide ? 11 : 13;
    const halfW = Math.tan(THREE.MathUtils.degToRad(21)) * camera.position.z * camera.aspect;
    const contentRight = Math.min(W, 1248) / 2 / (W / 2) * halfW; // edge of the 1200px column
    world.position.set(wide ? contentRight * 0.62 : 0, wide ? 0.1 : -1.4, 0);
    world.scale.setScalar(wide ? 1 : W < 600 ? 0.6 : 0.78);
  }
  resize();
  addEventListener("resize", resize);

  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  addEventListener("pointermove", (e) => {
    mouse.tx = (e.clientX / innerWidth) * 2 - 1;
    mouse.ty = (e.clientY / innerHeight) * 2 - 1;
  }, { passive: true });

  let visible = true;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(hero);

  const tmp = new THREE.Vector3();
  const clock = new THREE.Clock();
  const speedMul = reduce ? 0.15 : 1;
  let t = 0, intro = 0;

  function frame() {
    requestAnimationFrame(frame);
    if (!visible || document.hidden) { clock.getDelta(); return; }
    const dt = Math.min(clock.getDelta(), 0.05) * speedMul;
    t += dt;
    intro = Math.min(intro + dt * 0.6, 1);
    const ease = 1 - Math.pow(1 - intro, 3);

    mouse.x += (mouse.tx - mouse.x) * 0.04;
    mouse.y += (mouse.ty - mouse.y) * 0.04;
    const scroll = Math.min(scrollY / H, 1.2);

    rig.scale.setScalar(v.scale * (0.85 + 0.15 * ease));
    v.update(t, dt, mouse, scroll, ease);
    dustMat.uniforms.uTime.value = t;
    dust.rotation.y = t * 0.01 + mouse.x * 0.04;

    camera.position.x = mouse.x * 0.3;
    camera.position.y = -mouse.y * 0.2 - scroll * 1.2;
    camera.lookAt(0, -scroll * 1.0, 0);

    v.labelAnchors.forEach((anchor, i) => {
      const el = labelEls[i];
      if (!el || !anchor) return;
      anchor.getWorldPosition(tmp).project(camera);
      const x = (tmp.x * 0.5 + 0.5) * W;
      const y = (-tmp.y * 0.5 + 0.5) * H;
      el.style.transform = `translate(${Math.min(x + 14, W - el.offsetWidth - 16)}px, ${y - 12}px)`;
      el.style.opacity = tmp.z < 1 && intro > 0.5 ? String(Math.max(0, 1 - scroll * 1.6)) : "0";
    });

    composer.render();
  }
  frame();
  labelEls.forEach((el) => el.classList.add("ready"));
}
