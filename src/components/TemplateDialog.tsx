import { useState, useCallback } from 'react'
import { useTemplateStore } from '@/stores/template-store'
import { useScheduleStore } from '@/stores/schedule-store'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface TemplateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TemplateDialog({ open, onOpenChange }: TemplateDialogProps) {
  const templates = useTemplateStore((s) => s.templates)
  const saveTemplate = useTemplateStore((s) => s.saveTemplate)
  const deleteTemplate = useTemplateStore((s) => s.deleteTemplate)
  const getMergedBlocks = useScheduleStore((s) => s.getMergedBlocks)
  const addBlock = useScheduleStore((s) => s.addBlock)
  const remoteSchedule = useScheduleStore((s) => s.remoteSchedule)

  const [saveName, setSaveName] = useState('')
  const [mode, setMode] = useState<'save' | 'load'>('load')

  const blocks = getMergedBlocks()

  const handleSave = useCallback(() => {
    const name = saveName.trim()
    if (!name || blocks.length === 0) return
    saveTemplate(name, blocks)
    setSaveName('')
    setMode('load')
  }, [saveName, blocks, saveTemplate])

  const handleLoad = useCallback(
    (templateId: string) => {
      const tpl = templates.find((t) => t.id === templateId)
      if (!tpl) return

      for (const b of tpl.blocks) {
        addBlock({
          startTime: b.startTime,
          endTime: b.endTime,
          title: b.title,
          category: b.category,
          color: b.color,
          notes: b.notes,
          advice: b.advice,
          checklist: b.checklist.map((c) => ({ text: c.text, done: false })),
          status: 'planned',
          source: 'manual',
        })
      }
      onOpenChange(false)
    },
    [templates, addBlock, onOpenChange],
  )

  const handleDelete = useCallback(
    (id: string) => {
      deleteTemplate(id)
    },
    [deleteTemplate],
  )

  // Suppress the unused variable warning — blocks dependency triggers re-render
  void remoteSchedule

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle>템플릿</DialogTitle>
          <DialogDescription>
            일정 패턴을 저장하고 불러옵니다
          </DialogDescription>
        </DialogHeader>

        {/* Tab-like toggle */}
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          <button
            className={`flex-1 rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              mode === 'load'
                ? 'bg-popover text-text-primary shadow-sm'
                : 'text-text-tertiary hover:text-text-secondary'
            }`}
            onClick={() => setMode('load')}
          >
            불러오기
          </button>
          <button
            className={`flex-1 rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              mode === 'save'
                ? 'bg-popover text-text-primary shadow-sm'
                : 'text-text-tertiary hover:text-text-secondary'
            }`}
            onClick={() => setMode('save')}
          >
            저장하기
          </button>
        </div>

        {mode === 'save' && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Input
                placeholder="템플릿 이름 (예: 평일 기본)"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              />
              <p className="text-[11px] text-text-tertiary">
                현재 {blocks.length}개 블록이 저장됩니다
              </p>
            </div>
            <Button
              className="w-full"
              size="sm"
              disabled={!saveName.trim() || blocks.length === 0}
              onClick={handleSave}
            >
              저장
            </Button>
          </div>
        )}

        {mode === 'load' && (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {templates.length === 0 ? (
              <p className="text-xs text-text-tertiary text-center py-4">
                저장된 템플릿이 없습니다
              </p>
            ) : (
              templates.map((tpl) => (
                <div
                  key={tpl.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{tpl.name}</p>
                    <p className="text-[11px] text-text-tertiary">
                      {tpl.blocks.length}개 블록
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => handleLoad(tpl.id)}
                    >
                      불러오기
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => handleDelete(tpl.id)}
                      aria-label="삭제"
                    >
                      <svg
                        className="size-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
