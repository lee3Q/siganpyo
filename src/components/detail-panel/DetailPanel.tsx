/**
 * DetailPanel — slide-in panel for block details.
 *
 * Opens from the right when a block is selected.
 * Three tabs: 메모 (notes), AI 조언 (advice), 체크리스트 (checklist).
 */

import { useMemo } from 'react'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { useScheduleStore } from '@/stores/schedule-store'
import { useUIStore, type PanelTab } from '@/stores/ui-store'
import type { BlockColor, BlockStatus } from '@/types'
import { todayString } from '@/utils/todayString'
import { getDefaultColor } from '@/utils/categoryColor'

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
// Component
// ---------------------------------------------------------------------------

export function DetailPanel() {
  const isDetailPanelOpen = useUIStore((s) => s.isDetailPanelOpen)
  const activePanelTab = useUIStore((s) => s.activePanelTab)
  const focusedBlockId = useUIStore((s) => s.focusedBlockId)
  const closeDetailPanel = useUIStore((s) => s.closeDetailPanel)
  const switchPanelTab = useUIStore((s) => s.switchPanelTab)
  const getMergedBlocks = useScheduleStore((s) => s.getMergedBlocks)
  const updateBlockField = useScheduleStore((s) => s.updateBlockField)
  const toggleChecklistItem = useScheduleStore((s) => s.toggleChecklistItem)
  const addChecklistItem = useScheduleStore((s) => s.addChecklistItem)
  const removeChecklistItem = useScheduleStore((s) => s.removeChecklistItem)
  const deleteBlock = useScheduleStore((s) => s.deleteBlock)
  const currentDate = useScheduleStore((s) => s.currentDate)

  const isPastDate = currentDate < todayString()

  const block = useMemo(
    () => getMergedBlocks().find((b) => b.id === focusedBlockId) ?? null,
    [getMergedBlocks, focusedBlockId],
  )

  const handleOpenChange = (open: boolean) => {
    if (!open) closeDetailPanel()
  }

  if (!block) return null

  return (
    <Sheet open={isDetailPanelOpen} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="w-80 p-0 flex flex-col">
        {/* Header */}
        <div className="px-4 pt-4 pb-2 border-b space-y-2">
          <input
            className="text-sm font-semibold w-full bg-transparent border-none outline-none"
            value={block.title}
            onChange={(e) => !isPastDate && updateBlockField(block.id, 'title', e.target.value)}
            readOnly={isPastDate}
            placeholder="제목"
          />
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{block.startTime} – {block.endTime}</span>
            <span>·</span>
            <select
              className="bg-transparent text-xs outline-none cursor-pointer disabled:cursor-not-allowed"
              value={block.status}
              onChange={(e) => updateBlockField(block.id, 'status', e.target.value as BlockStatus)}
              disabled={isPastDate}
            >
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          {/* Color picker */}
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-muted-foreground mr-1">색상</span>
            {COLORS.map((c) => (
              <button
                key={c.value}
                className={`w-4 h-4 rounded-full ${c.className} ${block.color === c.value ? 'ring-2 ring-offset-1 ring-primary' : ''} disabled:opacity-50`}
                onClick={() => updateBlockField(block.id, 'color', c.value)}
                disabled={isPastDate}
                aria-label={c.label}
              />
            ))}
          </div>

          {/* Category */}
          <input
            className="text-xs w-full bg-transparent border-none outline-none text-muted-foreground"
            value={block.category ?? ''}
            onChange={(e) => {
              if (isPastDate) return
              const cat = e.target.value || null
              updateBlockField(block.id, 'category', cat)
              const autoColor = getDefaultColor(cat)
              if (autoColor) updateBlockField(block.id, 'color', autoColor)
            }}
            readOnly={isPastDate}
            placeholder="카테고리 (선택)"
          />
        </div>

        {/* Tabs */}
        <Tabs
          value={activePanelTab}
          onValueChange={(v) => switchPanelTab(v as PanelTab)}
          className="flex-1 flex flex-col overflow-hidden"
        >
          <TabsList className="w-full rounded-none border-b h-9">
            <TabsTrigger value="notes" className="flex-1 text-xs">메모</TabsTrigger>
            <TabsTrigger value="advice" className="flex-1 text-xs">AI 조언</TabsTrigger>
            <TabsTrigger value="checklist" className="flex-1 text-xs">체크리스트</TabsTrigger>
          </TabsList>

          <TabsContent value="notes" className="flex-1 p-3 overflow-auto">
            <Textarea
              className="min-h-[120px] text-sm resize-none"
              value={block.notes}
              onChange={(e) => !isPastDate && updateBlockField(block.id, 'notes', e.target.value)}
              readOnly={isPastDate}
              placeholder="메모를 입력하세요..."
            />
          </TabsContent>

          <TabsContent value="advice" className="flex-1 p-3 overflow-auto">
            {block.advice ? (
              <div className="text-sm whitespace-pre-wrap text-muted-foreground bg-muted/50 rounded-md p-3">
                {block.advice}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center pt-8">
                AI 조언이 없습니다.
                <br />
                Claude가 생성한 일정에는 자동으로 포함됩니다.
              </p>
            )}
          </TabsContent>

          <TabsContent value="checklist" className="flex-1 p-3 overflow-auto space-y-2">
            {block.checklist.map((item, i) => (
              <ChecklistRow
                key={i}
                text={item.text}
                done={item.done}
                onToggle={() => toggleChecklistItem(block.id, i)}
                onRemove={() => removeChecklistItem(block.id, i)}
                onChangeText={(text) => {
                  const updated = [...block.checklist]
                  updated[i] = { ...updated[i], text }
                  updateBlockField(block.id, 'checklist', updated)
                }}
              />
            ))}
            <NewChecklistItem onAdd={(text) => addChecklistItem(block.id, text)} />
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <div className="px-4 py-2 border-t">
          <Button
            variant="destructive"
            size="sm"
            className="w-full text-xs"
            disabled={isPastDate}
            onClick={() => {
              deleteBlock(block.id)
              closeDetailPanel()
            }}
          >
            {isPastDate ? '과거 날짜 (읽기 전용)' : '블록 삭제'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ChecklistRow({
  text,
  done,
  onToggle,
  onRemove,
  onChangeText,
}: {
  text: string
  done: boolean
  onToggle: () => void
  onRemove: () => void
  onChangeText: (text: string) => void
}) {
  return (
    <div className="flex items-center gap-2 group">
      <Checkbox checked={done} onCheckedChange={onToggle} />
      <input
        className={`flex-1 text-xs bg-transparent outline-none ${done ? 'line-through text-muted-foreground' : ''}`}
        value={text}
        onChange={(e) => onChangeText(e.target.value)}
      />
      <button
        className="opacity-0 group-hover:opacity-100 text-xs text-muted-foreground hover:text-destructive transition-opacity"
        onClick={onRemove}
        aria-label="삭제"
      >
        ×
      </button>
    </div>
  )
}

function NewChecklistItem({ onAdd }: { onAdd: (text: string) => void }) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && e.currentTarget.value.trim()) {
      onAdd(e.currentTarget.value.trim())
      e.currentTarget.value = ''
    }
  }

  return (
    <Input
      className="text-xs h-7"
      placeholder="항목 추가 후 Enter"
      onKeyDown={handleKeyDown}
    />
  )
}
