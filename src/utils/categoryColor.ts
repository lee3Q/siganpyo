import type { BlockColor } from '@/types'

const CATEGORY_COLOR_MAP: Record<string, BlockColor> = {
  학습: 'blue',
  공부: 'blue',
  study: 'blue',
  운동: 'green',
  exercise: 'green',
  workout: 'green',
  휴식: 'yellow',
  rest: 'yellow',
  break: 'yellow',
  작업: 'purple',
  work: 'purple',
  task: 'purple',
  일정: 'red',
  약속: 'red',
  meeting: 'red',
  이동: 'gray',
  commute: 'gray',
}

export function getDefaultColor(category: string | null): BlockColor | null {
  if (!category) return null
  return CATEGORY_COLOR_MAP[category.toLowerCase()] ?? null
}
