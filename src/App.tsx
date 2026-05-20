import { TimeGrid } from '@/components/time-grid'
import { DetailPanel } from '@/components/detail-panel'
import { useScheduleLoader } from '@/hooks/useScheduleLoader'

function App() {
  const { refresh } = useScheduleLoader()

  return (
    <div className="h-full overflow-hidden">
      <TimeGrid onRefresh={refresh} />
      <DetailPanel />
    </div>
  )
}

export default App
