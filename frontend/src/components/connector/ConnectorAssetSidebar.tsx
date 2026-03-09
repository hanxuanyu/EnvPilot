import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { CATEGORY_LABELS } from '@/types/asset'
import type { Asset } from '@/types/asset'
import { safeAddress } from '@/components/connector/utils'

export function ConnectorAssetSidebar({
  title,
  keyword,
  onKeywordChange,
  assets,
  selectedAssetId,
  onSelect,
}: {
  title: string
  keyword: string
  onKeywordChange: (value: string) => void
  assets: Asset[]
  selectedAssetId: number | null
  onSelect: (assetId: number) => void
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="text-sm font-medium text-foreground">{title}</div>
        <Input
          value={keyword}
          onChange={(e) => onKeywordChange(e.target.value)}
          placeholder="搜索资产名或地址"
        />
      </div>

      <div className="rounded-xl border border-border bg-card p-3">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm font-medium text-foreground">可用资产</div>
          <Badge variant="outline">{assets.length}</Badge>
        </div>
        <div className="space-y-2 max-h-[680px] overflow-y-auto">
          {assets.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
              当前分类下没有可用资产
            </div>
          ) : assets.map((asset) => (
            <button
              key={asset.id}
              onClick={() => onSelect(asset.id)}
              className={`w-full rounded-xl border p-4 text-left transition-colors ${
                asset.id === selectedAssetId ? 'border-primary bg-primary/5' : 'border-border bg-card hover:bg-accent/40'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium text-foreground">{asset.name}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{safeAddress(asset)}</div>
                </div>
                <Badge variant="outline">{asset.plugin_type}</Badge>
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                <span>{CATEGORY_LABELS[asset.category]}</span>
                {asset.environment?.name && <span>· {asset.environment.name}</span>}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}