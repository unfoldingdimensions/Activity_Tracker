// T16 probe: while the app's window is hidden, is the page told it is hidden, and does it still
// animate? Prints visibilityState and how many requestAnimationFrame callbacks land in 2 s.
//
//   node t16_probe.mjs            # current state
//
// Requires the app to have been started with
//   WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9222
import { WebSocket } from 'ws';

const BASE = 'http://127.0.0.1:9222';

const list = await (await fetch(`${BASE}/json`)).json();
const pages = list.filter((t) => t.type === 'page');
if (!pages.length) {
    console.error('no page targets');
    process.exit(1);
}

for (const page of pages) {
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((r) => ws.once('open', r));
    let id = 0;
    const send = (method, params = {}) =>
        new Promise((resolve, reject) => {
            const msgId = ++id;
            const timer = setTimeout(() => reject(new Error(`${method} timed out`)), 8000);
            const onMsg = (raw) => {
                const msg = JSON.parse(raw);
                if (msg.id === msgId) {
                    clearTimeout(timer);
                    ws.off('message', onMsg);
                    msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
                }
            };
            ws.on('message', onMsg);
            ws.send(JSON.stringify({ id: msgId, method, params }));
        });

    const evaluate = async (expression) => {
        const res = await send('Runtime.evaluate', { expression, returnByValue: true });
        return res.result?.value;
    };

    const state = await evaluate('document.visibilityState');
    const hidden = await evaluate('document.hidden');
    // Install a frame counter, wait outside the page, then read it back. A hidden page stops firing
    // requestAnimationFrame, so awaiting a rAF promise inside the page never resolves — the earlier
    // version of this script hung on exactly that, which is a result rather than a bug.
    await evaluate(`
        window.__rafN = 0;
        (function tick() { window.__rafN++; requestAnimationFrame(tick); })();
        'installed'
    `);
    await new Promise((r) => setTimeout(r, 2000));
    const frames = await evaluate('window.__rafN');
    const anims = await evaluate(`
        document.getAnimations().filter((a) => a.playState === 'running').length
    `);
    console.log(
        `${JSON.stringify(page.title).padEnd(24)} visibilityState=${state} hidden=${hidden} ` +
            `rAF=${frames}/2s animations-running=${anims}`
    );
    ws.close();
}
