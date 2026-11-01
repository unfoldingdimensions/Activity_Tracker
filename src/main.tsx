import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Self-hosted variable fonts (declared in the design system but never shipped)
import '@fontsource-variable/inter'
import '@fontsource-variable/plus-jakarta-sans'
// Flat-system fonts: mono (labels/data), serif (Editorial mode), and the
// alternative font pairs selectable in Settings
import '@fontsource-variable/jetbrains-mono'
import '@fontsource/instrument-serif/400.css'
import '@fontsource/instrument-serif/400-italic.css'
import '@fontsource-variable/geist'
import '@fontsource-variable/geist-mono'
import '@fontsource-variable/space-grotesk'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import '@fontsource/ibm-plex-mono/700.css'
import '@fontsource-variable/newsreader'
import '@fontsource-variable/source-serif-4'
import './index.css'
import App from './App.tsx'

// The tray popup is its own fixed-size window and its layout fills the window edge to edge; without a height
// constraint on html/body/#root, `h-full` inside the app resolves against an auto height and the content makes the
// page taller than the window — a scrollbar and ~53 px of clipped footer (D-048). Set before React mounts, so the
// first painted frame is already the right shape.
if (window.location.pathname.replace(/\/$/, '') === '/tray') {
  document.documentElement.dataset.surface = 'tray';
}

// Seamless crossfade: Keep HTML splash visible until React LoadingScreen is rendered
// The React screen will be behind the HTML splash, then we fade out the HTML splash
// revealing the identical-looking React screen (with only the loading animation added)
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    // Double RAF ensures React has painted at least one frame
    const staticSplash = document.getElementById('static-splash');
    if (staticSplash) {
      staticSplash.style.opacity = '0';
      // Remove after fade completes
      setTimeout(() => staticSplash.remove(), 300);
    }
  });
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
