import * as THREE from 'three';
import type { Pack } from '../../shop/packs';

type Pose = { x: number; y: number; progress: number; side: number; lift: number; exit: number };

export function renderPack(canvas: HTMLCanvasElement, host: HTMLElement, pack: Pack, size: number, pose: Pose, reduced: () => boolean) {
  const opening = host.classList.contains('pack-art--interactive');
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, opening ? 1 : 1.5));
  renderer.setClearColor(0, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, .1, 30);
  camera.position.z = 7;
  const group = new THREE.Group();
  group.scale.y = 1.14;
  scene.add(group);
  const cards = new THREE.Group();
  cards.scale.y = group.scale.y;
  const cardPrint = document.createElement('canvas'); cardPrint.width = 256; cardPrint.height = 384;
  const cardInk = cardPrint.getContext('2d')!;
  cardInk.fillStyle = '#0c1016'; cardInk.fillRect(0, 0, 256, 384);
  cardInk.strokeStyle = '#edc56f'; cardInk.lineWidth = 2;
  cardInk.strokeRect(4, 4, 248, 376); cardInk.strokeRect(12, 12, 232, 360);
  cardInk.save(); cardInk.translate(128, 192); cardInk.rotate(Math.PI / 4);
  cardInk.strokeRect(-42, -42, 84, 84); cardInk.restore();
  const cardTexture = new THREE.CanvasTexture(cardPrint); cardTexture.colorSpace = THREE.SRGBColorSpace;
  const cardMaterial = new THREE.MeshBasicMaterial({ map: cardTexture });
  // Only the upper section is needed behind the wrapper; keep every lower
  // edge inside it even while the five cards are staggered.
  const cardGeometry = new THREE.PlaneGeometry(1.78, .7);
  for (let i = 0; i < cardGeometry.attributes.uv.count; i++) {
    cardGeometry.attributes.uv.setY(i, .74 + cardGeometry.attributes.uv.getY(i) * .26);
  }
  if (opening) {
    for (let i = 0; i < Math.min(5, size); i++) {
      const card = new THREE.Mesh(cardGeometry, cardMaterial);
      card.position.set((i - 2) * .045, .705 - i * .045, -.1 - i * .015);
      cards.add(card);
    }
    scene.add(cards);
  }

  // The existing pack metadata supplies the print, including future pack palettes.
  const print = document.createElement('canvas');
  print.width = 768; print.height = 1068;
  const ctx = print.getContext('2d')!;
  ctx.fillStyle = '#080c12'; ctx.fillRect(0, 0, 768, 1068);
  ctx.fillStyle = pack.color; ctx.globalAlpha = .08; ctx.fillRect(0, 0, 768, 1068); ctx.globalAlpha = 1;
  ctx.strokeStyle = pack.color; ctx.lineWidth = 3; ctx.strokeRect(3, 3, 762, 1062);
  ctx.fillStyle = pack.color;
  for (const y of [0, 964]) {
    const seal = ctx.createLinearGradient(0, y, 0, y + 104);
    seal.addColorStop(0, '#11151b'); seal.addColorStop(.3, pack.color);
    seal.addColorStop(.55, '#343940'); seal.addColorStop(1, '#090d12');
    ctx.fillStyle = seal; ctx.fillRect(0, y, 768, 104);
    ctx.globalAlpha = .18; ctx.fillStyle = '#ffffff';
    for (let x = 0; x < 768; x += 768 / 42) ctx.fillRect(x, y + 5, 1.5, 94);
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = pack.color;
  ctx.textAlign = 'center';
  ctx.font = '32px Orbitron'; ctx.fillText('PROJECT ENTITY', 384, 160);
  ctx.save(); ctx.translate(384, 455); ctx.scale(1, 1068 / (768 * 1.4 * 1.14)); ctx.rotate(Math.PI / 4);
  ctx.lineWidth = 6; ctx.strokeRect(-180, -180, 360, 360); ctx.restore();
  const icon = host.querySelector('.pack-art__sigil i')!;
  const glyph = getComputedStyle(icon, '::before').content.replace(/^["']|["']$/g, '');
  ctx.save(); ctx.translate(384, 455); ctx.scale(1, 1068 / (768 * 1.4 * 1.14));
  ctx.font = `900 230px ${getComputedStyle(icon).fontFamily}`;
  ctx.textBaseline = 'middle'; ctx.fillText(glyph, 0, 0); ctx.restore();
  ctx.fillStyle = '#fff2d6'; ctx.font = '900 69px Orbitron';
  const words = pack.name.toUpperCase().split(' ');
  const rows: string[] = [''];
  for (const word of words) {
    const last = rows.length - 1;
    if (ctx.measureText(`${rows[last]} ${word}`.trim()).width > 660 && rows[last]) rows.push(word);
    else rows[last] = `${rows[last]} ${word}`.trim();
  }
  const titleSize = Math.min(69, ...rows.map(line => 69 * 660 / Math.max(1, ctx.measureText(line).width)));
  ctx.font = `900 ${titleSize}px Orbitron`;
  rows.forEach((line, i) => ctx.fillText(line, 384, 815 + (i - (rows.length - 1) / 2) * 88));
  ctx.fillStyle = pack.color; ctx.font = '27px Orbitron'; ctx.fillText(`${size} CARDS / BASE EDITION`, 384, 936);
  const texture = new THREE.CanvasTexture(print);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());

  // Broad studio reflections make the foil follow the surface curvature.
  const studio = document.createElement('canvas'); studio.width = 512; studio.height = 256;
  const light = studio.getContext('2d')!;
  light.fillStyle = '#1c2431'; light.fillRect(0, 0, 512, 256);
  for (const [x, width, alpha] of [[80, 60, 1], [290, 110, .65], [450, 25, .85]]) {
    const g = light.createLinearGradient(x - width, 0, x + width, 0);
    g.addColorStop(0, 'transparent'); g.addColorStop(.5, `rgba(255,255,255,${alpha})`); g.addColorStop(1, 'transparent');
    light.fillStyle = g; light.fillRect(x - width, 0, width * 2, 200);
  }
  const env = new THREE.CanvasTexture(studio); env.mapping = THREE.EquirectangularReflectionMapping; env.colorSpace = THREE.SRGBColorSpace;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromEquirectangular(env);
  scene.environment = environment.texture;
  // Keep printed ink in its authored color; a separate, narrow reflection
  // supplies the laminate gloss instead of lighting the entire print gray.
  const material = new THREE.ShaderMaterial({
    uniforms: { ink: { value: texture }, tint: { value: new THREE.Color(pack.color.slice(0, 7)) } },
    vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vP;
      void main(){ vUv=uv; vec4 p=modelViewMatrix*vec4(position,1.); vP=p.xyz;
        vN=normalize(normalMatrix*normal); gl_Position=projectionMatrix*p; }`,
    fragmentShader: `uniform sampler2D ink; uniform vec3 tint;
      varying vec2 vUv; varying vec3 vN; varying vec3 vP;
      void main(){
        vec3 base=texture2D(ink,vUv).rgb;
        vec3 n=normalize(vN), v=normalize(-vP), r=reflect(-v,n);
        float sheen=pow(max(0.,1.-abs(r.x*.85+r.y*.35-.23)),65.);
        float edge=pow(1.-max(dot(n,v),0.),4.);
        float foil=smoothstep(.93,.99,max(vUv.y,1.-vUv.y)*2.-1.);
        vec3 film=.5+.5*cos(vec3(0.,2.1,4.2)+r.x*9.+r.y*5.+vUv.y*8.);
        vec3 gloss=mix(tint,vec3(1.),.25)*sheen*.42;
        vec3 color=base*(.9+.1*max(dot(n,v),0.))+gloss+film*edge*.15;
        color+=mix(tint,film,.25)*foil*sheen*.3;
        gl_FragColor=vec4(color,1.);
        #include <colorspace_fragment>
      }`, side: THREE.FrontSide,
  });
  const liner = new THREE.MeshStandardMaterial({ color: '#c5cbd2', metalness: .95, roughness: .24, side: THREE.BackSide });
  scene.add(new THREE.HemisphereLight(0xffffff, 0x303846, 1.1));
  const key = new THREE.DirectionalLight(0xffffff, 1.5); key.position.set(-3, 4, 5); scene.add(key);

  const body = new THREE.PlaneGeometry(2, 2.46, 144, 96);
  const strip = new THREE.PlaneGeometry(2, .34, 144, 16);
  const bodyBase = Float32Array.from(body.attributes.position.array);
  const stripBase = Float32Array.from(strip.attributes.position.array);
  const seam = (x: number) => .005 * Math.sin(x * 83) + .003 * Math.sin(x * 137);
  // Both pieces sample the same continuous surface while the pack is sealed.
  const surface = (x: number, y: number) => Math.pow(Math.max(0, 1 - x * x), .55) * Math.sin((y + 1.4) / 2.8 * Math.PI) * .16
    + .012 * Math.sin(x * 132) * THREE.MathUtils.smoothstep(Math.abs(y), 1.10, 1.22);
  const normal = new THREE.Vector3();
  const surfaceNormal = (x: number, y: number) => normal.set(
    -(surface(x + .001, y) - surface(x - .001, y)) / .002,
    -(surface(x, y + .001) - surface(x, y - .001)) / .002, 1).normalize();
  for (let i = 0; i < body.attributes.position.count; i++) {
    const x = bodyBase[i * 3], y = bodyBase[i * 3 + 1];
    const v = (y + 1.23) / 2.46;
    body.attributes.uv.setXY(i, (x + 1) / 2, v * (2.46 / 2.8));
    body.attributes.position.setXYZ(i, x, y - .17, surface(x, y - .17));
    const n = surfaceNormal(x, y - .17); body.attributes.normal.setXYZ(i, n.x, n.y, n.z);
  }
  for (let i = 0; i < strip.attributes.position.count; i++) {
    strip.attributes.uv.setXY(i, (stripBase[i * 3] + 1) / 2, (stripBase[i * 3 + 1] + .17) / 2.8 + 2.46 / 2.8);
  }
  for (const geometry of [body, strip]) {
    group.add(new THREE.Mesh(geometry, material), new THREE.Mesh(geometry, liner));
  }
  const flecks = new THREE.Group();
  const flakeGeometry = new THREE.PlaneGeometry(.025, .07);
  const flakeMaterial = new THREE.MeshBasicMaterial({ color: pack.color.slice(0, 7), side: THREE.DoubleSide, transparent: true });
  for (let i = 0; i < 16; i++) flecks.add(new THREE.Mesh(flakeGeometry, flakeMaterial));
  scene.add(flecks); flecks.visible = false;
  let frame = 0, visible = true, width = 0, height = 0, lastProgress = -1, lastLift = -1, lastSide = 0, dirty = true, lastTime = performance.now();
  const observer = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; }); observer.observe(host);
  const resize = new ResizeObserver(() => {
    width = host.clientWidth; height = host.clientHeight;
    if (!width || !height) return;
    // Overscan the opening canvas so detached foil can travel beyond the pack's
    // layout box. Scale camera distance too to retain the intended pack size.
    const overscan = opening ? 3 : 1;
    renderer.setSize(width * overscan, height * overscan, false); camera.aspect = width / height;
    camera.position.z = (opening ? Math.max(6.3, 4.8 / camera.aspect) : Math.max(7.8, 5.5 / camera.aspect)) * overscan;
    camera.updateProjectionMatrix();
    dirty = true;
  }); resize.observe(host);
  const tick = () => {
    frame = requestAnimationFrame(tick);
    const time = performance.now();
    const delta = Math.min(64, time - lastTime); lastTime = time;
    if (!visible || !width || !height) return;
    const motion = !reduced();
    const dx = (motion && !opening ? -pose.y * .12 : 0) - group.rotation.x;
    const dy = (opening ? 0 : motion ? pose.x * .24 : -.12) - group.rotation.y;
    const lift = motion ? pose.lift : 0;
    if (!dirty && Math.abs(dx) + Math.abs(dy) < .0001 && lastProgress === pose.progress && lastLift === lift && lastSide === pose.side && pose.exit === 0) return;
    group.rotation.x += dx * .12;
    group.rotation.y += dy * .12;
    group.rotation.z = opening ? 0 : -.075;
    group.position.x = 0;
    group.position.y = 0;
    if (pose.progress === 1) pose.exit = Math.min(1, pose.exit + delta / 650);
    cards.visible = opening && pose.progress > .04;
    cards.position.y = Math.min(1, pose.progress * 2) * .55;
    if (lastProgress !== pose.progress || lastLift !== lift || lastSide !== pose.side || pose.exit > 0) {
      for (let i = 0; i < strip.attributes.position.count; i++) {
        const x = stripBase[i * 3], y = stripBase[i * 3 + 1];
        const distance = (1 - x * pose.side) / 2;
        const freed = Math.max(0, pose.progress - distance);
        const fold = motion ? Math.min(1, freed * 2) : 0;
        const corner = Math.pow(1 - distance, 10) * lift * .5;
        const angle = Math.min(1.8, (fold + corner) * 1.8);
        const length = freed * .85 + corner * .15;
        strip.attributes.position.setXYZ(i, x + pose.side * ((1 - Math.cos(angle)) * length * .3 + pose.exit * pose.exit * 3.5),
          1.23 + y + seam(x) * (.17 - y) / .34 * Math.min(1, freed * 20) + Math.sin(angle) * length * .6 + Math.sin(pose.exit * Math.PI) * 1.3,
          surface(x, 1.23 + y) + Math.sin(angle) * length + corner * .15 + pose.exit * 1.5);
      }
      strip.attributes.position.needsUpdate = true; strip.computeVertexNormals();
      if (pose.progress === 0 && lift === 0) {
        for (let i = 0; i < strip.attributes.normal.count; i++) {
          const n = surfaceNormal(stripBase[i * 3], 1.23 + stripBase[i * 3 + 1]);
          strip.attributes.normal.setXYZ(i, n.x, n.y, n.z);
        }
        strip.attributes.normal.needsUpdate = true;
      }
      lastProgress = pose.progress; lastLift = lift; lastSide = pose.side;
    }
    flecks.visible = motion && pose.exit > 0;
    if (flecks.visible) {
      flakeMaterial.opacity = 1 - pose.exit;
      flecks.children.forEach((flake, i) => {
        const angle = i * 2.399;
        flake.position.set(pose.side * .7 + Math.cos(angle) * pose.exit * 1.8,
          1.35 + Math.sin(angle) * pose.exit * .8 - pose.exit * pose.exit,
          Math.sin(i * 8.1) * pose.exit);
        flake.rotation.set(pose.exit * (i + 3), angle + pose.exit * 7, angle);
      });
    }
    renderer.render(scene, camera);
    dirty = false;
  };
  tick();
  return () => {
    cancelAnimationFrame(frame); observer.disconnect(); resize.disconnect();
    flakeGeometry.dispose(); flakeMaterial.dispose();
    cardGeometry.dispose(); cardMaterial.dispose(); cardTexture.dispose();
    body.dispose(); strip.dispose(); material.dispose(); liner.dispose(); texture.dispose();
    environment.dispose(); pmrem.dispose(); env.dispose(); renderer.dispose();
  };
}
