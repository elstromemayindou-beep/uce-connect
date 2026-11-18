import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

/** @typedef {Event & { prompt: () => Promise<void>, userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }} DeferredInstallPrompt */

const PwaContext = createContext(null);

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
    || /** @type {Navigator & { standalone?: boolean }} */ (window.navigator).standalone === true;
}

export function PwaProvider({ children }) {
  /** @type {[DeferredInstallPrompt | null, React.Dispatch<React.SetStateAction<DeferredInstallPrompt | null>>]} */
  const [installPrompt, setInstallPrompt] = useState(null);
  const [installed, setInstalled] = useState(() => isStandalone());
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    if ('serviceWorker' in navigator && window.isSecureContext) {
      navigator.serviceWorker.register('/sw.js').catch((error) => {
        console.error('Unable to register the app service worker:', error);
      });
    }

    const handleInstallPrompt = (event) => {
      event.preventDefault();
      setInstallPrompt(/** @type {DeferredInstallPrompt} */ (event));
    };
    const handleInstalled = () => {
      setInstallPrompt(null);
      setInstalled(true);
    };
    const handleDisplayModeChange = () => setInstalled(isStandalone());
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('beforeinstallprompt', handleInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);
    const displayMode = window.matchMedia('(display-mode: standalone)');
    displayMode.addEventListener?.('change', handleDisplayModeChange);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
      displayMode.removeEventListener?.('change', handleDisplayModeChange);
    };
  }, []);

  const install = useCallback(async () => {
    if (!installPrompt) return false;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    setInstallPrompt(null);
    if (choice.outcome === 'accepted') setInstalled(true);
    return choice.outcome === 'accepted';
  }, [installPrompt]);

  const value = useMemo(() => ({
    canPromptInstall: Boolean(installPrompt),
    installed,
    online,
    install,
  }), [installPrompt, installed, online, install]);

  return <PwaContext.Provider value={value}>{children}</PwaContext.Provider>;
}

export function usePwa() {
  const context = useContext(PwaContext);
  if (!context) throw new Error('usePwa must be used inside PwaProvider.');
  return context;
}
