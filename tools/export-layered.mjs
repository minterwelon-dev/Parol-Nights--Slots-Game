import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { browser } from './layered-cdp.mjs';
const root = 'Assets/theme/parol-nights/';
const parts = { WILD_rays: 432, WILD_core: 174, H3_outer: 420, H3_inner: 326, H3_core: 138 };
const next = {
  H3_outer_body: [512, 512, 360, 48],
  L1_body: [512, 512, 400, 45],
  L2_body: [512, 512, 360, 40],
  L3_body: [512, 512, 360, 40],
  L4_body: [512, 512, 380, 40],
  H1_body: [512, 512, 350, 45],
  H2_body: [512, 512, 350, 40],
  pandereta_hoop: [512, 512, 420, 46],
  tassel: [128, 256, 120, -1],
  H2_tassel: [128, 256, 230, -1],
  pandereta_cap: [64, 64, 60, -1],
};
const exportingNext = process.argv.includes('--next');
const b = await browser();
try {
  const manifest = [];
  for (const [name, settings] of Object.entries(exportingNext ? next : parts)) {
    const [width, height, extent, top] = exportingNext ? settings : [512, 512, settings, -2];
    const source = await readFile(root + 'source/layered/' + name + '.png');
    const result = await b.evaluate(`(async () => {
      const img = new Image(); img.src = 'data:image/png;base64,${source.toString('base64')}'; await img.decode();
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, c.width, c.height).data;
      let x0=c.width, y0=c.height, x1=0, y1=0, transparent=0, opaque=0;
      for(let y=0;y<c.height;y++) for(let x=0;x<c.width;x++) {
        const a=data[(y*c.width+x)*4+3]; if(a===0) transparent++; if(a===255) opaque++;
        if(a>8) {x0=Math.min(x0,x); y0=Math.min(y0,y); x1=Math.max(x1,x+1); y1=Math.max(y1,y+1);}
      }
      const out=document.createElement('canvas'); out.width=${width};out.height=${height};
      const o=out.getContext('2d'); const scale=Math.min(${extent}/Math.max(x1-x0,y1-y0),${width - 8}/(x1-x0),${height - 8}/(y1-y0));
      if (${top} === -2) o.drawImage(img, (512-img.width*scale)/2, (512-img.height*scale)/2, img.width*scale,img.height*scale);
      else o.drawImage(img,x0,y0,x1-x0,y1-y0,(${width}-(x1-x0)*scale)/2,${top} < 0 ? (${height}-(y1-y0)*scale)/2 : ${top},(x1-x0)*scale,(y1-y0)*scale);
      return {url:out.toDataURL('image/webp',0.76), transparent, opaque, bounds:[x0,y0,x1,y1], scale};
    })()`);
    console.log(name, result.transparent, result.opaque, result.bounds);
    assert(result.transparent > 1000);
    assert(result.url.startsWith('data:image/webp;'));
    const bytes = Buffer.from(result.url.split(',')[1], 'base64');
    assert(bytes.length < 70000, name + ' exceeds layer budget');
    await writeFile(root + 'parts/' + name + '.webp', bytes);
    manifest.push({
      name,
      file: 'parts/' + name + '.webp',
      width,
      height,
      bytes: bytes.length,
      sourceSha256: createHash('sha256').update(source).digest('hex'),
      bounds: result.bounds,
      scale: result.scale,
      processing: `Uniform resize, native alpha preserved, WebP quality 0.76; top ${top}; no repainting`,
    });
  }
  await writeFile(
    root + 'source/layered/' + (exportingNext ? 'processing-next.json' : 'processing.json'),
    JSON.stringify(manifest, null, 2) + '\n',
  );
  console.log(manifest);
} finally {
  await b.close();
}
