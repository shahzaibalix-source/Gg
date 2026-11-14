import * as THREE from 'three';

export interface CityTextureSet {
  asphalt: THREE.CanvasTexture;
  sidewalkStone: THREE.CanvasTexture;
  cobblestone: THREE.CanvasTexture;
  grass: THREE.CanvasTexture;
  brick: THREE.CanvasTexture;
  plaster: THREE.CanvasTexture;
  roofTile: THREE.CanvasTexture;
  slateRoof: THREE.CanvasTexture;
  timber: THREE.CanvasTexture;
  parkGravel: THREE.CanvasTexture;
  dispose: () => void;
}

function makeCanvas(size = 512): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

function configureTexture(
  canvas: HTMLCanvasElement,
  repeatX: number,
  repeatY: number,
  maxAnisotropy: number,
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = Math.min(8, maxAnisotropy);
  tex.needsUpdate = true;
  return tex;
}

// Deterministic pseudo-random generator for crisp repeatable procedural textures
function mulberry32(seed: number) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createCityTextureSet(maxAnisotropy = 4): CityTextureSet {
  // 1. Asphalt with fine mineral aggregate
  const [asphaltCanvas, aCtx] = makeCanvas(512);
  aCtx.fillStyle = '#2d3138';
  aCtx.fillRect(0, 0, 512, 512);
  const rand1 = mulberry32(101);
  for (let i = 0; i < 18000; i++) {
    const x = rand1() * 512;
    const y = rand1() * 512;
    const v = 36 + Math.floor(rand1() * 28);
    aCtx.fillStyle = `rgb(${v}, ${v + 2}, ${v + 5})`;
    aCtx.fillRect(x, y, rand1() > 0.7 ? 2 : 1, rand1() > 0.7 ? 2 : 1);
  }
  const asphalt = configureTexture(asphaltCanvas, 1, 1, maxAnisotropy);

  // 2. European granite sidewalk slabs
  const [swCanvas, swCtx] = makeCanvas(512);
  swCtx.fillStyle = '#c8c3b8';
  swCtx.fillRect(0, 0, 512, 512);
  const rand2 = mulberry32(202);
  const tile = 64;
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const offset = (row % 2) * (tile / 2);
      const x = (col * tile + offset) % 512;
      const y = row * tile;
      const shade = 188 + Math.floor(rand2() * 18);
      swCtx.fillStyle = `rgb(${shade}, ${shade - 4}, ${shade - 10})`;
      swCtx.fillRect(x + 1, y + 1, tile - 2, tile - 2);
      if (x + tile > 512) {
        swCtx.fillRect(0, y + 1, x + tile - 512 - 2, tile - 2);
      }
    }
  }
  for (let i = 0; i < 6000; i++) {
    const x = rand2() * 512;
    const y = rand2() * 512;
    swCtx.fillStyle = rand2() > 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
    swCtx.fillRect(x, y, 2, 2);
  }
  const sidewalkStone = configureTexture(swCanvas, 1, 1, maxAnisotropy);

  // 3. Cobblestone driveway / plaza pavers
  const [cobCanvas, cobCtx] = makeCanvas(512);
  cobCtx.fillStyle = '#7e766d';
  cobCtx.fillRect(0, 0, 512, 512);
  const rand3 = mulberry32(303);
  const cw = 32;
  const ch = 24;
  for (let y = 0; y < 512; y += ch) {
    const shift = ((y / ch) % 2) * (cw / 2);
    for (let x = -cw; x < 512 + cw; x += cw) {
      const tone = 135 + Math.floor(rand3() * 34);
      const warm = Math.floor(rand3() * 14);
      cobCtx.fillStyle = `rgb(${tone + warm}, ${tone + 4}, ${tone - 6})`;
      cobCtx.beginPath();
      cobCtx.roundRect(x + shift + 2, y + 2, cw - 4, ch - 4, 4);
      cobCtx.fill();
    }
  }
  const cobblestone = configureTexture(cobCanvas, 3, 3, maxAnisotropy);

  // 4. Manicured European grass
  const [grassCanvas, gCtx] = makeCanvas(512);
  gCtx.fillStyle = '#537e43';
  gCtx.fillRect(0, 0, 512, 512);
  const rand4 = mulberry32(404);
  for (let i = 0; i < 16000; i++) {
    const x = rand4() * 512;
    const y = rand4() * 512;
    const g = 108 + Math.floor(rand4() * 38);
    const r = 68 + Math.floor(rand4() * 26);
    const b = 52 + Math.floor(rand4() * 18);
    gCtx.fillStyle = `rgb(${r},${g},${b})`;
    gCtx.fillRect(x, y, 2, 3);
  }
  const grass = configureTexture(grassCanvas, 24, 24, maxAnisotropy);

  // 5. Traditional European brick
  const [brickCanvas, bCtx] = makeCanvas(512);
  bCtx.fillStyle = '#c8bfb2';
  bCtx.fillRect(0, 0, 512, 512);
  const rand5 = mulberry32(505);
  const bw = 64;
  const bh = 28;
  for (let row = 0; row < 20; row++) {
    const shift = (row % 2) * (bw / 2);
    const y = row * bh;
    for (let col = -1; col < 10; col++) {
      const x = col * bw + shift;
      const r = 138 + Math.floor(rand5() * 34);
      const g = 74 + Math.floor(rand5() * 22);
      const b = 58 + Math.floor(rand5() * 18);
      bCtx.fillStyle = `rgb(${r},${g},${b})`;
      bCtx.fillRect(x + 2, y + 2, bw - 4, bh - 4);
    }
  }
  const brick = configureTexture(brickCanvas, 2, 2, maxAnisotropy);

  // 6. Limewash plaster / stucco
  const [plasterCanvas, pCtx] = makeCanvas(512);
  pCtx.fillStyle = '#eee8dc';
  pCtx.fillRect(0, 0, 512, 512);
  const rand6 = mulberry32(606);
  for (let i = 0; i < 9000; i++) {
    const x = rand6() * 512;
    const y = rand6() * 512;
    const alpha = rand6() * 0.05;
    pCtx.fillStyle = rand6() > 0.5 ? `rgba(255,255,255,${alpha})` : `rgba(110,95,80,${alpha})`;
    pCtx.fillRect(x, y, 6, 4);
  }
  const plaster = configureTexture(plasterCanvas, 2, 2, maxAnisotropy);

  // 7. Terracotta clay roof tiles
  const [roofCanvas, rCtx] = makeCanvas(512);
  rCtx.fillStyle = '#9a4a33';
  rCtx.fillRect(0, 0, 512, 512);
  const rand7 = mulberry32(707);
  for (let y = 0; y < 512; y += 32) {
    for (let x = 0; x < 512; x += 24) {
      const r = 148 + Math.floor(rand7() * 32);
      const g = 68 + Math.floor(rand7() * 20);
      const b = 46 + Math.floor(rand7() * 14);
      rCtx.fillStyle = `rgb(${r},${g},${b})`;
      rCtx.fillRect(x + 1, y + 1, 22, 29);
      rCtx.fillStyle = 'rgba(0,0,0,0.18)';
      rCtx.fillRect(x, y + 29, 24, 3);
    }
  }
  const roofTile = configureTexture(roofCanvas, 3, 2, maxAnisotropy);

  // 8. Slate roof tiles
  const [slateCanvas, sCtx] = makeCanvas(512);
  sCtx.fillStyle = '#3b424d';
  sCtx.fillRect(0, 0, 512, 512);
  const rand8 = mulberry32(808);
  for (let y = 0; y < 512; y += 32) {
    const shift = ((y / 32) % 2) * 16;
    for (let x = -32; x < 512 + 32; x += 32) {
      const v = 54 + Math.floor(rand8() * 22);
      sCtx.fillStyle = `rgb(${v},${v + 6},${v + 14})`;
      sCtx.fillRect(x + shift + 1, y + 1, 30, 30);
    }
  }
  const slateRoof = configureTexture(slateCanvas, 3, 2, maxAnisotropy);

  // 9. Warm timber planks
  const [timberCanvas, tCtx] = makeCanvas(512);
  tCtx.fillStyle = '#8b5e3c';
  tCtx.fillRect(0, 0, 512, 512);
  const rand9 = mulberry32(909);
  for (let x = 0; x < 512; x += 32) {
    const tone = Math.floor(rand9() * 20);
    tCtx.fillStyle = `rgb(${132 + tone},${88 + tone},${56 + tone})`;
    tCtx.fillRect(x + 1, 0, 30, 512);
    tCtx.fillStyle = 'rgba(40,22,10,0.15)';
    tCtx.fillRect(x, 0, 1, 512);
  }
  const timber = configureTexture(timberCanvas, 2, 2, maxAnisotropy);

  // 10. Park decomposed granite gravel
  const [gravCanvas, grCtx] = makeCanvas(512);
  grCtx.fillStyle = '#d3c9b4';
  grCtx.fillRect(0, 0, 512, 512);
  const rand10 = mulberry32(1010);
  for (let i = 0; i < 14000; i++) {
    const x = rand10() * 512;
    const y = rand10() * 512;
    const v = 182 + Math.floor(rand10() * 44);
    grCtx.fillStyle = `rgb(${v},${v - 8},${v - 22})`;
    grCtx.fillRect(x, y, 2, 2);
  }
  const parkGravel = configureTexture(gravCanvas, 5, 5, maxAnisotropy);

  return {
    asphalt,
    sidewalkStone,
    cobblestone,
    grass,
    brick,
    plaster,
    roofTile,
    slateRoof,
    timber,
    parkGravel,
    dispose: () => {
      asphalt.dispose();
      sidewalkStone.dispose();
      cobblestone.dispose();
      grass.dispose();
      brick.dispose();
      plaster.dispose();
      roofTile.dispose();
      slateRoof.dispose();
      timber.dispose();
      parkGravel.dispose();
    },
  };
}
