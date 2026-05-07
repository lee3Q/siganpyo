# PRD: 시간표 (SiGanPyo)

> **최종 합성판** — Claude PRD + GPT PRD 비교 후 장점만 취합. 2026-05-07.

## 1. Overview

- **제품명**: 시간표 (SiGanPyo)
- **한 줄 설명**: 외부 Claude 세션이 생성한 시간 단위 일일 계획을, 스크롤 없는 그리드에서 드래그·방향키·스와이프로 직관적으로 탐색·수정하는 개인용 PWA
- **해결하는 문제**: 매일 계획은 세우지만 ① 입력이 번거롭고 ② 시각화·탐색이 불편해 실행 단계에서 놓치며 ③ 계획 수정이 자연스럽지 않아 결국 종이 플래너로 회귀함
- **핵심 가치 제안**: "Claude가 한 줄로 만든 하루를, 한 화면에서, 드래그 한 번으로 완성한다"

### 데이터 흐름 (제품 정체성)

```
[외부 Claude 세션]
   ↓ 자연어 대화로 하루 계획 생성
   ↓ git push (data/YYYY-MM-DD.json)
[GitHub Repo]
   ↓ raw.githubusercontent.com fetch
[PWA (시간표)]
   ↓ remote + localStorage 편집 병합
[그리드 렌더 + 사용자 직접 편집]
   ↓ localStorage 즉시 저장
[당일 한정 의미, GitHub 히스토리는 부산물]
```

이 흐름이 본 제품의 정체성이다. 앱 내부에 AI API 호출은 없다.

## 2. Target Users

- **주요 사용자**: 매일 시간 단위로 계획을 세우는 자기관리형 1인 사용자. Claude 같은 LLM과 대화하며 하루를 설계하는 데 익숙한 개발자/학생/프리랜서.
- **핵심 페인 포인트**:
  - 투두 앱에 일정 입력하는 데 시간이 너무 오래 걸림 → Claude 대화가 그 자체로 입력
  - 일정 변경/탐색이 부자연스러움 → 드래그·방향키·스와이프로 해결
  - 메모/조언과 일정이 분리되어 컨텍스트 전환 비용 큼 → 슬라이드 패널 단일화

## 3. Core User Scenarios

- **외부 AI 생성 → 자동 반영**: 사용자로서, Claude 세션에서 "내일 하루 계획 짜줘"라고 하고 Claude가 `data/2026-05-08.json`을 git push 하면, 다음날 아침 PWA를 열었을 때 자동으로 그날 계획이 그리드에 표시되길 원한다.
- **빠른 직접 편집**: 사용자로서, AI가 짠 계획을 드래그로 시간 이동하거나 방향키로 옮기고, 메모를 직접 추가하면 localStorage에 즉시 저장되길 원한다.
- **컨텍스트 슬라이드**: 사용자로서, 특정 블록을 클릭하면 슬라이드 패널이 열리고 좌우로 [메모] / [AI 조언] / [체크리스트] 탭을 넘기며 컨텍스트를 유지하고 싶다.
- **한눈 조망**: 사용자로서, 스크롤 없이 하루 전체를 한 화면에 보고 현재 시간을 즉시 인식하고 싶다.
- **오프라인 운용**: 사용자로서, 지하철·비행기 등 오프라인에서도 오늘 계획을 보고 편집할 수 있어야 한다.

## 4. Feature Specification

### Must-have (MVP)

**F1. 타임그리드 뷰 (Time Grid)**
- 사용자 설정 시간 범위(기본 6시~24시)를 세로로 분할, **30분 단위 슬롯**으로 표시. 현재 시간을 가로 라인 + 색상 하이라이트로 표시.
- 블록은 시작/끝 시간에 비례한 높이로 배치. viewport에 맞춰 자동 압축되어 스크롤 없음.
- **Acceptance**:
  - 데스크톱 1080p에서 18시간(36 슬롯)이 스크롤 없이 표시됨
  - 모바일에서는 시간 범위 자동 축소 또는 핀치줌 지원
  - 현재 시간 라인이 60초마다 갱신
  - 빈 슬롯 클릭 시 새 블록 생성

**F2. GitHub Raw URL 데이터 로드**
- 앱 시작 시 `https://raw.githubusercontent.com/{owner}/{repo}/{branch}/data/YYYY-MM-DD.json`에서 오늘 데이터 fetch.
- 5분 클라이언트 캐시 (rate limit 60/시간 회피).
- 데이터 없으면 빈 그리드 + "자유 시간" 상태로 시작.
- **Acceptance**:
  - 첫 로드 후 1초 이내 데이터 표시
  - 데이터 부재 시에도 그리드는 정상 렌더
  - 자정 넘어가면 자동으로 다음 날짜 로드

**F3. 로컬 편집 + 병합 렌더링**
- PWA 내에서 블록 추가/이동/리사이즈/삭제, 메모·체크리스트·상태 수정 모두 가능. 모든 편집은 `localStorage["edits-YYYY-MM-DD"]`에 즉시 저장.
- 렌더 시 GitHub remote + localStorage edits를 **병합**하여 표시. 충돌 시 **로컬 편집 우선**. 원본은 `data/conflicts/YYYY-MM-DD-backup.json`에 보존.
- **Acceptance**:
  - 편집 후 100ms 이내 localStorage 반영
  - 페이지 새로고침 후에도 편집 내역 유지
  - 다음 fetch에서 GitHub 데이터가 갱신되어도 로컬 편집은 보존

**F4. 드래그 & 방향키 편집**
- **dnd-kit**으로 드래그 이동/리사이즈, **15분 단위 스냅**.
- 방향키 ↑↓: 포커스된 블록을 시간 이동.
- 방향키 ←→: 인접 블록(또는 인접 시간대)으로 포커스 이동.
- Tab/Enter: 포커스 이동 / 패널 열기. ESC: 패널 닫기 / 포커스 해제.
- 모바일: 탭=선택, 드래그=이동, 롱프레스=수정 모드.
- **Acceptance**:
  - 키보드만으로 모든 편집 가능 (접근성)
  - 드래그 중 충돌(시간 겹침) 시 빨간 테두리
  - 60fps 유지

**F5. 슬라이드형 디테일 패널**
- 블록 클릭/탭 → 데스크톱은 우측, 모바일은 하단에서 슬라이드 인.
- 패널 내 탭: **[메모] / [AI 조언] / [체크리스트]**
- 좌우 스와이프(모바일) / ←→ 키(데스크톱)로 탭 전환.
- AI 조언은 GitHub JSON의 `advice` 필드를 표시 (Claude가 생성하여 함께 push). 사용자가 직접 수정 가능.
- 메모는 마크다운 렌더링.
- **Acceptance**:
  - 패널 열림/닫힘 200ms 이하
  - ESC로 닫힘

**F6. PWA + 오프라인**
- manifest.json + Service Worker. 홈 화면 추가 가능.
- 오프라인에서 마지막 캐시 데이터로 동작, "오프라인 모드" 배너 표시.
- **Acceptance**:
  - Lighthouse PWA 점수 90+
  - 오프라인에서 오늘 데이터 편집 가능
  - 모바일 홈 화면 추가 시 네이티브 앱처럼 동작

**F7. GitHub Pages 정적 배포**
- Vite 빌드 결과물을 GitHub Pages에 배포. GitHub Actions로 push 시 자동 배포.
- 공개 레포 사용 시 인증 불필요. Private 레포 시 PAT 또는 GitHub OAuth.
- **Acceptance**:
  - push 시 자동 배포 (GitHub Actions)
  - 공개 레포 모드에서 인증 없이 데이터 fetch 가능

### Should-have (v1.1)

- **앱 내 자연어 파싱** (Cmd+K → OpenAI/Claude API): 외부 세션 없이 앱에서 빠르게 블록 추가. 사용자 키 입력 방식.
- **GitHub 쓰기 동기화**: 편집 내역 debounce 5초 후 GitHub PUT 커밋. GitHub OAuth 인증 필요.
- 과거 날짜 조회 (날짜 네비게이터, 읽기 전용)
- AI 조언 실시간 생성 (블록당 "이 일정 잘 수행하려면...")
- 템플릿 저장/불러오기
- 상태 토글 (블록 완료/건너뜀 표시, 진행률 바)
- 다크 모드 (시스템 설정 따름)
- 키보드 단축키 가이드 오버레이
- 충돌 일정 시각적 표현 강화 (z-index 분할)
- 풀투리프레시 (모바일에서 GitHub 데이터 재fetch)

### Could-have (future)

- 주간 뷰 (7일 그리드)
- 통계 대시보드 (시간 사용 패턴 분석)
- 음성 입력 (Whisper API)
- 공유 (오늘 계획 이미지 export)
- 캘린더 양방향 동기 (Google Calendar)
- 협업/공유 모드

## 5. Tech Stack & Decisions

| Layer | 선택 | 이유 (이 제품에 한정) | 대안 |
|-------|------|----------------------|------|
| **Frontend** | **Vite + React + TypeScript** | GitHub Pages 정적 호스팅 요구사항에 부합. SSR 불필요. 타임그리드의 복잡한 상태/드래그/키보드 인터랙션은 컴포넌트화가 필수라 Vanilla JS는 한계. TS는 TimeBlock 데이터 일관성 보장. | Next.js (static export) — SSR 미사용 시 오버헤드 |
| **스타일링** | **Tailwind CSS + shadcn/ui** | 30분 단위 그리드의 정밀 레이아웃을 utility-first로 빠르게 조정. shadcn은 Sheet(슬라이드 패널)/Tabs 등 그대로 사용. | CSS Modules — 컴포넌트 prebuilt 없음 |
| **상태 관리** | **Zustand + Immer** | 드래그/키보드 편집은 빈번한 부분 업데이트 발생. Zustand의 단순함 + Immer의 immutable 편집이 블록 조작에 최적. localStorage persist 미들웨어 기본 제공. | Jotai — atom 단위가 좋지만 그리드 단일 상태에는 Zustand가 단순 |
| **드래그** | **dnd-kit** | 키보드 접근성 기본 지원(`useSortableKeyboardCoordinates`), 터치/마우스 통합, 시간 그리드 커스텀 컬리전에 유연. 15분 스냅 구현이 깔끔. | react-dnd — 접근성 약하고 모바일 터치 지원 부족 |
| **Backend** | **없음 (서버리스)** | 외부 Claude가 사실상의 입력 백엔드, GitHub이 사실상의 저장 백엔드. 추가 서버는 모두 중복. | Cloudflare Workers — AI 키 프록시 필요시만 |
| **데이터 소스** | **GitHub Raw URL fetch** | 공개 레포에서 인증 없이 fetch 가능. CDN 캐시되어 빠름. Claude가 git push로 업데이트하는 워크플로와 자연스럽게 정합. | GitHub Contents API — 인증 필요, rate limit 더 빡빡 |
| **로컬 저장** | **localStorage** | 일별 편집 데이터는 수 KB로 5MB 한도와 무관. 동기적 API라 드래그 중 즉시 저장 가능. | IndexedDB — 비동기 복잡도만 증가 |
| **Auth** | **MVP: 없음 (공개 레포)** | 본인 사용 + 공개 레포면 인증 불필요. | v1.1: GitHub OAuth Device Flow 또는 PAT |
| **AI** | **없음 (외부 Claude 세션)** | 사용자가 이미 Claude를 쓰고 있고, 자연어 대화 → JSON 생성은 Claude가 git push까지 해주면 끝. 앱이 AI API를 호출할 필요 자체가 없음. | v1.1에서 앱 내 OpenAI API 추가 |
| **Hosting** | **GitHub Pages** | 사용자 명시 요구. 무료. 데이터 레포와 같은 GitHub 생태계 안에서 완결. | Cloudflare Pages — 빌드 빠르나 GitHub 단일화 이점 약화 |
| **배포 자동화** | **GitHub Actions** | `gh-pages` 브랜치 자동 배포. 무료. | 수동 빌드 push |
| **모니터링** | **Sentry (free tier, 선택)** | 드래그/키보드 인터랙션 버그 추적. 본인 사용이면 생략 가능. | 생략 |

### 핵심 결정 보충

**왜 Vanilla JS가 아닌 Vite+React+TS인가?**
본 제품의 핵심 가치는 ① 드래그 ② 키보드 내비 ③ 슬라이드 패널 탭 전환 ④ remote/local 병합 렌더 — 모두 상태 관리와 컴포넌트화가 필수. Vanilla로는 dnd-kit 활용이 불가능하고 유지보수가 빠르게 무너진다. Vite는 빌드 산출물이 정적 파일이라 GitHub Pages 호스팅과 100% 호환.

**왜 앱 내 AI 파싱을 MVP에서 제외하는가?**
사용자의 워크플로(외부 Claude 세션 → git push)가 이미 더 강력한 AI 입력이다. Cmd+K 자연어 파싱은 그 위에 얹는 편의 기능. API 키 노출 문제, 비용, 프록시 도입 부담을 모두 회피. v1.1에서 사용자 키 입력 방식으로 추가하면 충분.

**왜 DB가 없는가?**
GitHub repo가 단일 진실 공급원(SSOT). DB 도입 시 GitHub 동기화와 이중 정합성 문제 발생. 당일 데이터는 당일에만 의미 있지만, GitHub 히스토리에 영구 보존되는 것은 자연스러운 부산물이며 별도 비용 없음.

### Estimated monthly cost (MVP scale, 본인 1인 사용 기준)

- GitHub Pages: **$0**
- GitHub raw URL fetch: **$0** (공개 레포 무인증, CDN)
- Claude 사용료: 별도 (사용자가 이미 쓰고 있는 것, 앱 비용 아님)
- Sentry: **$0** (선택)
- **합계: $0/month**

## 6. Data Model

```
DaySchedule (data/YYYY-MM-DD.json — Claude가 git push)
  - date: "2026-05-08"
  - generated_at: "2026-05-07T22:00:00Z"
  - blocks: TimeBlock[]
  - meta: { version, source: "claude" | "manual" }

TimeBlock
  - id: string (uuid 또는 "hour-09-30" 같은 결정적 키)
  - startTime: "09:00"
  - endTime: "10:30"
  - title: string
  - category: string | null        // "work" | "study" | "rest" | ...
  - color: "blue" | "green" | "red" | "yellow" | "purple" | "gray"
  - notes: string (markdown)
  - advice: string | null          // Claude가 함께 생성한 조언
  - checklist: { text: string, done: boolean }[]
  - status: "planned" | "in_progress" | "done" | "skipped"
  - source: "ai" | "manual"

LocalEdit (localStorage key: "edits-YYYY-MM-DD")
  - date: string
  - edits: { [blockId: string]: Partial<TimeBlock> }
  - additions: TimeBlock[]         // 사용자가 PWA에서 추가한 블록
  - deletions: string[]            // 삭제된 blockId
  - updated_at: string

UserConfig (localStorage key: "config")
  - dayStartHour: number (default 6)
  - dayEndHour: number (default 24)
  - repoOwner: string
  - repoName: string
  - branch: string (default "main")
  - theme: "light" | "dark" | "system"
```

**관계**: DaySchedule 1 : N TimeBlock. LocalEdit는 같은 날짜의 DaySchedule에 오버레이.

**병합 규칙** (`mergeSchedule(remote, local) → TimeBlock[]`):
1. remote.blocks를 ID로 인덱싱
2. `local.edits[blockId]`를 overlay → 부분 덮어쓰기
3. `local.additions`를 append
4. `local.deletions`를 filter-out
5. 충돌(같은 blockId, 다른 내용) → 로컬 우선, 원본을 `data/conflicts/YYYY-MM-DD-backup.json`에 보존

## 7. API Design (Key Operations)

REST API 없음. 클라이언트 함수 인터페이스:

```
// === 데이터 로드 ===
fetchDayFromGitHub(date: string)
  → GET https://raw.githubusercontent.com/{owner}/{repo}/{branch}/data/{date}.json
  → returns DaySchedule | null
  → 5분 메모리 캐시 + Service Worker 캐시

loadLocalEdits(date: string)
  → localStorage.getItem(`edits-${date}`)
  → returns LocalEdit | null

mergeSchedule(remote: DaySchedule, local: LocalEdit)
  → returns TimeBlock[] (렌더용 최종 블록 배열)

// === 편집 (모두 localStorage 즉시 반영) ===
addBlock(block: TimeBlock)
moveBlock(id, newStartTime)
resizeBlock(id, newEndTime)
deleteBlock(id)
updateBlockField(id, field, value)
toggleChecklistItem(blockId, index)

// === 네비게이션 ===
navigateToDate(date: string)          // 자정 자동 전환 포함
focusNextBlock(direction: "up"|"down"|"left"|"right")
openDetailPanel(blockId)
closeDetailPanel()
switchPanelTab(direction: "left"|"right")

// === GitHub 쓰기 (v1.1) ===
syncToRemote(date: string)
  → PUT api.github.com/repos/{owner}/{repo}/contents/data/{date}.json
  → debounce 5초, OAuth 필요
```

## 8. Non-functional Requirements

**Performance**
- 초기 로드: 2초 이하 (정적 HTML + CDN)
- GitHub fetch 후 첫 렌더: 1초 이내
- 드래그/키보드 응답: 16ms (60fps)
- 패널 애니메이션: 200ms 이하
- localStorage 쓰기: 100ms 이하

**Security**
- MVP: 공개 레포 사용. 민감 정보 저장 금지.
- v1.1: Private 레포 지원 시 GitHub OAuth (`repo` scope), 토큰은 localStorage 저장.
- HTTPS 강제 (GitHub Pages 기본).

**Scalability**
- 1인 사용 → 확장 불요.
- 공개 배포 시 사용자별 자기 레포라 자동 분산.
- 병목: GitHub raw URL rate limit 60/시간(무인증) → 5분 캐시로 회피.

**Accessibility**
- 키보드 전용 조작 가능 (방향키, Tab, Enter, ESC)
- ARIA labels on time blocks (예: "9시 30분, 회의, 60분간")
- 색상 외 텍스트/패턴으로도 상태 표시 (충돌, 완료)
- `prefers-reduced-motion` 존중 (애니메이션 최소화)

**i18n**: 한국어 우선, MVP에서 i18n 미적용.

## 9. Edge Cases & Risks

**Edge cases**
1. **GitHub JSON이 없는 날** → 빈 그리드, "자유 시간" 상태. 사용자가 직접 블록 추가 가능.
2. **로컬 편집 + remote 갱신 충돌** → 로컬 편집 우선. blockId 기준 병합. 사용자에게 "Claude가 새 계획을 push했음" 토스트 + "원본 보기" 옵션.
3. **자정 넘는 일정** (예: 23:00–02:00) → 두 블록으로 분할 저장. MVP는 분할 방식.
4. **자정 도달** → 자동으로 다음 날짜 데이터 로드, localStorage 키도 새 날짜로 전환. 전날 편집은 그대로 보존.
5. **시간 겹침(중복 블록)** → 시각적으로 좌우 분할 또는 빨간 테두리 경고. 저장은 허용.
6. **GitHub raw rate limit (60/시간)** → 5분 메모리 캐시 + Service Worker 캐시로 회피. 한도 초과 시 캐시된 데이터로 폴백.
7. **localStorage 용량 (5–10MB)** → 일별 편집 수 KB라 무관. 7일치만 유지(이전은 자동 삭제). GitHub에 영구 보존되므로 손실 없음.
8. **네트워크 실패** → Service Worker 캐시로 동작, "오프라인 모드" 배너. 편집은 localStorage에 정상 저장.
9. **AI 조언 부재** (Claude가 advice 필드 없이 push) → 패널 탭에 "조언 없음" 빈 상태 표시.

**Technical risks**
1. **외부 Claude 워크플로 의존성**: 사용자가 매번 git push하는 게 번거로울 수 있음 → MITIGATION: Claude에게 "계획 생성 + git push" 스크립트를 한 번 세팅. v1.1에서 앱 내 자연어 파싱 추가로 보완.
2. **드래그/그리드 복잡도**: dnd-kit + 30분 슬롯 그리드는 커스텀 컬리전 로직 필요 → MITIGATION: dnd-kit SortableContext 예제로 기반 구축.
3. **Service Worker 캐시 오염**: 잘못된 버전이 캐시되면 업데이트 안 됨 → MITIGATION: versioned cache name + skipWaiting + clients.claim.
4. **충돌 데이터 유실**: 로컬 우선 정책으로 remote 변경이 묻힐 수 있음 → MITIGATION: 충돌 감지 시 토스트 + 원본 JSON 보기 + conflicts/ 폴더 백업.

## 10. Milestones

| Phase | Scope | 비고 |
|-------|-------|------|
| MVP | F1–F7 (그리드, fetch, 로컬편집, 드래그·키보드, 슬라이드 패널, PWA, GH Pages) | **품질 우선, 기간 무관** |
| v1.1 | 앱 내 자연어 파싱(Cmd+K), GitHub 쓰기 동기화, 과거 조회, 템플릿, 다크모드 | MVP 안정화 후 |
| v2 | 주간 뷰, 통계, 음성 입력, 캘린더 동기 | TBD |

## 11. Assumptions

1. **사용자는 Claude 세션에 능숙**하다. 자연어 대화로 하루 계획을 만들고 git push 하는 흐름이 부담스럽지 않다.
2. **데이터 레포는 공개**한다. 개인 일정 민감도가 낮다고 가정.
3. **사용 규모**는 본인 1인. 6개월 내 수십 명 이내 비공개 공유 가능성.
4. **데스크톱 + 모바일 동등 지원**이지만 그리드 밀도상 데스크톱이 1순위 경험. 모바일은 시간 범위 자동 축소로 대응.
5. **당일 데이터 철학**: 당일 계획은 당일에만 의미. GitHub 히스토리 영구 보존은 부산물.
6. **언어**: 한국어 단일.

## 12. Open Questions

1. **시간 겹침 정책**: 사용자가 의도적으로 겹쳐 짠 일정(예: "회의 들으며 메일 정리")을 허용할지, 강제 분리할지?
2. **자정 넘는 일정 표시**: 두 블록 분할 vs 끝 시간을 25:00 같은 가상 시간으로 표시 vs 다음 날까지 한 블록 — 어느 쪽이 직관적?
3. **블록 색상**: Claude가 카테고리 추론해서 자동 지정 vs 사용자 수동 지정 vs 카테고리별 고정 매핑?
4. **상태 변경 (planned/in_progress/done)**: 사용자가 매번 직접 토글 vs 시간 흐름에 따라 자동 전환?
5. **공개 배포 시점**: 본인 사용에 만족한 후 어느 단계에서 다른 사용자에게도 공개할지? (공개 시점에 OAuth와 키 보호 도입 필요)
