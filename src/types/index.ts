/** TimeBlock color palette */
export type BlockColor = 'blue' | 'green' | 'red' | 'yellow' | 'purple' | 'gray'

/** Block status */
export type BlockStatus = 'planned' | 'in_progress' | 'done' | 'skipped'

/** Block source */
export type BlockSource = 'ai' | 'manual'

/** Checklist item */
export interface ChecklistItem {
  text: string
  done: boolean
}

/** TimeBlock — a single scheduled block */
export interface TimeBlock {
  id: string
  startTime: string // "HH:mm" format, e.g. "09:00"
  endTime: string   // "HH:mm" format, e.g. "10:30"
  title: string
  category: string | null
  color: BlockColor
  notes: string
  advice: string | null
  checklist: ChecklistItem[]
  status: BlockStatus
  source: BlockSource
}

/** DaySchedule — fetched from GitHub raw URL */
export interface DaySchedule {
  date: string          // "YYYY-MM-DD"
  generated_at: string  // ISO 8601 timestamp
  blocks: TimeBlock[]
  meta: {
    version: number
    source: 'claude' | 'manual'
  }
}

/** LocalEdit — stored in localStorage */
export interface LocalEdit {
  date: string
  edits: Record<string, Partial<TimeBlock>>
  additions: TimeBlock[]
  deletions: string[]
  updated_at: string
}

/** UserConfig — stored in localStorage */
export interface UserConfig {
  dayStartHour: number  // default 6
  dayEndHour: number    // default 24
  repoOwner: string
  repoName: string
  branch: string        // default "main"
  theme: 'light' | 'dark' | 'system'
}
