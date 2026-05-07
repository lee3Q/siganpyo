import { TimeGrid } from '@/components/time-grid'
import { DetailPanel } from '@/components/detail-panel'
import { useScheduleLoader } from '@/hooks/useScheduleLoader'

function App() {
  useScheduleLoader()

  return (
    <div className="h-full overflow-hidden">
      <TimeGrid />
      <DetailPanel />
    </div>
  )
}

export default App
