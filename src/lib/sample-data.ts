/**
 * Sample data utility for SiGanPyo development and testing.
 *
 * Generates realistic DaySchedule data that matches the expected JSON schema
 * from GitHub raw URLs. Use this to populate the grid during development
 * without needing an actual GitHub fetch.
 *
 * @example
 * ```ts
 * // In browser console or dev tools:
 * import { getSampleSchedule } from '@/lib/sample-data'
 * const schedule = getSampleSchedule('2026-05-07')
 * useScheduleStore.getState().setRemoteSchedule(schedule)
 * ```
 */

import type { DaySchedule, TimeBlock } from '@/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function todayString(): string {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

// ---------------------------------------------------------------------------
// Sample TimeBlocks — a typical day schedule
// ---------------------------------------------------------------------------

const SAMPLE_BLOCKS: Omit<TimeBlock, 'id'>[] = [
  {
    startTime: '06:30',
    endTime: '07:00',
    title: '기상 · 스트레칭',
    category: 'rest',
    color: 'yellow',
    notes: '가벼운 스트레칭 10분 + 물 한 잔',
    advice: '아침 일출을 보며 명상하면 하루 시작이 좋습니다.',
    checklist: [
      { text: '스트레칭', done: false },
      { text: '물 마시기', done: false },
    ],
    status: 'planned',
    source: 'ai',
  },
  {
    startTime: '07:00',
    endTime: '07:30',
    title: '아침 식사',
    category: 'rest',
    color: 'yellow',
    notes: '',
    advice: null,
    checklist: [],
    status: 'planned',
    source: 'ai',
  },
  {
    startTime: '08:00',
    endTime: '09:30',
    title: '딥워크 — 코딩',
    category: 'work',
    color: 'blue',
    notes: '## 오늘의 집중 작업\n- 기능 A 구현\n- 코드 리뷰 반영',
    advice: '딥워크 전 알림을 끄고 타이머를 설정하세요.',
    checklist: [
      { text: '기능 A 구현', done: false },
      { text: 'PR 리뷰 반영', done: false },
      { text: '테스트 작성', done: false },
    ],
    status: 'planned',
    source: 'ai',
  },
  {
    startTime: '09:30',
    endTime: '10:00',
    title: '이메일 · 슬랙 확인',
    category: 'work',
    color: 'gray',
    notes: '긴급 건만 처리',
    advice: null,
    checklist: [],
    status: 'planned',
    source: 'ai',
  },
  {
    startTime: '10:00',
    endTime: '11:00',
    title: '팀 스탠드업 · 회의',
    category: 'work',
    color: 'green',
    notes: '주간 진행 상황 공유',
    advice: '회의 전 3가지 핵심 포인트를 미리 정리해오세요.',
    checklist: [
      { text: '진행 상황 정리', done: false },
      { text: '블로커 공유', done: false },
    ],
    status: 'planned',
    source: 'ai',
  },
  {
    startTime: '11:00',
    endTime: '12:30',
    title: '기능 개발',
    category: 'work',
    color: 'blue',
    notes: '## 기능 B\n- API 연동\n- 에러 처리',
    advice: '복잡한 로직은 먼저 수도코드로 정리하세요.',
    checklist: [
      { text: 'API 연동', done: false },
      { text: '에러 처리', done: false },
    ],
    status: 'planned',
    source: 'ai',
  },
  {
    startTime: '12:30',
    endTime: '13:30',
    title: '점심 식사',
    category: 'rest',
    color: 'yellow',
    notes: '',
    advice: '식사 후 10분 가벼운 산책을 추천합니다.',
    checklist: [],
    status: 'planned',
    source: 'ai',
  },
  {
    startTime: '14:00',
    endTime: '15:30',
    title: '학습 · 읽기',
    category: 'study',
    color: 'purple',
    notes: '## 학습 주제\n- React Server Components\n- 새로운 상태 관리 패턴',
    advice: '학습 후 간단히 요약을 적어보세요.',
    checklist: [
      { text: 'RSC 아티클 읽기', done: false },
      { text: '요약 작성', done: false },
    ],
    status: 'planned',
    source: 'ai',
  },
  {
    startTime: '16:00',
    endTime: '17:00',
    title: '코드 리뷰',
    category: 'work',
    color: 'green',
    notes: '팀원 PR 리뷰',
    advice: '건설적인 피드백을 먼저 적어두세요.',
    checklist: [
      { text: 'PR #42 리뷰', done: false },
      { text: 'PR #43 리뷰', done: false },
    ],
    status: 'planned',
    source: 'ai',
  },
  {
    startTime: '17:30',
    endTime: '18:30',
    title: '운동',
    category: 'rest',
    color: 'red',
    notes: '헬스장 — 상체 위주',
    advice: '운동 전 워밍업 10분은 필수입니다.',
    checklist: [
      { text: '워밍업', done: false },
      { text: '벤치프레스 3세트', done: false },
      { text: '렛풀다운 3세트', done: false },
    ],
    status: 'planned',
    source: 'ai',
  },
  {
    startTime: '19:00',
    endTime: '20:00',
    title: '저녁 · 휴식',
    category: 'rest',
    color: 'yellow',
    notes: '',
    advice: null,
    checklist: [],
    status: 'planned',
    source: 'ai',
  },
  {
    startTime: '20:30',
    endTime: '22:00',
    title: '개인 프로젝트',
    category: 'work',
    color: 'blue',
    notes: '시간표 앱 개선 작업',
    advice: null,
    checklist: [
      { text: 'UI 개선', done: false },
      { text: '버그 수정', done: false },
    ],
    status: 'planned',
    source: 'ai',
  },
]

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a sample DaySchedule for a given date.
 * If no date is provided, uses today's date.
 */
export function getSampleSchedule(date?: string): DaySchedule {
  const d = date ?? todayString()

  const blocks: TimeBlock[] = SAMPLE_BLOCKS.map((block, index) => ({
    ...block,
    id: `sample-block-${index + 1}`,
  }))

  return {
    date: d,
    generated_at: new Date().toISOString(),
    blocks,
    meta: {
      version: 1,
      source: 'claude',
    },
  }
}

/**
 * Generate a minimal schedule with just a few blocks.
 * Useful for quick testing.
 */
export function getMinimalSchedule(date?: string): DaySchedule {
  const d = date ?? todayString()

  return {
    date: d,
    generated_at: new Date().toISOString(),
    blocks: [
      {
        id: 'mini-1',
        startTime: '09:00',
        endTime: '10:30',
        title: '팀 미팅',
        category: 'work',
        color: 'blue',
        notes: '',
        advice: '회의 전 아젠다를 확인하세요.',
        checklist: [
          { text: '아젠다 확인', done: false },
        ],
        status: 'planned',
        source: 'ai',
      },
      {
        id: 'mini-2',
        startTime: '11:00',
        endTime: '12:00',
        title: '코딩',
        category: 'work',
        color: 'green',
        notes: '## 오늘의 작업\n- 기능 구현',
        advice: '집중할 때 알림을 끄세요.',
        checklist: [
          { text: 'PR 리뷰', done: false },
          { text: '테스트 작성', done: false },
        ],
        status: 'planned',
        source: 'ai',
      },
    ],
    meta: { version: 1, source: 'claude' },
  }
}

/**
 * Inject sample data into the schedule store for development.
 * Call this from the browser console to populate the grid:
 *
 *   import { injectSampleData } from '@/lib/sample-data'
 *   injectSampleData()
 */
export function injectSampleData(): void {
  // Dynamic import to avoid circular deps in test environments
  import('@/stores/schedule-store').then(({ useScheduleStore }) => {
    const store = useScheduleStore.getState()
    const schedule = getSampleSchedule(store.currentDate)
    store.setRemoteSchedule(schedule)
    console.log(`[sample-data] Injected ${schedule.blocks.length} blocks for ${schedule.date}`)
  })
}
