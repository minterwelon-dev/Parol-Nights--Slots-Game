import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
export async function browser(port = 9337) {
  const profile = resolve('_review/chrome-layered-' + port);
  await mkdir(profile, { recursive: true });
  const child = spawn(
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    [
      '--headless=new',
      '--mute-audio',
      '--no-first-run',
      '--no-default-browser-check',
      '--remote-debugging-port=' + port,
      '--user-data-dir=' + profile,
      'about:blank',
    ],
    { windowsHide: true, stdio: 'ignore' },
  );
  let tabs;
  for (let n = 0; n < 60; n++) {
    try {
      tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      if (tabs.length) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  if (!tabs) {
    child.kill();
    throw Error('Chrome startup timeout');
  }
  const ws = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r, j) => {
    ws.onopen = r;
    ws.onerror = j;
  });
  let id = 0;
  const pending = new Map();
  const events = [];
  let onEvent = () => {};
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (!m.id) {
      events.push(m);
      onEvent(m);
      return;
    }
    const p = pending.get(m.id);
    if (!p) return;
    pending.delete(m.id);
    clearTimeout(p.timer);
    m.error ? p.reject(Error(JSON.stringify(m.error))) : p.resolve(m.result);
  };
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const key = ++id;
      const timer = setTimeout(() => {
        pending.delete(key);
        reject(Error(method + ' timeout'));
      }, 20000);
      pending.set(key, { resolve, reject, timer });
      ws.send(JSON.stringify({ id: key, method, params }));
    });
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails));
    return r.result.value;
  };
  await send('Runtime.enable');
  await send('Page.enable');
  return {
    send,
    evaluate,
    events,
    onEvent: (callback) => {
      onEvent = callback;
    },
    close: async () => {
      try {
        await send('Browser.close');
      } catch {}
      ws.close();
      child.kill();
    },
  };
}
