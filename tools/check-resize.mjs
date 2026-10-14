import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { browser } from './layered-cdp.mjs';
const b = await browser(9339);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const rows = [];
try {
  await b.send('Page.navigate', { url: 'http://127.0.0.1:5173/' });
  for (let n = 0; n < 80; n++) {
    if (await b.evaluate(`!!window.__game?.scene.getScene('Game')?.ready`)) break;
    await wait(200);
  }
  for (const [width, height, dpr, mobile] of [
    [1440, 900, 1, false],
    [412, 915, 2.625, true],
    [915, 412, 2, true],
    [390, 844, 3, true],
    [1280, 720, 1, false],
    [1920, 1080, 1, false],
  ]) {
    await b.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: dpr,
      mobile,
    });
    await wait(900);
    rows.push(
      await b.evaluate(
        `(()=>{const g=window.__game,s=g.scene.getScene('Game'),c=g.canvas,r=c.getBoundingClientRect();return {viewport:[visualViewport.width,visualViewport.height,devicePixelRatio],canvas:[c.width,c.height],css:[r.width,r.height],game:[g.scale.gameSize.width,g.scale.gameSize.height],display:[g.scale.displaySize.width,g.scale.displaySize.height],camera:[s.cameras.main.width,s.cameras.main.height],zoom:g.scale.zoom,frame:[s.reels.front.displayWidth,s.reels.front.displayHeight],symbol:[s.reels.cols[0][1].img.displayWidth,s.reels.cols[0][1].img.displayHeight]};})()`,
      ),
    );
  }
  await b.send('Emulation.clearDeviceMetricsOverride');
  await wait(900);
  rows.push(
    await b.evaluate(
      `(()=>{const g=window.__game,c=g.canvas,r=c.getBoundingClientRect(),s=g.scene.getScene('Game');return {viewport:[visualViewport.width,visualViewport.height,devicePixelRatio],canvas:[c.width,c.height],css:[r.width,r.height],camera:[s.cameras.main.width,s.cameras.main.height]};})()`,
    ),
  );
  await writeFile('_review/resize-check.json', JSON.stringify(rows, null, 2));
  console.log(JSON.stringify(rows));
  for (const r of rows) {
    assert(Math.abs(r.css[0] - r.viewport[0]) < 1);
    assert(Math.abs(r.css[1] - r.viewport[1]) < 1);
    assert(Math.abs(r.canvas[0] - r.viewport[0] * r.viewport[2]) < 2);
    assert(Math.abs(r.canvas[1] - r.viewport[1] * r.viewport[2]) < 2);
    assert.deepEqual(r.camera, r.canvas);
  }
} finally {
  await b.close();
}
