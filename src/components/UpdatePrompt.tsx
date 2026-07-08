import { useRegisterSW } from 'virtual:pwa-register/react'

// Service worker stays dev-disabled (see vite.config.ts), so this only fires against a build.
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (!needRefresh) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-lg bg-slate-900 px-4 py-3 text-sm text-white shadow-lg">
      <span>New version available</span>
      <button onClick={() => updateServiceWorker(true)} className="font-medium underline">
        Reload
      </button>
      <button
        onClick={() => setNeedRefresh(false)}
        aria-label="Dismiss"
        className="opacity-70 hover:opacity-100"
      >
        ✕
      </button>
    </div>
  )
}
