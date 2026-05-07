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
  repoOwner: '',
  repoName: '',
  branch: 'main',
  theme: 'system',
}

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
