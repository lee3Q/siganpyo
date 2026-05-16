# 시간표 (SiGanPyo)

AI 연동 일일 플래너 PWA. Claude 세션에서 생성한 계획을 타임그리드로 탐색·편집.

## 배포

- **앱**: https://lee3q.github.io/siganpyo/
- **레포**: https://github.com/lee3Q/siganpyo

## 기술 스택

- Vite + React + TypeScript + Tailwind CSS
- shadcn/ui, Zustand + Immer, @dnd-kit
- vite-plugin-pwa (Workbox injectManifest)
- GitHub Pages (gh-pages 브랜치)

## 데이터 흐름

```
Claude 세션 → JSON 생성 → git push → PWA fetch → localStorage 편집 병합
```

- 데이터 파일: `data/YYYY-MM-DD.json`
- 앱 내 AI 없음 (외부 Claude 세션에서 계획 생성)
- 오프라인 지원 (PWA Service Worker)

## 기능

- 30분 단위 타임그리드 (06:00~24:00)
- 방향키 / 드래그앤드롭 / 슬라이드 탐색
- GitHub JSON → 앱 자동 동기화
- localStorage 기반 로컬 편집 (병합)
- PWA 인스톨 가능

## 개발

```bash
npm install
npm run dev        # 개발 서버
npm run build      # 빌드
npm run preview    # 빌드 미리보기
npm run deploy     # gh-pages 배포
```

## 문서

- [PRD](./PRD.md)
- [개발 로그](./LOG.md)

---

$0/월 운영. GitHub Pages + 공개 레포.
