/**
 * MobileEditSheet — bottom sheet for editing blocks on mobile.
 *
 * Opens when a block is selected on mobile (< 768px).
 * Provides time adjustment (+/- 15min), status toggle, notes, and delete.
 */

import { useMemo } from 'react'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { useScheduleStore } from '@/stores/schedule-store'
import { useUIStore } from '@/stores/ui-store'
import type { BlockColor, BlockStatus } from '@/types'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COLORS: { value: BlockColor; label: string; className: string }[] = [
  { value: 'blue', label: '파랑', className: 'bg-blue-500' },
  { value: 'green', label: '초록', className: 'bg-emerald-500' },
  { value: 'red', label: '빨강', className: 'bg-red-500' },
  { value: 'yellow', label: '노랑', className: 'bg-amber-500' },
  { value: 'purple', label: '보라', className: 'bg-violet-500' },
  { value: 'gray', label: '회색', className: 'bg-slate-500' },
]

const STATUSES: { value: BlockStatus; label: string }[] = [
  { value: 'planned', label: '계획' },
  { value: 'in_progress', label: '진행' },
  { value: 'done', label: '완료' },
  { value: 'skipped', label: '건너뜀' },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number)
  const total = h * 60 + m + minutes
  const nh = Math.floor(total / 60)
  const nm = total % 60
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`
}

function timeDiff(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  return (eh * 60 + em) - (sh * 60 + sm)
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MobileEditSheet() {
  const isDetailPanelOpen = useUIStore((s) => s.isDetailPanelOpen)
  const focusedBlockId = useUIStore((s) => s.focusedBlockId)
  const closeDetailPanel = useUIStore((s) => s.closeDetailPanel)
  const getMergedBlocks = useScheduleStore((s) => s.getMergedBlocks)
  const remoteSchedule = useScheduleStore((s) => s.remoteSchedule)
  const updateBlockField = useScheduleStore((s) => s.updateBlockField)
  const moveBlock = useScheduleStore((s) => s.moveBlock)
  const resizeBlock = useScheduleStore((s) => s.resizeBlock)
  const deleteBlock = useScheduleStore((s) => s.deleteBlock)
  const toggleChecklistItem = useScheduleStore((s) => s.toggleChecklistItem)

  const block = useMemo(
    () => getMergedBlocks().find((b) => b.id === focusedBlockId) ?? null,
    [getMergedBlocks, focusedBlockId, remoteSchedule],
  )

  if (!block) return null

  const handleOpenChange = (open: boolean) => {
    if (!open) closeDetailPanel()
  }

  const shiftStartTime = (delta: number) => {
    const duration = timeDiff(block.startTime, block.endTime)
    const newStart = addMinutes(block.startTime, delta)
    const newEnd = addMinutes(newStart, duration)
    moveBlock(block.id, newStart)
    if (addMinutes(newStart, duration) !== newEnd) {
      resizeBlock(block.id, newEnd)
    }
  }

  const shiftEndTime = (delta: number) => {
    const newEnd = addMinutes(block.endTime, delta)
    if (newEnd > block.startTime) {
      resizeBlock(block.id, newEnd)
    }
  }

  const cycleStatus = () => {
    const statusOrder: BlockStatus[] = ['planned', 'in_progress', 'done', 'skipped']
    const currentIdx = statusOrder.indexOf(block.status)
    const nextStatus = statusOrder[(currentIdx + 1) % statusOrder.length]
    updateBlockField(block.id, 'status', nextStatus)
  }

  return (
    <Sheet open={isDetailPanelOpen} onOpenChange={handleOpenChange}>
      <SheetContent side="bottom" className="h-[70vh] rounded-t-xl p-0 flex flex-col">
        {/* Header */}
        <div className="px-4 pt-3 pb-2 border-b space-y-2">
          <div className="flex items-center justify-between">
            <input
              className="text-sm font-semibold flex-1 bg-transparent border-none outline-none"
              value={block.title}
              onChange={(e) => updateBlockField(block.id, 'title', e.target.value)}
              placeholder="제목"
            />
            <button
              className="text-xs px-3 py-1.5 rounded-full bg-muted font-medium min-h-[44px] flex items-center"
              onClick={cycleStatus}
            >
              {STATUSES.find((s) => s.value === block.status)?.label}
            </button>
          </div>

          {/* Time adjustment */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">시작</span>
              <button
                className="w-9 h-9 flex items-center justify-center rounded bg-muted text-sm font-medium active:bg-muted/70"
                onClick={() => shiftStartTime(-15)}
              >
                -
              </button>
              <span className="text-sm font-mono w-12 text-center">{block.startTime}</span>
              <button
                className="w-9 h-9 flex items-center justify-center rounded bg-muted text-sm font-medium active:bg-muted/70"
                onClick={() => shiftStartTime(15)}
              >
                +
              </button>
            </div>
            <span className="text-muted-foreground">→</span>
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">종료</span>
              <button
                className="w-9 h-9 flex items-center justify-center rounded bg-muted text-sm font-medium active:bg-muted/70"
                onClick={() => shiftEndTime(-15)}
              >
                -
              </button>
              <span className="text-sm font-mono w-12 text-center">{block.endTime}</span>
              <button
                className="w-9 h-9 flex items-center justify-center rounded bg-muted text-sm font-medium active:bg-muted/70"
                onClick={() => shiftEndTime(15)}
              >
                +
              </button>
            </div>
          </div>

          {/* Color picker */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground">색상</span>
            {COLORS.map((c) => (
              <button
                key={c.value}
                className={`w-7 h-7 rounded-full ${c.className} ${block.color === c.value ? 'ring-2 ring-offset-1 ring-primary' : ''}`}
                onClick={() => updateBlockField(block.id, 'color', c.value)}
                aria-label={c.label}
              />
            ))}
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-auto px-4 py-3 space-y-3">
          {/* Notes */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">메모</label>
            <Textarea
              className="min-h-[80px] text-sm resize-none"
              value={block.notes}
              onChange={(e) => updateBlockField(block.id, 'notes', e.target.value)}
              placeholder="메모를 입력하세요..."
            />
          </div>

          {/* Advice */}
          {block.advice && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">AI 조언</label>
              <div className="text-sm whitespace-pre-wrap text-muted-foreground bg-muted/50 rounded-md p-3">
                {block.advice}
              </div>
            </div>
          )}

          {/* Checklist */}
          {block.checklist.length > 0 && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">체크리스트</label>
              <div className="space-y-2">
                {block.checklist.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 min-h-[44px]">
                    <Checkbox checked={item.done} onCheckedChange={() => toggleChecklistItem(block.id, i)} />
                    <span className={`text-sm ${item.done ? 'line-through text-muted-foreground' : ''}`}>
                      {item.text}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t">
          <Button
            variant="destructive"
            size="sm"
            className="w-full text-xs min-h-[44px]"
            onClick={() => {
              deleteBlock(block.id)
              closeDetailPanel()
            }}
          >
            블록 삭제
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
