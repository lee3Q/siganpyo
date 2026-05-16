# SiGanPyo (시간표) 프로젝트 로그

## 2026-05-07

### 개요
AI 연동 일일 플래너 PWA MVP 개발 완료.

### 아키텍처
- **데이터 흐름**: Claude 세션 → git push (data/YYYY-MM-DD.json) → GitHub Repo → PWA fetch → localStorage 병합 → 그리드 렌더링
- **백엔드 없음**: GitHub가 SSOT (Single Source of Truth)
- **3-layer 캐싱**: L1 메모리 TTLCache (5분) → L2 localStorage (24시간) → L3 GitHub Raw URL fetch

### 기술 스택
- Vite + React + TypeScript + Tailwind CSS
- shadcn/ui (Sheet, Tabs, Button, Checkbox 등)
- Zustand + Immer (상태관리)
- @dnd-kit/core + @dnd-kit/sortable (드래그앤드롭)
- vite-plugin-pwa + Workbox injectManifest

### 구현 내역

| AC | 내용 | 상태 |
|----|------|------|
| 1 | 프로젝트 초기 설정 (Vite+React+TS+Tailwind+shadcn/ui+Zustand+dnd-kit) | 완료 |
| 2 | 타임그리드 뷰 (6시~24시, 30분 슬롯, 현재시간 인디케이터) | 완료 |
| 3 | GitHub Raw URL fetch + 3-layer 캐싱 | 완료 |
| 4 | localStorage 병합 (로컬 편집 우선, CRUD) | 완료 |
| 5 | dnd-kit 드래그 이동/리사이즈 (15분 스냅) + 방향키 | 완료 |
| 6 | 슬라이드 패널 (메모/AI조언/체크리스트 탭) | 완료 |
| 7 | PWA manifest + Service Worker (오프라인, 홈추가) | 완료 |
| 8 | GitHub Pages 배포 | 완료 |

### Ouroboros 실행 기록
- 세션 ID: `orch_cd23f39e6d7c`
- 실행 시간: 약 3.5시간 (04:08 ~ 07:48 UTC)
- 처리 메시지: 2,163개 / 툴 콜: 631개
- 서브 AC: 20/23 완료, 3 실패 (API 리트라이로 인한 세션 복구 반복)
- AC 3에서 TypeScript 에러 수정 중 API 리트라이가 반복되며 실패
- 실패 후 직접接管: DnD 연동 + DetailPanel 컴포넌트 생성 + 빌드/배포 완료

### 배포 이슈 (2026-05-08)

- **원인**: `MobileEditSheet.tsx`에서 `grid` prop 선언 후 미사용 → `TS6133` 빌드 에러 → GitHub Actions 실패
- **수정**: unused prop + `GridDimensions` import 제거 (commit `35b1024`)
- **결과**: 빌드 성공, gh-pages 재배포 완료

### 배포
- GitHub: https://github.com/lee3Q/siganpyo
- Pages: https://lee3q.github.io/siganpyo/
- 배포 방식: gh-pages 브랜치 (dist/ 폴더)
- 비용: $0/월 (GitHub Pages 무료)
