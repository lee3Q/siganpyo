import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PanelTab = 'notes' | 'advice' | 'checklist'

export interface UIState {
  /** ID of the currently focused (keyboard-selected) block */
  focusedBlockId: string | null
  /** Whether the detail panel is open */
  isDetailPanelOpen: boolean
  /** Currently active tab in the detail panel */
  activePanelTab: PanelTab
  /** Whether the app is in offline mode */
  isOffline: boolean
  /** Whether the keyboard shortcuts help overlay is open */
  isKeyboardHelpOpen: boolean
  /** Whether the template dialog is open */
  isTemplateDialogOpen: boolean
  /** ID of the block currently being edited (drag / resize) */
  editingBlockId: string | null
  /** Whether the block creation modal is open */
  isCreateBlockOpen: boolean
  /** Start time for new block creation (set when clicking empty slot) */
  newBlockStartTime: string | null
}

export interface UIActions {
  // Focus
  focusBlock: (id: string | null) => void
  clearFocus: () => void

  // Detail panel
  openDetailPanel: (blockId: string) => void
  closeDetailPanel: () => void
  switchPanelTab: (tab: PanelTab) => void
  switchPanelTabDirection: (direction: 'left' | 'right') => void

  // Editing
  setEditingBlock: (id: string | null) => void

  // Create block
  openCreateBlock: (startTime: string) => void
  closeCreateBlock: () => void

  // Offline
  setOffline: (offline: boolean) => void

  // Keyboard help
  toggleKeyboardHelp: () => void

  // Template dialog
  toggleTemplateDialog: () => void

  // Reset
  reset: () => void
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PANEL_TABS: PanelTab[] = ['notes', 'advice', 'checklist']

const initialState: UIState = {
  focusedBlockId: null,
  isDetailPanelOpen: false,
  activePanelTab: 'notes',
  isOffline: false,
  isKeyboardHelpOpen: false,
  isTemplateDialogOpen: false,
  editingBlockId: null,
  isCreateBlockOpen: false,
  newBlockStartTime: null,
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useUIStore = create<UIState & UIActions>()(
  immer((set) => ({
    ...initialState,

    // ---- Focus ------------------------------------------------------------

    focusBlock: (id: string | null) => {
      set((state) => {
        state.focusedBlockId = id
      })
    },

    clearFocus: () => {
      set((state) => {
        state.focusedBlockId = null
      })
    },

    // ---- Detail panel -----------------------------------------------------

    openDetailPanel: (blockId: string) => {
      set((state) => {
        state.focusedBlockId = blockId
        state.isDetailPanelOpen = true
      })
    },

    closeDetailPanel: () => {
      set((state) => {
        state.isDetailPanelOpen = false
      })
    },

    switchPanelTab: (tab: PanelTab) => {
      set((state) => {
        state.activePanelTab = tab
      })
    },

    switchPanelTabDirection: (direction: 'left' | 'right') => {
      set((state) => {
        const currentIdx = PANEL_TABS.indexOf(state.activePanelTab)
        if (currentIdx === -1) return

        const newIdx =
          direction === 'left'
            ? Math.max(0, currentIdx - 1)
            : Math.min(PANEL_TABS.length - 1, currentIdx + 1)

        state.activePanelTab = PANEL_TABS[newIdx]
      })
    },

    // ---- Editing ----------------------------------------------------------

    setEditingBlock: (id: string | null) => {
      set((state) => {
        state.editingBlockId = id
      })
    },

    // ---- Create block -----------------------------------------------------

    openCreateBlock: (startTime: string) => {
      set((state) => {
        state.isCreateBlockOpen = true
        state.newBlockStartTime = startTime
      })
    },

    closeCreateBlock: () => {
      set((state) => {
        state.isCreateBlockOpen = false
        state.newBlockStartTime = null
      })
    },

    // ---- Offline ----------------------------------------------------------

    setOffline: (offline: boolean) => {
      set((state) => {
        state.isOffline = offline
      })
    },

    toggleKeyboardHelp: () => {
      set((state) => {
        state.isKeyboardHelpOpen = !state.isKeyboardHelpOpen
      })
    },

    // ---- Template dialog ---------------------------------------------------

    toggleTemplateDialog: () => {
      set((state) => {
        state.isTemplateDialogOpen = !state.isTemplateDialogOpen
      })
    },

    // ---- Reset ------------------------------------------------------------

    reset: () => {
      set((state) => {
        Object.assign(state, { ...initialState })
      })
    },
  })),
)
