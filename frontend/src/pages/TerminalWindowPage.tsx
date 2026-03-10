import { useParams, useSearchParams } from 'react-router-dom'
import TerminalSession from '@/components/terminal/TerminalSession'

export default function TerminalWindowPage() {
  const { assetId: paramAssetId } = useParams<{ assetId?: string }>()
  const [searchParams] = useSearchParams()

  return (
    <TerminalSession
      assetId={paramAssetId ? Number(paramAssetId) : 0}
      standalone
      autoConnect={searchParams.get('autoconnect') === '1'}
    />
  )
}