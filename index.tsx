
import React from 'react';
import ReactDOM from 'react-dom/client';
import './src/index.css';
import { AppBootstrap, AppErrorBoundary } from './src/bootstrap/AppBootstrap.tsx';
import { LanguageProvider } from './components/LanguageContext.tsx';

// ============================================================================
// ACTIVE ISOLATION BARRIER: GLOBAL LOCALSTORAGE RESILIENCE PATCH
// ============================================================================
(function() {
  try {
    const originalSetItem = window.localStorage.setItem.bind(window.localStorage);
    const originalGetItem = window.localStorage.getItem.bind(window.localStorage);
    const originalRemoveItem = window.localStorage.removeItem.bind(window.localStorage);
    const originalClear = window.localStorage.clear.bind(window.localStorage);
    
    // In-memory shadow storage to survive when disk space/quota is exceeded
    const shadowMap = new Map<string, string>();

    // Patch setItem
    window.localStorage.setItem = function(key: string, value: string) {
      try {
        originalSetItem(key, value);
        // Also keep it synchronized in our shadowMap so that updates propagate correctly
        shadowMap.set(key, value);
      } catch (e: any) {
        const isQuotaError = e.name === 'QuotaExceededError' || e.code === 22 || String(e.message).includes('quota') || String(e.message).includes('limit');
        
        if (isQuotaError) {
          console.warn(`[LocalStorage Proxy] Quota exceeded for key: "${key}". Running emergency cleanup to free space...`);
          
          try {
            // Attempt cleanup of dispensable/reconstructable data
            const keys = Object.keys(window.localStorage);
            for (const k of keys) {
              if (
                k.includes('resilience_logs') || 
                k.includes('resilience_snapshots') || 
                k.includes('app_backups') || 
                k.includes('sys_mouse_clipboard') ||
                k.includes('logs_secure') || 
                k.includes('letters_archive_secure')
              ) {
                originalRemoveItem(k);
              }
            }
            
            // Retry the original write after cleanup
            originalSetItem(key, value);
            shadowMap.set(key, value);
            console.log(`[LocalStorage Proxy] Emergency recovery successful! Key "${key}" successfully written.`);
            return;
          } catch (retryErr) {
            console.warn(`[LocalStorage Proxy] Cleanup failed or insufficient to recover quota. Isolating in memory for key: "${key}"`);
          }
        }
        
        // Final fallback: save to shadowMap so app logic continues without crashing!
        shadowMap.set(key, value);
      }
    };

    // Patch getItem
    window.localStorage.getItem = function(key: string): string | null {
      // If we have an updated value in memory, prioritize it (or fallback to original localStorage)
      if (shadowMap.has(key)) {
        return shadowMap.get(key) || null;
      }
      return originalGetItem(key);
    };

    // Patch removeItem
    window.localStorage.removeItem = function(key: string) {
      shadowMap.delete(key);
      try {
        originalRemoveItem(key);
      } catch {}
    };

    // Patch clear
    window.localStorage.clear = function() {
      shadowMap.clear();
      try {
        originalClear();
      } catch {}
    };

    console.log('[LocalStorage Proxy] Global resilience sandbox successfully configured and active.');
  } catch (err) {
    console.error('[LocalStorage Proxy] Failed to boot global resilience sandbox:', err);
  }
})();
// ============================================================================

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <AppErrorBoundary>
      <LanguageProvider>
        <AppBootstrap />
      </LanguageProvider>
    </AppErrorBoundary>
  </React.StrictMode>
);

// Guarantee removal of the HTML initial loader immediately upon mounting
try {
  if (typeof (window as any).__dismissInitialLoader === 'function') {
    (window as any).__dismissInitialLoader();
  }
} catch {}
