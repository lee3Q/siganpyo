/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope

import { clientsClaim, skipWaiting } from 'workbox-core'
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching'
import { registerRoute, NavigationRoute, setCatchHandler, setDefaultHandler } from 'workbox-routing'
import { NetworkFirst, CacheFirst, StaleWhileRevalidate } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'

// ──────────────────────────────────────────────
// App Shell 캐시 버전 관리
// ──────────────────────────────────────────────
// 새 배포 시 이 값을 올리면 activate에서 구버전 캐시가 자동 삭제됩니다.
const CACHE_VERSION = 1
const CACHE_NAME = `siganpyo-shell-v${CACHE_VERSION}`

// App Shell: 앱 로딩에 필수적인 정적 에셋 (해시 없는 고정 경로)
// 해시가 있는 JS/CSS/폰트 번들은 Workbox __WB_MANIFEST 프리캐시가 담당합니다.
const APP_SHELL_ASSETS = [
  './index.html',
  './manifest.webmanifest',
  './favicon.svg',
  './icon-192.png',
  './icon-512.png',
  './maskable-icon-192.png',
  './maskable-icon-512.png',
]

// ──────────────────────────────────────────────
// 라우팅 상수
// ──────────────────────────────────────────────

/**
 * GitHub Raw 데이터 캐시 (동적 콘텐츠 = network-first)
 *
 * NOTE: schedule-fetch.ts has its own 3-layer cache (L1 memory + L2 localStorage + L3 network).
 * This SW Cache API layer is a 4th layer that intercepts the actual HTTP fetch.
 * The app never reads from this SW cache directly — schedule-fetch.ts reads from memory/localStorage.
 * This is intentionally redundant: SW caches for offline resilience at the browser level,
 * while schedule-fetch.ts caches for fast synchronous access at the app level.
 */
const GITHUB_DATA_CACHE = 'siganpyo-github-data'

/** 정적 에셋 런타임 캐시 (cache-first) */
const STATIC_RUNTIME_CACHE = 'siganpyo-static-runtime'

/** 서드파티 CDN 캐시 (stale-while-revalidate) */
const CDN_CACHE = 'siganpyo-cdn'

// ──────────────────────────────────────────────
// Workbox 프리캐시 매니페스트 주입 (빌드 시 해시 기반 에셋 자동 수집)
// → JS/CSS/폰트/기타 정적 파일이 번들 해시와 함께 관리됩니다.
// ──────────────────────────────────────────────
precacheAndRoute(self.__WB_MANIFEST)

// SPA 네비게이션 요청 → index.html 반환 (모든 라우트를 SPA가 처리)
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')))

// ──────────────────────────────────────────────
// 라우팅 전략 ① — Network-First: GitHub Raw 데이터 (동적 콘텐츠)
// ──────────────────────────────────────────────
// 일일 스케줄 JSON 등 동적 데이터는 항상 최신을 우선.
// 5초 내 네트워크 응답 없으면 캐시로 폴백.
// ──────────────────────────────────────────────
registerRoute(
  ({ url }) => url.hostname === 'raw.githubusercontent.com',
  new NetworkFirst({
    cacheName: GITHUB_DATA_CACHE,
    networkTimeoutSeconds: 5,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 30, // 최대 30일치 데이터 보관
        maxAgeSeconds: 60 * 60 * 24 * 7, // 7일 후 만료
      }),
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  }),
)

// ──────────────────────────────────────────────
// 라우팅 전략 ② — Cache-First: 정적 에셋 (JS/CSS/폰트/이미지)
// ──────────────────────────────────────────────
// 프리캐시에 없는 동일 오리진 정적 리소스는 캐시 우선.
// 해시 기반 파일명이므로 콘텐츠 변경 시 새 URL로 요청됨.
// ──────────────────────────────────────────────
registerRoute(
  ({ request, url }) => {
    if (url.origin !== self.location.origin) return false
    const dest = request.destination
    return (
      dest === 'script' ||
      dest === 'style' ||
      dest === 'font' ||
      dest === 'image'
    )
  },
  new CacheFirst({
    cacheName: STATIC_RUNTIME_CACHE,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 60,
        maxAgeSeconds: 60 * 60 * 24 * 30, // 30일
      }),
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  }),
)

// ──────────────────────────────────────────────
// 라우팅 전략 ③ — Stale-While-Revalidate: 외부 CDN 리소스
// ──────────────────────────────────────────────
// 폰트 CDN 등 외부 리소스는 캐시 즉시 반환 + 백그라운드 갱신.
// ──────────────────────────────────────────────
registerRoute(
  ({ url }) => {
    const host = url.hostname
    return (
      host === 'fonts.googleapis.com' ||
      host === 'fonts.gstatic.com' ||
      host === 'cdn.jsdelivr.net'
    )
  },
  new StaleWhileRevalidate({
    cacheName: CDN_CACHE,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 30,
        maxAgeSeconds: 60 * 60 * 24 * 30, // 30일
      }),
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  }),
)

// ──────────────────────────────────────────────
// 오프라인 폴백 ① — 매칭된 라우트 핸들러 실패 시 (catch handler)
// ──────────────────────────────────────────────
// Workbox 라우트 핸들러가 에러를 throw 하면 이 핸들러가 대체 응답 제공.
// 예: network-first에서 네트워크 실패 + 캐시도 없는 경우
// ──────────────────────────────────────────────
setCatchHandler(async ({ request }) => {
  console.log(`[SW] Route handler failed for ${request.url}, using catch fallback`)

  // 네비게이션 → 캐시된 index.html (SPA 셸)
  if (request.mode === 'navigate') {
    const cached = await caches.match('index.html')
    if (cached) return cached
  }

  // GitHub Raw 데이터 → 빈 스케줄 JSON
  if (request.url.includes('raw.githubusercontent.com')) {
    return new Response(
      JSON.stringify({ date: '', blocks: [] }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }

  // 이미지 → 1x1 투명 SVG
  if (request.destination === 'image') {
    return new Response(
      '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>',
      { headers: { 'Content-Type': 'image/svg+xml' } },
    )
  }

  // 최종 — 503 오프라인 응답
  return new Response('Offline', {
    status: 503,
    statusText: 'Service Unavailable — Offline',
  })
})

// ──────────────────────────────────────────────
// 오프라인 폴백 ② — 매칭되는 라우트가 없는 요청 (default handler)
// ──────────────────────────────────────────────
// 위에 등록된 어떤 라우트와도 매칭되지 않는 요청의 기본 처리.
// 네트워크 우선 → 실패 시 캐시 검색 → 최종 오프라인 응답.
// ──────────────────────────────────────────────
setDefaultHandler(async ({ request }) => {
  try {
    // 네트워크 시도
    return await fetch(request)
  } catch {
    console.log(`[SW] Default handler — network failed for ${request.url}`)

    // 캐시에서 검색
    const cached = await caches.match(request)
    if (cached) return cached

    // 네비게이션 → SPA 셸
    if (request.mode === 'navigate') {
      const shell = await caches.match('index.html')
      if (shell) return shell
    }

    // 오프라인 응답
    return new Response('Offline', {
      status: 503,
      statusText: 'Service Unavailable — Offline',
    })
  }
})

// ──────────────────────────────────────────────
// Install: App Shell(html/css/js/폰트/아이콘) precache + 즉시 활성화
// ──────────────────────────────────────────────
self.addEventListener('install', (event) => {
  console.log(`[SW] Install — precaching App Shell (${CACHE_NAME})`)

  event.waitUntil(
    (async () => {
      // 1) 명시적 App Shell 에셋을 버전 관리 캐시에 저장
      const cache = await caches.open(CACHE_NAME)
      await cache.addAll(APP_SHELL_ASSETS)

      // 2) Workbox __WB_MANIFEST 프리캐시도 install 시점에 캐시됨
      //    (precacheAndRoute가 자동 처리)

      // 3) 대기 없이 즉시 활성화
      skipWaiting()
    })(),
  )
})

// ──────────────────────────────────────────────
// Activate: 구버전 캐시 삭제 + 클라이언트 제어 획득
// ──────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  console.log(`[SW] Activate — cleaning old caches (${CACHE_NAME})`)

  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys()

      // 현재 버전과 일치하지 않는 모든 커스텀 캐시를 삭제합니다.
      // (workbox-precache-v2-* 캐시는 cleanupOutdatedCaches가 관리)
      await Promise.all(
        cacheNames
          .filter((name) => {
            // Workbox 프리캐시는 전용 정리 함수에 위임
            if (name.startsWith('workbox-precache')) return false
            // 현재 App Shell 캐시는 유지
            if (name === CACHE_NAME) return false
            // 현재 버전의 런타임 캐시는 유지
            if (name === GITHUB_DATA_CACHE) return false
            if (name === STATIC_RUNTIME_CACHE) return false
            if (name === CDN_CACHE) return false
            // 그 외 모든 캐시는 구버전으로 간주하고 삭제
            return true
          })
          .map((name) => {
            console.log(`[SW] Deleting old cache: ${name}`)
            return caches.delete(name)
          }),
      )

      // 오래된 Workbox 프리캐시 정리
      cleanupOutdatedCaches()

      // 즉시 모든 클라이언트 제어 (새 SW가 페이지를 즉시 관리)
      await clientsClaim()
    })(),
  )
})
