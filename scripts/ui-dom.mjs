// Evaluate a snippet of JavaScript in the app's main window and print the result.
//
//   $env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = "--remote-debugging-port=9222"
//   Start-Process "$env:LOCALAPPDATA\Activity Tracker v2\activity-tracker-v2.exe"
//   node scripts/ui-dom.mjs "document.body.innerText.includes('Danger zone')"
//   node scripts/ui-dom.mjs "[...document.querySelectorAll('a')].map(a => a.textContent).join(' / ')"
//
// Why this exists: the tray app hides itself on focus loss, so a synthetic OS click and the window can disagree about
// whether it is on screen, and a click that silently did nothing looks identical to one that worked. Driving the DOM
// over CDP both performs the action and lets the page be read back to confirm it (L-23). Unset the variable and
// restart afterwards — the debug port is open to any local process while the app runs.
import { WebSocket } from 'ws';

const BASE = process.env.CDP_BASE ?? 'http://127.0.0.1:9222';

// `--page tray` targets the tray popup instead of the main window: it is a separate webview with its own URL
// (`/tray`), and a question about the popup is not answerable from the main window's DOM.
const args = process.argv.slice(2);
let pageFilter = null;
const pageFlag = args.indexOf('--page');
if (pageFlag >= 0) {
    pageFilter = args[pageFlag + 1];
    args.splice(pageFlag, 2);
}
const expression = args.join(' ');

if (!expression) {
    console.error('usage: node scripts/ui-dom.mjs "<javascript expression>"');
    process.exit(1);
}

const targets = await (await fetch(`${BASE}/json`)).json();
const page = targets
    .filter((t) => t.type === 'page')
    .find((t) => (pageFilter ? t.url.includes(pageFilter) : !t.url.includes('/tray')));
if (!page) {
    console.error(`no page target matching ${pageFilter ?? "the main window"} — is the app running with --remote-debugging-port=9222?`);
    process.exit(1);
}

const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve) => ws.once('open', resolve));

const id = 1;
const result = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('evaluate timed out')), 15000);
    ws.on('message', (raw) => {
        const msg = JSON.parse(raw);
        if (msg.id !== id) return;
        clearTimeout(timer);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
    });
    ws.send(
        JSON.stringify({
            id,
            method: 'Runtime.evaluate',
            params: { expression, returnByValue: true, awaitPromise: true },
        })
    );
});

ws.close();

if (result.exceptionDetails) {
    console.error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
    process.exit(1);
}
const value = result.result?.value;
console.log(typeof value === 'string' ? value : JSON.stringify(value, null, 2));
