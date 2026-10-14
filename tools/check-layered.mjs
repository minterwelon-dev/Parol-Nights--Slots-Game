import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { browser } from './layered-cdp.mjs';
const b = await browser(9338);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const scene = `window.__game.scene.getScene('Game')`;
async function ready() {
  for (let i = 0; i < 80; i++) {
    if (await b.evaluate(`!!window.__game && ${scene}?.ready && ${scene}.fsm.state==='Idle'`))
      return;
    await wait(200);
  }
  await writeFile('_review/layered-timeout.json', JSON.stringify(b.events.slice(-60), null, 2));
  throw Error('Game ready timeout');
}
const reports = [];
try {
  for (const [name, width, height] of [
    ['portrait', 412, 915],
    ['landscape', 915, 412],
  ]) {
    await b.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 2,
      mobile: true,
    });
    await b.send('Page.navigate', { url: 'http://127.0.0.1:5173/' });
    await wait(400);
    await ready();
    await b.evaluate(
      `(() => {const s=${scene}; s.anim.setReducedMotion(false); s.reels.setGrid(Array.from({length:5},()=>['H3','WILD','COIN']));})()`,
    );
    await wait(850);
    const sample = () =>
      b.evaluate(
        `(() => {const s=${scene}; return s.reels.cols.map(col=>col.slice(1,4).map(v=>({id:v.id,layered:v.layered,flat:v.img.visible,pivot:v.pivot.angle,parts:v.partRoots.map(p=>({visible:p.visible,angle:p.angle,scale:p.scaleX}))})));})()`,
      );
    const initial = await sample();
    await wait(500);
    const moving = await sample();
    assert(initial.every((c) => c[0].layered && c[1].layered && !c[2].layered));
    assert(moving[0][0].parts[0].angle < initial[0][0].parts[0].angle);
    assert.equal(initial[0][0].parts[1].angle, 0);
    assert.equal(moving[0][0].parts[1].angle, 0);
    assert.notEqual(initial[0][0].pivot, moving[0][0].pivot);
    assert.equal(moving[0][0].parts.filter((p) => p.visible).length, 7);
    assert.notEqual(initial[0][0].parts[3].angle, moving[0][0].parts[3].angle);
    assert(moving[0][1].parts[0].angle > initial[0][1].parts[0].angle);
    await writeFile(
      `_review/layered-${name}.png`,
      Buffer.from((await b.send('Page.captureScreenshot')).data, 'base64'),
    );
    await b.evaluate(`${scene}.anim.setReducedMotion(true)`);
    await wait(150);
    const reduced = await sample();
    await wait(200);
    assert.deepEqual(await sample(), reduced);
    assert(reduced[0][0].parts.every((p) => p.angle === 0 && p.scale === 1));
    const reset = await b.evaluate(
      `(() => {const v=${scene}.reels.cols[0][1]; v.setBlur(true); const blur=!v.layered && v.img.visible && v.partRoots.every(p=>!p.visible); v.set('COIN');v.setBlur(false); const ordinary=!v.layered && v.img.visible;v.set('H3');return {blur,ordinary,restored:v.layered};})()`,
    );
    assert.deepEqual(reset, { blur: true, ordinary: true, restored: true });
    await b.evaluate(
      `(() => {const s=${scene};s.anim.setReducedMotion(false);s.reels.highlight(Array(15).fill(true));})()`,
    );
    await wait(350);
    const win1 = await sample();
    await wait(500);
    const win2 = await sample();
    assert(win1[0][0].parts[0].angle - win2[0][0].parts[0].angle > 10);
    assert.equal(win2[0][0].parts[1].angle, 0);
    assert.notEqual(win1[0][0].parts[3].angle, win2[0][0].parts[3].angle);
    await b.evaluate(`${scene}.reels.highlight(null)`);
    await b.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const fps = await b.evaluate(
      `new Promise(resolve=>{const g=window.__game;let n=0;const start=performance.now();const tick=()=>n++;g.events.on('postrender',tick);setTimeout(()=>{g.events.off('postrender',tick);resolve(n*1000/(performance.now()-start));},2500);})`,
    );
    await b.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    await b.evaluate(
      `(() => {for(const col of ${scene}.reels.cols)for(const v of col){v.layered=false;v.img.setVisible(true);for(const p of v.partRoots)p.setVisible(false);}})()`,
    );
    await b.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const flatFps = await b.evaluate(
      `new Promise(resolve=>{const g=window.__game;let n=0;const start=performance.now();const tick=()=>n++;g.events.on('postrender',tick);setTimeout(()=>{g.events.off('postrender',tick);resolve(n*1000/(performance.now()-start));},2500);})`,
    );
    await b.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    reports.push({ name, fps, flatFps, initial, moving, reduced, reset });
    console.log(name, { fps, flatFps });
    await b.evaluate(`${scene}.reels.refreshParts()`);
    const poolSize = await b.evaluate(
      `${scene}.reels.cols.flat().reduce((n,v)=>n+v.root.list.length+v.pivot.list.length,0)`,
    );
    await b.evaluate(`${scene}.onSpinPressed()`);
    for (let i = 0; i < 150; i++) {
      await wait(100);
      const state = await b.evaluate(`${scene}.fsm.state`);
      if (state === 'Idle') break;
      assert.notEqual(state, 'Error');
      await b.evaluate(`${scene}.onSpinPressed()`);
    }
    assert.equal(await b.evaluate(`${scene}.fsm.state`), 'Idle');
    assert.equal(
      await b.evaluate(
        `${scene}.reels.cols.flat().reduce((n,v)=>n+v.root.list.length+v.pivot.list.length,0)`,
      ),
      poolSize,
    );
    await b.evaluate(
      `(() => {const s=${scene};s.anim.setReducedMotion(false);s.presenter.clearLines();s.reels.highlight(null);s.reels.setGrid([['L1','L2','L3'],['H1','H2','SCATTER'],['SCATTER','SCATTER','SCATTER'],['H3','WILD','L4'],['H2','H1','L1']]);})()`,
    );
    await wait(900);
    const attachments1 = await sample();
    await wait(400);
    const attachments2 = await sample();
    for (const [r, row, count] of [
      [0, 0, 6],
      [0, 1, 2],
      [0, 2, 2],
      [1, 0, 6],
      [1, 1, 6],
      [1, 2, 8],
      [3, 2, 9],
    ]) {
      assert(attachments2[r][row].layered);
      assert.equal(attachments2[r][row].parts.filter((p) => p.visible).length, count);
      assert.equal(attachments2[r][row].parts[0].angle, 0);
      if (r !== 1 || row !== 2) {
        assert.notEqual(attachments1[r][row].parts[1].angle, attachments2[r][row].parts[1].angle);
        assert.notEqual(attachments1[r][row].pivot, attachments2[r][row].pivot);
      }
    }
    await writeFile(
      `_review/attachments-${name}.png`,
      Buffer.from((await b.send('Page.captureScreenshot')).data, 'base64'),
    );
    await b.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const attachmentsFps = await b.evaluate(
      `new Promise(resolve=>{const g=window.__game;let n=0;const start=performance.now();const tick=()=>n++;g.events.on('postrender',tick);setTimeout(()=>{g.events.off('postrender',tick);resolve(n*1000/(performance.now()-start));},2500);})`,
    );
    await b.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    reports.at(-1).attachmentsFps = attachmentsFps;
    console.log(name, { attachmentsFps });
    await b.evaluate(`${scene}.reels.highlight(Array(15).fill(true))`);
    await wait(120);
    const jingling = await sample();
    assert(jingling[1][2].parts.slice(1).some((p) => p.angle !== 0));
    await b.evaluate(`${scene}.reels.highlight(null)`);
    await b.evaluate(
      `(() => {const mask=Array(15).fill(false);mask[5]=true;${scene}.reels.symbols.trigger(mask).finish();})()`,
    );
    await wait(80);
    assert(await b.evaluate(`Math.abs(${scene}.reels.cols[1][3].root.scaleX-1)<0.001`));
    await b.evaluate(`${scene}.reels.highlight(null)`);
    await b.evaluate(`${scene}.anim.setReducedMotion(true)`);
    await wait(100);
    const still = await sample();
    await wait(200);
    assert.deepEqual(await sample(), still);
    assert(still.flat().every((v) => v.parts.every((p) => p.angle === 0 && p.scale === 1)));
    reports.at(-1).attachments = { moving: true, bodySway: true, reduced: true, skip: true };
  }
  // Missing just one part must fall back as a whole; successful symbols keep their layers.
  b.onEvent((event) => {
    if (event.method === 'Fetch.requestPaused')
      void b.send('Fetch.failRequest', {
        requestId: event.params.requestId,
        errorReason: 'Failed',
      });
  });
  await b.send('Fetch.enable', {
    patterns: ['*H3_inner.webp*', '*tassel.webp*', '*pandereta_cap.webp*'].map((urlPattern) => ({
      urlPattern,
      resourceType: 'XHR',
    })),
  });
  await b.send('Page.reload', { ignoreCache: true });
  await wait(400);
  await ready();
  const fallback = await b.evaluate(
    `(() => {const s=${scene};s.reels.setGrid(Array.from({length:5},()=>['H3','WILD','COIN']));const c=s.reels.cols[0];return {h3:c[1].layered,flat:c[1].img.visible,wild:c[2].layered};})()`,
  );
  assert.deepEqual(fallback, { h3: false, flat: true, wild: true });
  const attachmentsFallback = await b.evaluate(
    `(() => {const s=${scene};s.reels.setGrid(Array.from({length:5},()=>['L1','H2','SCATTER']));return s.reels.cols.every(c=>c.slice(1,4).every(v=>!v.layered && v.img.visible && v.partRoots.every(p=>!p.visible)));})()`,
  );
  assert(attachmentsFallback);
  const exceptions = b.events.filter((e) => e.method === 'Runtime.exceptionThrown');
  assert.equal(exceptions.length, 0);
  await writeFile(
    '_review/layered-check.json',
    JSON.stringify({ reports, fallback, exceptions }, null, 2),
  );
  console.log(
    JSON.stringify({
      reports: reports.map(({ name, fps, flatFps }) => ({ name, fps, flatFps })),
      fallback,
    }),
  );
  for (const report of reports) {
    assert(report.fps >= 55, `${report.name}: ${report.fps} FPS < 55`);
    assert(
      report.attachmentsFps >= 55,
      `${report.name}: attachments ${report.attachmentsFps} FPS < 55`,
    );
  }
} finally {
  await b.close();
}
