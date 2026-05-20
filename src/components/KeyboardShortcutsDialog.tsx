/**
 * KeyboardShortcutsDialog — overlay showing all available keyboard shortcuts.
 * Toggled with the ? key or the help button in the header.
 */

import { useEffect, useRef } from 'react'
import { useUIStore } from '@/stores/ui-store'

const SHORTCUTS = [
  { keys: '?', description: '이 도움말 열기/닫기' },
  { keys: 'T', description: '템플릿 저장/불러오기' },
  { keys: 'S', description: '선택한 블록 상태 변경' },
  { keys: 'Enter / Space', description: '블록 상세 패널 열기' },
  { keys: '← / →', description: '이전/다음 날짜로 이동' },
  { keys: 'Drag', description: '블록 이동' },
  { keys: '하단 에지 Drag', description: '블록 크기 조절' },
  { keys: '모바일 Swipe', description: '이전/다음 날짜' },
  { keys: '모바일 Pull-down', description: '데이터 새로고침' },
]

export function KeyboardShortcutsDialog() {
  const isOpen = useUIStore((s) => s.isKeyboardHelpOpen)
  const toggle = useUIStore((s) => s.toggleKeyboardHelp)
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    dialogRef.current?.focus()
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={toggle}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-label="키보드 단축키"
        tabIndex={-1}
        className="bg-surface rounded-lg shadow-xl border border-border max-w-xs w-full mx-4 p-4"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape' || e.key === '?') {
            e.preventDefault()
            toggle()
          }
        }}
      >
        <h2 className="text-sm font-semibold text-text-primary mb-3">
          키보드 단축키
        </h2>
        <ul className="space-y-2">
          {SHORTCUTS.map((s) => (
            <li key={s.keys} className="flex items-center justify-between gap-2">
              <span className="text-xs text-text-secondary">{s.description}</span>
              <kbd className="text-[10px] font-mono bg-surface-dimmed border border-border rounded px-1.5 py-0.5 text-text-tertiary">
                {s.keys}
              </kbd>
            </li>
          ))}
        </ul>
        <p className="text-[10px] text-text-tertiary mt-3 text-center">
          ? 또는 Esc로 닫기
        </p>
      </div>
    </div>
  )
}
