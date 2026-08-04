import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Self-hosted variable fonts (declared in the design system but never shipped)
import '@fontsource-variable/inter'
import '@fontsource-variable/plus-jakarta-sans'
import './index.css'
import App from './App.tsx'

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
