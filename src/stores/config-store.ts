import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { persist } from 'zustand/middleware'
import type { UserConfig } from '@/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ConfigState extends UserConfig {}

export interface ConfigActions {
  updateConfig: (partial: Partial<UserConfig>) => void
  reset: () => void
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const defaultConfig: UserConfig = {
  dayStartHour: 6,
  dayEndHour: 24,
  repoOwner: 'lee3Q',
  repoName: 'siganpyo',
  branch: 'main',
  theme: 'system',
}

/** Hardcoded fallback — always valid regardless of localStorage state */
const HARDCODED_REPO = { repoOwner: 'lee3Q', repoName: 'siganpyo', branch: 'main' }

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useConfigStore = create<ConfigState & ConfigActions>()(
  immer(
    persist(
      (set) => ({
        ...defaultConfig,

        updateConfig: (partial: Partial<UserConfig>) => {
          set((state) => {
            Object.assign(state, partial)
          })
        },

        reset: () => {
          set((state) => {
            Object.assign(state, { ...defaultConfig })
          })
        },
      }),
      {
        name: 'siganpyo-config',
        // Migration: fill repo config if empty or contains old username
        merge: (persisted, current) => {
          const p = persisted as Record<string, unknown> | null
          const merged = { ...current, ...(p ?? {}) } as Record<string, unknown>
          if (!merged.repoOwner || !merged.repoName) {
            merged.repoOwner = HARDCODED_REPO.repoOwner
            merged.repoName = HARDCODED_REPO.repoName
            merged.branch = HARDCODED_REPO.branch
          }
          // Migrate old username trauma10 → lee3Q
          if (merged.repoOwner === 'trauma10') {
            merged.repoOwner = 'lee3Q'
          }
          return merged as unknown as ConfigState & ConfigActions
        },
        // Only persist the config values, not the actions
        partialize: (state) => ({
          dayStartHour: state.dayStartHour,
          dayEndHour: state.dayEndHour,
          repoOwner: state.repoOwner,
          repoName: state.repoName,
          branch: state.branch,
          theme: state.theme,
        }),
      },
    ),
  ),
)
