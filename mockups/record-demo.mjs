// Records the scripted demo of the mock-up (?demo=<lang>) as MP4 and GIF.
// Needs: google-chrome, ffmpeg, the mock-up served on http://localhost:4330 (launch config deciwa-mockup).
// Usage: node record-demo.mjs <lang> <outdir>     e.g. node record-demo.mjs de ./out
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const lang = process.argv[2] || 'de';
const out = resolve(process.argv[3] || './out');
const W = 1280, H = 800, PORT = 9333;
const url = `http://localhost:4330/feedback-ui.html?v=${Date.now()}&clean&theme=light&variant=A&file=index.html&demo=${lang}`;

mkdirSync(out, { recursive: true });
const work = mkdtempSync(join(tmpdir(), 'deciwa-demo-'));
const chrome = spawn('google-chrome', ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
  `--user-data-dir=${join(work, 'profile')}`, `--remote-debugging-port=${PORT}`, `--window-size=${W},${H}`, 'about:blank'], { stdio: 'ignore' });

const sleep = ms => new Promise(r => setTimeout(r, ms));
let target;
for (let i = 0; i < 50 && !target; i++) {
  await sleep(200);
  try { target = (await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()).find(t => t.type === 'page'); } catch {}
}
if (!target) throw new Error('Chrome did not start');

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r, { once: true }));
let id = 0; const pending = new Map(); const frames = [];
const send = (method, params = {}) => new Promise(r => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
ws.addEventListener('message', ev => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); }
  if (m.method === 'Page.screencastFrame') {
    frames.push({ data: m.params.data, t: m.params.metadata.timestamp });
    send('Page.screencastFrameAck', { sessionId: m.params.sessionId });
  }
});

await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url });
await sleep(400);
await send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: W, maxHeight: H, everyNthFrame: 1 });
for (let i = 0; i < 1200; i++) {
  await sleep(250);
  const r = await send('Runtime.evaluate', { expression: 'window.__demoDone === true', returnByValue: true });
  if (r?.result?.value) break;
}
await send('Page.stopScreencast');
ws.close(); chrome.kill();

// Frames arrive only when the page changes: turn them into a constant 25 fps video via ffmpeg concat durations.
const dir = join(work, 'frames'); mkdirSync(dir);
let list = '';
frames.forEach((f, i) => {
  const name = join(dir, `f${String(i).padStart(5, '0')}.jpg`);
  writeFileSync(name, Buffer.from(f.data, 'base64'));
  const dur = i + 1 < frames.length ? Math.max(0.001, frames[i + 1].t - f.t) : 1;
  list += `file '${name}'\nduration ${dur.toFixed(3)}\n`;
});
list += `file '${join(dir, `f${String(frames.length - 1).padStart(5, '0')}.jpg`)}'\n`;
writeFileSync(join(work, 'list.txt'), list);

const mp4 = join(out, `deciwa-demo-${lang}.mp4`), gif = join(out, `deciwa-demo-${lang}.gif`), poster = join(out, `deciwa-demo-${lang}.jpg`);
const ff = args => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: 'inherit' });
ff(['-f', 'concat', '-safe', '0', '-i', join(work, 'list.txt'), '-vf', 'fps=25,format=yuv420p', '-c:v', 'libx264', '-crf', '24', '-preset', 'slow', '-movflags', '+faststart', mp4]);
ff(['-i', mp4, '-vf', 'fps=10,scale=800:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer:bayer_scale=4', gif]);
ff(['-ss', '6', '-i', mp4, '-frames:v', '1', '-q:v', '3', poster]);
rmSync(work, { recursive: true, force: true });
console.log(`${frames.length} frames → ${mp4}, ${gif}, ${poster}`);
