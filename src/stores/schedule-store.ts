import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { v4 as uuidv4 } from 'uuid'
import type {
  TimeBlock,
  DaySchedule,
  LocalEdit,
} from '@/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScheduleState {
  /** Currently viewed date (YYYY-MM-DD) */
  currentDate: string
  /** Remote schedule fetched from GitHub */
  remoteSchedule: DaySchedule | null
  /** Local edits overlay for the current date */
  localEdits: LocalEdit | null
  /** Whether a GitHub fetch is in progress */
  isLoading: boolean
  /** Last GitHub fetch error message */
  error: string | null
  /** Timestamp (ms) of last successful GitHub fetch for the current date */
  lastFetchedAt: number | null
}

export interface ScheduleActions {
  // Navigation
  navigateToDate: (date: string) => void

  // Data loading
  setRemoteSchedule: (schedule: DaySchedule | null) => void
  loadLocalEdits: () => void
  saveLocalEdits: () => void

  // Merge
  getMergedBlocks: () => TimeBlock[]

  // Block CRUD
  addBlock: (block: Omit<TimeBlock, 'id'>) => string
  moveBlock: (id: string, newStartTime: string) => void
  resizeBlock: (id: string, newEndTime: string) => void
  deleteBlock: (id: string) => void
  updateBlockField: <K extends keyof TimeBlock>(
    id: string,
    field: K,
    value: TimeBlock[K],
  ) => void

  // Checklist
  toggleChecklistItem: (blockId: string, index: number) => void
  addChecklistItem: (blockId: string, text: string) => void
  removeChecklistItem: (blockId: string, index: number) => void

  // Status
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  setLastFetchedAt: (timestamp: number) => void

  // Reset
  reset: () => void
}

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

function createEmptyLocalEdit(date: string): LocalEdit {
  return {
    date,
    edits: {},
    additions: [],
    deletions: [],
    updated_at: new Date().toISOString(),
  }
}

function loadEditsFromLocalStorage(date: string): LocalEdit | null {
  try {
    const raw = localStorage.getItem(`edits-${date}`)
    if (!raw) return null
    return JSON.parse(raw) as LocalEdit
  } catch {
    return null
  }
}

function saveEditsToLocalStorage(edits: LocalEdit): void {
  try {
    edits.updated_at = new Date().toISOString()
    localStorage.setItem(`edits-${edits.date}`, JSON.stringify(edits))
  } catch {
    // localStorage quota exceeded — silently fail; data is still in memory
    console.warn(`[schedule-store] Failed to save edits for ${edits.date}`)
  }
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

const initialState: ScheduleState = {
  currentDate: todayString(),
  remoteSchedule: null,
  localEdits: loadEditsFromLocalStorage(todayString()),
  isLoading: false,
  error: null,
  lastFetchedAt: null,
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useScheduleStore = create<ScheduleState & ScheduleActions>()(
  immer((set, get) => ({
    ...initialState,

    // ---- Navigation -------------------------------------------------------

    navigateToDate: (date: string) => {
      set((state) => {
        state.currentDate = date
        state.remoteSchedule = null
        state.localEdits = loadEditsFromLocalStorage(date)
        state.isLoading = false
        state.error = null
        state.lastFetchedAt = null
      })
    },

    // ---- Data loading -----------------------------------------------------

    setRemoteSchedule: (schedule: DaySchedule | null) => {
      set((state) => {
        state.remoteSchedule = schedule
      })
    },

    loadLocalEdits: () => {
      const { currentDate } = get()
      set((state) => {
        state.localEdits = loadEditsFromLocalStorage(currentDate)
      })
    },

    saveLocalEdits: () => {
      const { localEdits } = get()
      if (localEdits) {
        saveEditsToLocalStorage(localEdits)
      }
    },

    // ---- Merge ------------------------------------------------------------

    getMergedBlocks: (): TimeBlock[] => {
      const { remoteSchedule, localEdits } = get()

      // No remote data — return local additions only
      if (!remoteSchedule) {
        return localEdits ? [...localEdits.additions] : []
      }

      const local = localEdits
      const deletions = new Set(local?.deletions ?? [])
      const editMap = local?.edits ?? {}

      // Start from remote blocks, apply edits, filter deletions
      const merged: TimeBlock[] = remoteSchedule.blocks
        .filter((block) => !deletions.has(block.id))
        .map((block) => {
          const edit = editMap[block.id]
          if (!edit) return { ...block }
          return { ...block, ...edit } as TimeBlock
        })

      // Append local additions
      if (local?.additions.length) {
        merged.push(...local.additions)
      }

      // Sort by startTime
      merged.sort((a, b) => a.startTime.localeCompare(b.startTime))

      return merged
    },

    // ---- Block CRUD -------------------------------------------------------

    addBlock: (blockData: Omit<TimeBlock, 'id'>): string => {
      const id = uuidv4()
      const block: TimeBlock = { ...blockData, id }

      set((state) => {
        if (!state.localEdits) {
          state.localEdits = createEmptyLocalEdit(state.currentDate)
        }
        state.localEdits.additions.push(block)
      })

      get().saveLocalEdits()
      return id
    },

    moveBlock: (id: string, newStartTime: string) => {
      set((state) => {
        const block = findBlockInState(state, id)
        if (!block) return

        // Calculate duration
        const duration = timeDiff(block.startTime, block.endTime)
        block.startTime = newStartTime
        block.endTime = addMinutes(newStartTime, duration)

        recordEdit(state, id, { startTime: block.startTime, endTime: block.endTime })
      })
      get().saveLocalEdits()
    },

    resizeBlock: (id: string, newEndTime: string) => {
      set((state) => {
        const block = findBlockInState(state, id)
        if (!block) return

        block.endTime = newEndTime
        recordEdit(state, id, { endTime: block.endTime })
      })
      get().saveLocalEdits()
    },

    deleteBlock: (id: string) => {
      set((state) => {
        if (!state.localEdits) {
          state.localEdits = createEmptyLocalEdit(state.currentDate)
        }

        // Check if it's a local addition — just remove it
        const addIdx = state.localEdits.additions.findIndex((b) => b.id === id)
        if (addIdx !== -1) {
          state.localEdits.additions.splice(addIdx, 1)
        } else {
          // Mark as deleted
          state.localEdits.deletions.push(id)
          // Remove any pending edits for this block
          delete state.localEdits.edits[id]
        }
      })
      get().saveLocalEdits()
    },

    updateBlockField: <K extends keyof TimeBlock>(
      id: string,
      field: K,
      value: TimeBlock[K],
    ) => {
      set((state) => {
        const block = findBlockInState(state, id)
        if (!block) return

        block[field] = value
        recordEdit(state, id, { [field]: value } as Partial<TimeBlock>)
      })
      get().saveLocalEdits()
    },

    // ---- Checklist --------------------------------------------------------

    toggleChecklistItem: (blockId: string, index: number) => {
      set((state) => {
        const block = findBlockInState(state, blockId)
        if (!block || !block.checklist[index]) return

        block.checklist[index].done = !block.checklist[index].done
        recordEdit(state, blockId, { checklist: [...block.checklist] })
      })
      get().saveLocalEdits()
    },

    addChecklistItem: (blockId: string, text: string) => {
      set((state) => {
        const block = findBlockInState(state, blockId)
        if (!block) return

        block.checklist.push({ text, done: false })
        recordEdit(state, blockId, { checklist: [...block.checklist] })
      })
      get().saveLocalEdits()
    },

    removeChecklistItem: (blockId: string, index: number) => {
      set((state) => {
        const block = findBlockInState(state, blockId)
        if (!block || !block.checklist[index]) return

        block.checklist.splice(index, 1)
        recordEdit(state, blockId, { checklist: [...block.checklist] })
      })
      get().saveLocalEdits()
    },

    // ---- Status -----------------------------------------------------------

    setLoading: (loading: boolean) => {
      set((state) => {
        state.isLoading = loading
      })
    },

    setError: (error: string | null) => {
      set((state) => {
        state.error = error
      })
    },

    setLastFetchedAt: (timestamp: number) => {
      set((state) => {
        state.lastFetchedAt = timestamp
      })
    },

    // ---- Reset ------------------------------------------------------------

    reset: () => {
      set((state) => {
        Object.assign(state, { ...initialState, currentDate: todayString() })
      })
    },
  })),
)

// ---------------------------------------------------------------------------
// Internal helpers (work with Immer Draft)
// ---------------------------------------------------------------------------

/**
 * Find a block either in remote schedule or local additions.
 * Returns the Immer draft reference so mutations persist.
 */
function findBlockInState(
  state: ScheduleState,
  id: string,
): TimeBlock | undefined {
  // Check local additions first (user-created blocks)
  if (state.localEdits) {
    const addition = state.localEdits.additions.find((b) => b.id === id)
    if (addition) return addition
  }

  // Check remote blocks
  if (state.remoteSchedule) {
    return state.remoteSchedule.blocks.find((b) => b.id === id)
  }

  return undefined
}

/**
 * Record a partial edit for a remote block in local edits.
 * Only records if the block is from the remote schedule (not a local addition).
 */
function recordEdit(
  state: ScheduleState,
  blockId: string,
  partial: Partial<TimeBlock>,
): void {
  if (!state.localEdits) {
    state.localEdits = createEmptyLocalEdit(state.currentDate)
  }

  // Don't record edits for local additions — they're already in the additions array
  const isAddition = state.localEdits.additions.some((b) => b.id === blockId)
  if (isAddition) return

  // Merge with existing edits
  const existing = state.localEdits.edits[blockId] ?? {}
  state.localEdits.edits[blockId] = { ...existing, ...partial }
}

/**
 * Calculate the difference between two "HH:mm" times in minutes.
 */
function timeDiff(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  return (eh * 60 + em) - (sh * 60 + sm)
}

/**
 * Add minutes to a "HH:mm" time string.
 */
function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number)
  const total = h * 60 + m + minutes
  const nh = Math.floor(total / 60)
  const nm = total % 60
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`
}
