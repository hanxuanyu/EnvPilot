// EnvironmentPage.tsx — 环境管理页面（shadcn 风格组件 + Sonner toast）
import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Layers, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { useAssetStore } from '@/store/assetStore'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal, FormField } from '@/components/ui/dialog'
import { environmentService, groupService } from '@/services/assetService'
import type { Environment, Group } from '@/services/assetService'

const ENV_COLORS = [
  '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b',
  '#ef4444', '#06b6d4', '#ec4899', '#84cc16',
]

export default function EnvironmentPage() {
  const { environments, loadEnvironments } = useAssetStore()
  const [selectedEnv, setSelectedEnv] = useState<Environment | null>(null)
  const [groups, setGroups] = useState<Group[]>([])
  const [showEnvForm, setShowEnvForm] = useState(false)
  const [showGroupForm, setShowGroupForm] = useState(false)
  const [editingEnv, setEditingEnv] = useState<Environment | null>(null)
  const [editingGroup, setEditingGroup] = useState<Group | null>(null)

  useEffect(() => { loadEnvironments() }, [])

  useEffect(() => {
    if (!selectedEnv) { setGroups([]); return }
    groupService.listByEnvironment(selectedEnv.id)
      .then(setGroups)
      .catch(e => toast.error('加载分组失败', { description: e.message }))
  }, [selectedEnv])

  const handleDeleteEnv = async (id: number) => {
    try {
      await environmentService.delete(id)
      toast.success('环境已删除')
      if (selectedEnv?.id === id) setSelectedEnv(null)
      await loadEnvironments()
    } catch (e: any) {
      toast.error('删除失败', { description: e.message })
    }
  }

  const handleDeleteGroup = async (id: number) => {
    try {
      await groupService.delete(id)
      toast.success('分组已删除')
      if (selectedEnv) {
        setGroups(await groupService.listByEnvironment(selectedEnv.id))
      }
    } catch (e: any) {
      toast.error('删除失败', { description: e.message })
    }
  }

  return (
    <div className="flex gap-6 h-full animate-in fade-in-0 duration-200">
      <div className="w-72 flex flex-col gap-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">环境列表</h2>
          <Button size="sm" onClick={() => { setEditingEnv(null); setShowEnvForm(true) }}>
            <Plus className="w-3.5 h-3.5" /> 新建环境
          </Button>
        </div>
        <div className="space-y-1.5">
          {environments.length === 0 ? (
            <div className="text-center py-16 text-sm text-muted-foreground">
              暂无环境，点击「新建环境」开始
            </div>
          ) : environments.map(env => (
            <div
              key={env.id}
              onClick={() => setSelectedEnv(env)}
              className="group flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all border hover:border-primary/40"
              style={{
                backgroundColor: selectedEnv?.id === env.id ? 'var(--color-accent)' : 'var(--color-card)',
                borderColor: selectedEnv?.id === env.id ? env.color + '50' : 'var(--color-border)',
              }}
            >
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: env.color }} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate text-foreground">{env.name}</div>
                {env.description && (
                  <div className="text-xs truncate mt-0.5 text-muted-foreground">{env.description}</div>
                )}
              </div>
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost" size="icon"
                  onClick={e => { e.stopPropagation(); setEditingEnv(env); setShowEnvForm(true) }}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <ConfirmDialog
                  title="删除环境"
                  description={`确定要删除环境「${env.name}」吗？此操作不可撤销。`}
                  confirmText="删除"
                  danger
                  onConfirm={() => handleDeleteEnv(env.id)}
                >
                  <Button
                    variant="ghost" size="icon"
                    onClick={e => e.stopPropagation()}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </ConfirmDialog>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col gap-3 min-w-0">
        {selectedEnv ? (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4" style={{ color: selectedEnv.color }} />
                <h2 className="text-base font-semibold text-foreground">
                  {selectedEnv.name} · 分组
                </h2>
              </div>
              <Button variant="secondary" size="sm" onClick={() => { setEditingGroup(null); setShowGroupForm(true) }}>
                <Plus className="w-3.5 h-3.5" /> 新建分组
              </Button>
            </div>
            {groups.length === 0 ? (
              <div className="flex-1 flex items-center justify-center border border-dashed border-border rounded-lg text-sm text-muted-foreground">
                暂无分组，点击「新建分组」添加
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {groups.map(g => (
                  <div key={g.id} className="group p-4 rounded-lg border bg-card border-border hover:border-primary/30 transition-all">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-foreground truncate">{g.name}</div>
                        {g.description && (
                          <div className="text-xs mt-1 text-muted-foreground line-clamp-2">{g.description}</div>
                        )}
                      </div>
                      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                        <Button variant="ghost" size="icon"
                          onClick={() => { setEditingGroup(g); setShowGroupForm(true) }}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <ConfirmDialog
                          title="删除分组"
                          description={`确定要删除分组「${g.name}」吗？`}
                          confirmText="删除" danger onConfirm={() => handleDeleteGroup(g.id)}
                        >
                          <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </ConfirmDialog>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center border border-dashed border-border rounded-lg text-sm text-muted-foreground">
            ← 选择左侧环境查看分组
          </div>
        )}
      </div>

      <EnvFormModal
        open={showEnvForm}
        env={editingEnv}
        onClose={() => setShowEnvForm(false)}
        onSave={async (data) => {
          try {
            if (editingEnv) {
              await environmentService.update({ id: editingEnv.id, ...data })
              toast.success('环境已更新')
            } else {
              await environmentService.create(data)
              toast.success('环境已创建')
            }
            await loadEnvironments()
            setShowEnvForm(false)
          } catch (e: any) {
            toast.error('保存失败', { description: e.message })
          }
        }}
      />

      {selectedEnv && (
        <GroupFormModal
          open={showGroupForm}
          group={editingGroup}
          onClose={() => setShowGroupForm(false)}
          onSave={async (data) => {
            try {
              if (editingGroup) {
                await groupService.update({ id: editingGroup.id, ...data })
                toast.success('分组已更新')
              } else {
                await groupService.create({ environment_id: selectedEnv.id, ...data })
                toast.success('分组已创建')
              }
              setGroups(await groupService.listByEnvironment(selectedEnv.id))
              setShowGroupForm(false)
            } catch (e: any) {
              toast.error('保存失败', { description: e.message })
            }
          }}
        />
      )}
    </div>
  )
}

function EnvFormModal({
  open, env, onClose, onSave,
}: {
  open: boolean
  env: Environment | null
  onClose: () => void
  onSave: (data: { name: string; description: string; color: string }) => Promise<void>
}) {
  const [name, setName] = useState(env?.name ?? '')
  const [description, setDescription] = useState(env?.description ?? '')
  const [color, setColor] = useState(env?.color ?? ENV_COLORS[0])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setName(env?.name ?? '')
      setDescription(env?.description ?? '')
      setColor(env?.color ?? ENV_COLORS[0])
    }
  }, [open, env])

  const handleSubmit = async () => {
    if (!name.trim()) { toast.warning('环境名称不能为空'); return }
    setSaving(true)
    try {
      await onSave({ name: name.trim(), description, color })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={env ? '编辑环境' : '新建环境'} className="max-w-sm">
      <div className="space-y-4">
        <FormField label="环境名称" required>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="例如：生产环境" />
        </FormField>
        <FormField label="描述">
          <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="可选" />
        </FormField>
        <FormField label="标识颜色">
          <div className="flex gap-2 flex-wrap pt-0.5">
            {ENV_COLORS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className="w-6 h-6 rounded-full transition-transform focus-visible:outline-none"
                style={{
                  backgroundColor: c,
                  transform: color === c ? 'scale(1.3)' : 'scale(1)',
                  boxShadow: color === c ? `0 0 0 2px var(--color-background), 0 0 0 4px ${c}` : 'none',
                }}
              />
            ))}
          </div>
        </FormField>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={handleSubmit} loading={saving}>保存</Button>
        </div>
      </div>
    </Modal>
  )
}

function GroupFormModal({
  open, group, onClose, onSave,
}: {
  open: boolean
  group: Group | null
  onClose: () => void
  onSave: (data: { name: string; description: string }) => Promise<void>
}) {
  const [name, setName] = useState(group?.name ?? '')
  const [description, setDescription] = useState(group?.description ?? '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setName(group?.name ?? '')
      setDescription(group?.description ?? '')
    }
  }, [open, group])

  const handleSubmit = async () => {
    if (!name.trim()) { toast.warning('分组名称不能为空'); return }
    setSaving(true)
    try {
      await onSave({ name: name.trim(), description })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={group ? '编辑分组' : '新建分组'} className="max-w-sm">
      <div className="space-y-4">
        <FormField label="分组名称" required>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="例如： Web 层" />
        </FormField>
        <FormField label="描述">
          <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="可选" />
        </FormField>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={handleSubmit} loading={saving}>保存</Button>
        </div>
      </div>
    </Modal>
  )
}
