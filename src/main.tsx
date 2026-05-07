import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// ── Service Worker 등록 ──
if ('serviceWorker' in navigator) {
  const updateSW = registerSW({
    onNeedRefresh() {
      // 새 콘텐츠 사용 가능 시 사용자에게 알림 (추후 UI 연동)
      console.log('[SW] 새 버전 사용 가능 — 새로고침으로 업데이트')
      if (confirm('새 버전이 있습니다. 업데이트할까요?')) {
        updateSW(true)
      }
    },
    onOfflineReady() {
      console.log('[SW] 오프라인 준비 완료')
    },
    onRegisteredSW(swUrl, registration) {
      console.log('[SW] 등록 완료:', swUrl)
      // 1시간마다 업데이트 확인
      if (registration) {
        setInterval(() => {
          registration.update()
        }, 60 * 60 * 1000)
      }
    },
    onRegisterError(error) {
      console.error('[SW] 등록 실패:', error)
    },
  })
}

