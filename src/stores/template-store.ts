import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { v4 as uuidv4 } from 'uuid'
import type { DayTemplate, TemplateBlock, TimeBlock } from '@/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TemplateState {
  templates: DayTemplate[]
}

export interface TemplateActions {
  saveTemplate: (name: string, blocks: TimeBlock[]) => void
  loadTemplate: (id: string) => TemplateBlock[] | null
  deleteTemplate: (id: string) => void
  renameTemplate: (id: string, newName: string) => void
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useTemplateStore = create<TemplateState & TemplateActions>()(
  persist(
    (set, get) => ({
      templates: [],

      saveTemplate: (name: string, blocks: TimeBlock[]) => {
        const templateBlocks: TemplateBlock[] = blocks.map((b) => ({
          startTime: b.startTime,
          endTime: b.endTime,
          title: b.title,
          category: b.category,
          color: b.color,
          notes: b.notes,
          advice: b.advice,
          checklist: b.checklist.map((c) => ({ text: c.text })),
        }))

        const template: DayTemplate = {
          id: uuidv4(),
          name,
          blocks: templateBlocks,
          createdAt: new Date().toISOString(),
        }

        set((state) => ({
          templates: [...state.templates, template],
        }))
      },

      loadTemplate: (id: string): TemplateBlock[] | null => {
        const tpl = get().templates.find((t) => t.id === id)
        return tpl?.blocks ?? null
      },

      deleteTemplate: (id: string) => {
        set((state) => ({
          templates: state.templates.filter((t) => t.id !== id),
        }))
      },

      renameTemplate: (id: string, newName: string) => {
        set((state) => ({
          templates: state.templates.map((t) =>
            t.id === id ? { ...t, name: newName } : t,
          ),
        }))
      },
    }),
    {
      name: 'siganpyo-templates',
      partialize: (state) => ({ templates: state.templates }),
    },
  ),
)
