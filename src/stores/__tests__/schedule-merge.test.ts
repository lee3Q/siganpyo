/**
 * Tests for the schedule data binding pipeline:
 *   getMergedBlocks() — merge remote schedule + local edits → sorted TimeBlock[]
 *
 * Validates:
 * - Remote-only data renders correctly
 * - Local additions are appended
 * - Local edits overlay remote blocks
 * - Local deletions filter out remote blocks
 * - Combined merge respects all rules
 * - Empty states handled correctly
 * - Sorting by startTime
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useScheduleStore } from '../schedule-store'
import type { DaySchedule, LocalEdit, TimeBlock } from '@/types'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makeBlock = (overrides: Partial<TimeBlock> = {}): TimeBlock => ({
  id: `block-${Math.random().toString(36).slice(2, 8)}`,
  startTime: '09:00',
  endTime: '10:00',
  title: '테스트 블록',
  category: null,
  color: 'blue',
  notes: '',
  advice: null,
  checklist: [],
  status: 'planned',
  source: 'ai',
  ...overrides,
})

const makeSchedule = (blocks: TimeBlock[] = []): DaySchedule => ({
  date: '2026-05-07',
  generated_at: '2026-05-07T00:00:00Z',
  blocks,
  meta: { version: 1, source: 'claude' },
})

// Sample blocks for testing
const block1 = makeBlock({
  id: 'block-1',
  startTime: '09:00',
  endTime: '10:30',
  title: '팀 미팅',
  category: 'work',
  color: 'blue',
})

const block2 = makeBlock({
  id: 'block-2',
  startTime: '11:00',
  endTime: '12:00',
  title: '코딩',
  category: 'work',
  color: 'green',
})

const block3 = makeBlock({
  id: 'block-3',
  startTime: '13:00',
  endTime: '14:00',
  title: '점심',
  category: 'rest',
  color: 'yellow',
})

const localBlock = makeBlock({
  id: 'local-1',
  startTime: '15:00',
  endTime: '16:00',
  title: '사용자 추가 블록',
  color: 'purple',
  source: 'manual',
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('schedule-store: getMergedBlocks (data binding)', () => {
  beforeEach(() => {
    // Reset the store to a known state before each test
    const store = useScheduleStore.getState()
    store.reset()

    // Clear localStorage
    localStorage.clear()
  })

  // ---- No data at all ----

  describe('empty state', () => {
    it('returns empty array when no remote schedule and no local edits', () => {
      const store = useScheduleStore.getState()
      store.setRemoteSchedule(null)

      const blocks = store.getMergedBlocks()
      expect(blocks).toEqual([])
    })

    it('returns empty array when remote schedule has empty blocks and no local edits', () => {
      const store = useScheduleStore.getState()
      store.setRemoteSchedule(makeSchedule([]))

      const blocks = store.getMergedBlocks()
      expect(blocks).toEqual([])
    })
  })

  // ---- Remote-only data ----

  describe('remote data only', () => {
    it('returns remote blocks as-is when no local edits', () => {
      const store = useScheduleStore.getState()
      store.setRemoteSchedule(makeSchedule([block1, block2, block3]))

      const blocks = store.getMergedBlocks()

      expect(blocks).toHaveLength(3)
      expect(blocks[0].id).toBe('block-1')
      expect(blocks[1].id).toBe('block-2')
      expect(blocks[2].id).toBe('block-3')
    })

    it('sorts remote blocks by startTime', () => {
      const store = useScheduleStore.getState()
      // Put in reverse order
      store.setRemoteSchedule(makeSchedule([block3, block1, block2]))

      const blocks = store.getMergedBlocks()

      expect(blocks[0].startTime).toBe('09:00') // block1
      expect(blocks[1].startTime).toBe('11:00') // block2
      expect(blocks[2].startTime).toBe('13:00') // block3
    })
  })

  // ---- Local additions only ----

  describe('local additions only', () => {
    it('returns local additions when no remote schedule', () => {
      const store = useScheduleStore.getState()
      store.setRemoteSchedule(null)

      // Simulate adding a block
      const blockId = store.addBlock({
        startTime: '14:00',
        endTime: '15:00',
        title: '새 블록',
        category: null,
        color: 'purple',
        notes: '',
        advice: null,
        checklist: [],
        status: 'planned',
        source: 'manual',
      })

      const blocks = store.getMergedBlocks()
      expect(blocks).toHaveLength(1)
      expect(blocks[0].id).toBe(blockId)
      expect(blocks[0].title).toBe('새 블록')
      expect(blocks[0].source).toBe('manual')
    })

    it('returns multiple local additions sorted by startTime', () => {
      const store = useScheduleStore.getState()
      store.setRemoteSchedule(null)

      store.addBlock({
        startTime: '15:00',
        endTime: '16:00',
        title: '늦은 일정',
        category: null,
        color: 'purple',
        notes: '',
        advice: null,
        checklist: [],
        status: 'planned',
        source: 'manual',
      })

      store.addBlock({
        startTime: '09:00',
        endTime: '10:00',
        title: '이른 일정',
        category: null,
        color: 'blue',
        notes: '',
        advice: null,
        checklist: [],
        status: 'planned',
        source: 'manual',
      })

      const blocks = store.getMergedBlocks()
      expect(blocks).toHaveLength(2)
      expect(blocks[0].startTime).toBe('09:00')
      expect(blocks[1].startTime).toBe('15:00')
    })
  })

  // ---- Remote + Local merge ----

  describe('remote + local additions', () => {
    it('appends local additions after remote blocks (then sorts)', () => {
      const store = useScheduleStore.getState()
      store.setRemoteSchedule(makeSchedule([block1, block2]))

      // Add a local block that falls between block1 and block2
      store.addBlock({
        startTime: '10:30',
        endTime: '11:00',
        title: '중간 블록',
        category: null,
        color: 'purple',
        notes: '',
        advice: null,
        checklist: [],
        status: 'planned',
        source: 'manual',
      })

      const blocks = store.getMergedBlocks()
      expect(blocks).toHaveLength(3)
      // Should be sorted by startTime
      expect(blocks[0].id).toBe('block-1')    // 09:00
      expect(blocks[1].title).toBe('중간 블록') // 10:30
      expect(blocks[2].id).toBe('block-2')    // 11:00
    })
  })

  // ---- Local edits overlay ----

  describe('local edits overlay', () => {
    it('applies partial edit to remote block', () => {
      const store = useScheduleStore.getState()
      store.setRemoteSchedule(makeSchedule([block1]))

      // Move block-1 to a later time
      store.moveBlock('block-1', '10:00')

      const blocks = store.getMergedBlocks()
      expect(blocks).toHaveLength(1)
      expect(blocks[0].id).toBe('block-1')
      expect(blocks[0].startTime).toBe('10:00')
      // Duration preserved (was 90 min: 09:00-10:30)
      expect(blocks[0].endTime).toBe('11:30')
      // Other fields preserved
      expect(blocks[0].title).toBe('팀 미팅')
    })

    it('applies field update to remote block', () => {
      const store = useScheduleStore.getState()
      store.setRemoteSchedule(makeSchedule([block1]))

      store.updateBlockField('block-1', 'title', '변경된 미팅')
      store.updateBlockField('block-1', 'status', 'done')

      const blocks = store.getMergedBlocks()
      expect(blocks[0].title).toBe('변경된 미팅')
      expect(blocks[0].status).toBe('done')
    })

    it('preserves original remote data for unedited fields', () => {
      const store = useScheduleStore.getState()
      store.setRemoteSchedule(makeSchedule([block2]))

      // Only change title
      store.updateBlockField('block-2', 'title', '수정된 코딩')

      const blocks = store.getMergedBlocks()
      expect(blocks[0].title).toBe('수정된 코딩')
      expect(blocks[0].category).toBe('work')
      expect(blocks[0].color).toBe('green')
      expect(blocks[0].startTime).toBe('11:00')
      expect(blocks[0].endTime).toBe('12:00')
    })
  })

  // ---- Local deletions ----

  describe('local deletions', () => {
    it('removes remote block from merged result', () => {
      const store = useScheduleStore.getState()
      store.setRemoteSchedule(makeSchedule([block1, block2, block3]))

      store.deleteBlock('block-2')

      const blocks = store.getMergedBlocks()
      expect(blocks).toHaveLength(2)
      expect(blocks.map((b) => b.id)).toEqual(['block-1', 'block-3'])
    })

    it('removes local addition directly', () => {
      const store = useScheduleStore.getState()
      store.setRemoteSchedule(makeSchedule([block1]))

      const localId = store.addBlock({
        startTime: '14:00',
        endTime: '15:00',
        title: '임시 블록',
        category: null,
        color: 'gray',
        notes: '',
        advice: null,
        checklist: [],
        status: 'planned',
        source: 'manual',
      })

      // Should have 2 blocks
      expect(store.getMergedBlocks()).toHaveLength(2)

      // Delete the local addition
      store.deleteBlock(localId)

      const blocks = store.getMergedBlocks()
      expect(blocks).toHaveLength(1)
      expect(blocks[0].id).toBe('block-1')
    })
  })

  // ---- Combined operations ----

  describe('combined operations', () => {
    it('handles edit + delete + addition simultaneously', () => {
      const store = useScheduleStore.getState()
      store.setRemoteSchedule(makeSchedule([block1, block2, block3]))

      // Edit block-1
      store.updateBlockField('block-1', 'title', '수정된 미팅')

      // Delete block-2
      store.deleteBlock('block-2')

      // Add local block
      store.addBlock({
        startTime: '16:00',
        endTime: '17:00',
        title: '추가 회의',
        category: 'work',
        color: 'red',
        notes: '',
        advice: null,
        checklist: [],
        status: 'planned',
        source: 'manual',
      })

      const blocks = store.getMergedBlocks()
      expect(blocks).toHaveLength(3)

      // Sorted by startTime
      expect(blocks[0].id).toBe('block-1')
      expect(blocks[0].title).toBe('수정된 미팅')
      expect(blocks[1].id).toBe('block-3')
      expect(blocks[2].title).toBe('추가 회의')
    })

    it('preserves local edit through re-render (useMemo dependency)', () => {
      const store = useScheduleStore.getState()
      store.setRemoteSchedule(makeSchedule([block1]))

      store.updateBlockField('block-1', 'title', '지속되는 수정')

      // Call getMergedBlocks multiple times (simulating re-renders)
      const first = store.getMergedBlocks()
      const second = store.getMergedBlocks()

      expect(first).toEqual(second)
      expect(first[0].title).toBe('지속되는 수정')
    })
  })

  // ---- Data binding correctness ----

  describe('data binding correctness', () => {
    it('correctly merges checklist items from remote', () => {
      const blockWithChecklist = makeBlock({
        id: 'check-block',
        checklist: [
          { text: '할 일 1', done: false },
          { text: '할 일 2', done: true },
        ],
      })

      const store = useScheduleStore.getState()
      store.setRemoteSchedule(makeSchedule([blockWithChecklist]))

      const blocks = store.getMergedBlocks()
      expect(blocks[0].checklist).toHaveLength(2)
      expect(blocks[0].checklist[0].done).toBe(false)
      expect(blocks[0].checklist[1].done).toBe(true)
    })

    it('correctly merges advice field from remote', () => {
      const blockWithAdvice = makeBlock({
        id: 'advice-block',
        advice: '휴식을 충분히 취하세요.',
      })

      const store = useScheduleStore.getState()
      store.setRemoteSchedule(makeSchedule([blockWithAdvice]))

      const blocks = store.getMergedBlocks()
      expect(blocks[0].advice).toBe('휴식을 충분히 취하세요.')
    })

    it('correctly maps notes with markdown content', () => {
      const blockWithNotes = makeBlock({
        id: 'notes-block',
        notes: '## 오늘의 작업\n- 기능 구현\n- 버그 수정',
      })

      const store = useScheduleStore.getState()
      store.setRemoteSchedule(makeSchedule([blockWithNotes]))

      const blocks = store.getMergedBlocks()
      expect(blocks[0].notes).toContain('## 오늘의 작업')
      expect(blocks[0].notes).toContain('- 기능 구현')
    })

    it('correctly preserves all color types', () => {
      const coloredBlocks = ['blue', 'green', 'red', 'yellow', 'purple', 'gray'].map(
        (color, i) => makeBlock({
          id: `color-${color}`,
          startTime: `${String(6 + i).padStart(2, '0')}:00`,
          endTime: `${String(6 + i).padStart(2, '0')}:30`,
          color: color as TimeBlock['color'],
          title: `${color} 블록`,
        }),
      )

      const store = useScheduleStore.getState()
      store.setRemoteSchedule(makeSchedule(coloredBlocks))

      const blocks = store.getMergedBlocks()
      expect(blocks).toHaveLength(6)
      for (const block of blocks) {
        expect(['blue', 'green', 'red', 'yellow', 'purple', 'gray']).toContain(block.color)
      }
    })

    it('correctly preserves all status types', () => {
      const statuses = ['planned', 'in_progress', 'done', 'skipped'] as const
      const statusBlocks = statuses.map((status, i) =>
        makeBlock({
          id: `status-${status}`,
          startTime: `${String(6 + i).padStart(2, '0')}:00`,
          endTime: `${String(6 + i).padStart(2, '0')}:30`,
          status,
          title: `${status} 블록`,
        }),
      )

      const store = useScheduleStore.getState()
      store.setRemoteSchedule(makeSchedule(statusBlocks))

      const blocks = store.getMergedBlocks()
      expect(blocks).toHaveLength(4)
      for (const block of blocks) {
        expect(statuses).toContain(block.status)
      }
    })

    it('correctly preserves source field (ai vs manual)', () => {
      const store = useScheduleStore.getState()
      store.setRemoteSchedule(makeSchedule([
        makeBlock({ id: 'ai-block', source: 'ai', title: 'AI 블록' }),
      ]))

      store.addBlock({
        startTime: '15:00',
        endTime: '16:00',
        title: '수동 블록',
        category: null,
        color: 'gray',
        notes: '',
        advice: null,
        checklist: [],
        status: 'planned',
        source: 'manual',
      })

      const blocks = store.getMergedBlocks()
      expect(blocks).toHaveLength(2)
      expect(blocks.find((b) => b.title === 'AI 블록')?.source).toBe('ai')
      expect(blocks.find((b) => b.title === '수동 블록')?.source).toBe('manual')
    })
  })

  // ---- localStorage persistence ----

  describe('localStorage persistence', () => {
    it('persists edits to localStorage on each mutation', () => {
      const store = useScheduleStore.getState()
      store.setRemoteSchedule(makeSchedule([block1]))

      store.updateBlockField('block-1', 'title', '영구 제목')

      // Check localStorage was written
      const date = store.currentDate
      const stored = localStorage.getItem(`edits-${date}`)
      expect(stored).not.toBeNull()

      const parsed = JSON.parse(stored!)
      expect(parsed.edits['block-1']).toBeDefined()
      expect(parsed.edits['block-1'].title).toBe('영구 제목')
    })

    it('restores local edits from localStorage on store init', () => {
      const date = '2026-05-07'

      // Pre-populate localStorage
      const edit: LocalEdit = {
        date,
        edits: {
          'block-1': { title: '복원된 제목' },
        },
        additions: [localBlock],
        deletions: ['block-2'],
        updated_at: new Date().toISOString(),
      }
      localStorage.setItem(`edits-${date}`, JSON.stringify(edit))

      // Create a fresh store with the edits
      const store = useScheduleStore.getState()
      store.navigateToDate(date)
      store.setRemoteSchedule(makeSchedule([block1, block2]))

      const blocks = store.getMergedBlocks()
      // block-1 has edited title, block-2 is deleted, localBlock is added
      expect(blocks).toHaveLength(2)
      expect(blocks.find((b) => b.id === 'block-1')?.title).toBe('복원된 제목')
      expect(blocks.find((b) => b.id === 'local-1')).toBeDefined()
      expect(blocks.find((b) => b.id === 'block-2')).toBeUndefined()
    })
  })

  // ---- Edge cases ----

  describe('edge cases', () => {
    it('handles blocks spanning exactly one slot (30 min)', () => {
      const shortBlock = makeBlock({
        id: 'short',
        startTime: '09:00',
        endTime: '09:30',
      })

      const store = useScheduleStore.getState()
      store.setRemoteSchedule(makeSchedule([shortBlock]))

      const blocks = store.getMergedBlocks()
      expect(blocks).toHaveLength(1)
      expect(blocks[0].startTime).toBe('09:00')
      expect(blocks[0].endTime).toBe('09:30')
    })

    it('handles blocks at grid boundaries (start/end of day)', () => {
      const earlyBlock = makeBlock({
        id: 'early',
        startTime: '06:00',
        endTime: '07:00',
      })
      const lateBlock = makeBlock({
        id: 'late',
        startTime: '23:00',
        endTime: '24:00',
      })

      const store = useScheduleStore.getState()
      store.setRemoteSchedule(makeSchedule([earlyBlock, lateBlock]))

      const blocks = store.getMergedBlocks()
      expect(blocks).toHaveLength(2)
      expect(blocks[0].startTime).toBe('06:00')
      expect(blocks[1].startTime).toBe('23:00')
    })

    it('handles overlapping time blocks (allowed by design)', () => {
      const overlapping1 = makeBlock({
        id: 'overlap-1',
        startTime: '09:00',
        endTime: '11:00',
      })
      const overlapping2 = makeBlock({
        id: 'overlap-2',
        startTime: '10:00',
        endTime: '12:00',
      })

      const store = useScheduleStore.getState()
      store.setRemoteSchedule(makeSchedule([overlapping1, overlapping2]))

      const blocks = store.getMergedBlocks()
      expect(blocks).toHaveLength(2)
      // Both blocks present (overlap allowed)
    })

    it('handles deleting a non-existent block gracefully', () => {
      const store = useScheduleStore.getState()
      store.setRemoteSchedule(makeSchedule([block1]))

      // Should not throw
      store.deleteBlock('non-existent-id')

      const blocks = store.getMergedBlocks()
      expect(blocks).toHaveLength(1)
      expect(blocks[0].id).toBe('block-1')
    })

    it('handles editing a non-existent block gracefully', () => {
      const store = useScheduleStore.getState()
      store.setRemoteSchedule(makeSchedule([block1]))

      // Should not throw
      store.updateBlockField('non-existent-id', 'title', '아무것도 안 함')

      const blocks = store.getMergedBlocks()
      expect(blocks).toHaveLength(1)
      expect(blocks[0].title).toBe('팀 미팅') // unchanged
    })
  })
})
