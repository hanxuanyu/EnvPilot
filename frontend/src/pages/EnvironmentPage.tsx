// EnvironmentPage.tsx 环境管理页面
// 功能：环境 CRUD + 分组管理
import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Layers, ChevronRight } from 'lucide-react'
import { useAssetStore } from '@/store/assetStore'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { environmentService, groupService } from '@/services/assetService'
import type { Environment, Group } from '@/services/assetService'
import type { CreateEnvironmentReq, CreateGroupReq } from '@/types/asset'

// 颜色选项
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
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { loadEnvironments() }, [])

  // 选中环境时加载其分组
  useEffect(() => {
    if (selectedEnv) {
      groupService.listByEnvironment(selectedEnv.id)
        .then(setGroups)
        .catch(e => setError(e.message))
    } else {
      setGroups([])
    }
  }, [selectedEnv])

  const handleDeleteEnv = async (id: number) => {
    await environmentService.delete(id)
    if (selectedEnv?.id === id) setSelectedEnv(null)
    await loadEnvironments()
  }

  const handleDeleteGroup = async (id: number) => {
    await groupService.delete(id)
    if (selectedEnv) {
      const updated = await groupService.listByEnvironment(selectedEnv.id)
      setGroups(updated)
    }
  }

  return (
    <div className="flex gap-6 h-full" style={{ animation: 'var(--animate-fade-in)' }}>
      {/* 左侧环境列表 */}
      <div className="w-72 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold" style={{ color: 'var(--color-foreground)' }}>
            环境列表
          </h2>
          <button
            onClick={() => { setEditingEnv(null); setShowEnvForm(true) }}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors"
            style={{
              backgroundColor: 'var(--color-primary)',
              color: 'var(--color-primary-foreground)',
            }}
          >
            <Plus className="w-3.5 h-3.5" />
            新建环境
          </button>
        </div>

        <div className="space-y-1.5">
          {environments.length === 0 ? (
            <div className="text-center py-12 text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
              暂无环境，点击「新建环境」开始
            </div>
          ) : (
            environments.map(env => (
              <div
                key={env.id}
                onClick={() => setSelectedEnv(env)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors border"
                style={{
                  backgroundColor: selectedEnv?.id === env.id
                    ? 'var(--color-accent)'
                    : 'var(--color-card)',
                  borderColor: selectedEnv?.id === env.id
                    ? env.color + '60'
                    : 'var(--color-border)',
                }}
              >
                {/* 环境色标 */}
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: env.color }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate" style={{ color: 'var(--color-foreground)' }}>
                    {env.name}
                  </div>
                  {env.description && (
                    <div className="text-xs truncate mt-0.5" style={{ color: 'var(--color-muted-foreground)' }}>
                      {env.description}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={e => { e.stopPropagation(); setEditingEnv(env); setShowEnvForm(true) }}
                    className="p-1 rounded hover:opacity-80"
                    style={{ color: 'var(--color-muted-foreground)' }}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <ConfirmDialog
                    title="删除环境"
                    description={`确定要删除环境「${env.name}」吗？此操作不可撤销。`}
                    confirmText="删除"
                    danger
                    onConfirm={() => handleDeleteEnv(env.id)}
                  >
                    {open => (
                      <button
                        onClick={e => { e.stopPropagation(); open() }}
                        className="p-1 rounded hover:opacity-80"
                        style={{ color: 'var(--color-muted-foreground)' }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </ConfirmDialog>
                  <ChevronRight className="w-3.5 h-3.5" style={{ color: 'var(--color-muted-foreground)' }} />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 右侧分组列表 */}
      <div className="flex-1 flex flex-col gap-3">
        {selectedEnv ? (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4" style={{ color: selectedEnv.color }} />
                <h2 className="text-base font-semibold" style={{ color: 'var(--color-foreground)' }}>
                  {selectedEnv.name} · 分组
                </h2>
              </div>
              <button
                onClick={() => { setEditingGroup(null); setShowGroupForm(true) }}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium"
                style={{
                  backgroundColor: 'var(--color-secondary)',
                  color: 'var(--color-secondary-foreground)',
                }}
              >
                <Plus className="w-3.5 h-3.5" />
                新建分组
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {groups.length === 0 ? (
                <div
                  className="col-span-3 text-center py-16 text-sm rounded-lg border border-dashed"
                  style={{
                    color: 'var(--color-muted-foreground)',
                    borderColor: 'var(--color-border)',
                  }}
                >
                  暂无分组，点击「新建分组」添加
                </div>
              ) : (
                groups.map(g => (
                  <div
                    key={g.id}
                    className="p-4 rounded-lg border"
                    style={{
                      backgroundColor: 'var(--color-card)',
                      borderColor: 'var(--color-border)',
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-sm font-medium" style={{ color: 'var(--color-foreground)' }}>
                          {g.name}
                        </div>
                        {g.description && (
                          <div className="text-xs mt-1" style={{ color: 'var(--color-muted-foreground)' }}>
                            {g.description}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => { setEditingGroup(g); setShowGroupForm(true) }}
                          className="p-1 rounded"
                          style={{ color: 'var(--color-muted-foreground)' }}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <ConfirmDialog
                          title="删除分组"
                          description={`确定要删除分组「${g.name}」吗？`}
                          confirmText="删除"
                          danger
                          onConfirm={() => handleDeleteGroup(g.id)}
                        >
                          {open => (
                            <button
                              onClick={open}
                              className="p-1 rounded"
                              style={{ color: 'var(--color-muted-foreground)' }}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </ConfirmDialog>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        ) : (
          <div
            className="flex-1 flex items-center justify-center text-sm rounded-lg border border-dashed"
            style={{
              color: 'var(--color-muted-foreground)',
              borderColor: 'var(--color-border)',
            }}
          >
            ← 选择左侧环境查看分组
          </div>
        )}
      </div>

      {/* 错误提示 */}
      {error && (
        <div
          className="fixed bottom-4 right-4 px-4 py-2 rounded-lg text-sm"
          style={{ backgroundColor: 'var(--color-destructive)', color: 'var(--color-destructive-foreground)' }}
        >
          {error}
        </div>
      )}

      {/* 环境表单弹窗 */}
      {showEnvForm && (
        <EnvFormModal
          env={editingEnv}
          onClose={() => setShowEnvForm(false)}
          onSave={async (data) => {
            if (editingEnv) {
              await environmentService.update({ id: editingEnv.id, ...data })
            } else {
              await environmentService.create(data)
            }
            await loadEnvironments()
            setShowEnvForm(false)
          }}
        />
      )}

      {/* 分组表单弹窗 */}
      {showGroupForm && selectedEnv && (
        <GroupFormModal
          group={editingGroup}
          envId={selectedEnv.id}
          onClose={() => setShowGroupForm(false)}
          onSave={async (data) => {
            if (editingGroup) {
              await groupService.update({ id: editingGroup.id, ...data })
            } else {
              await groupService.create({ environment_id: selectedEnv.id, ...data })
            }
            const updated = await groupService.listByEnvironment(selectedEnv.id)
            setGroups(updated)
            setShowGroupForm(false)
          }}
        />
      )}
    </div>
  )
}

// ── 环境表单弹窗 ──────────────────────────────────────

interface EnvFormModalProps {
  env: Environment | null
  onClose: () => void
  onSave: (data: CreateEnvironmentReq) => Promise<void>
}

function EnvFormModal({ env, onClose, onSave }: EnvFormModalProps) {
  const [name, setName] = useState(env?.name ?? '')
  const [description, setDescription] = useState(env?.description ?? '')
  const [color, setColor] = useState(env?.color ?? ENV_COLORS[0])
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const handleSubmit = async () => {
    if (!name.trim()) { setErr('环境名称不能为空'); return }
    setSaving(true)
    try {
      await onSave({ name: name.trim(), description, color })
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={env ? '编辑环境' : '新建环境'} onClose={onClose}>
      <div className="space-y-4">
        <FormField label="环境名称 *">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="例如：生产环境"
            className="w-full px-3 py-2 rounded-md text-sm border outline-none"
            style={{
              backgroundColor: 'var(--color-background)',
              borderColor: 'var(--color-border)',
              color: 'var(--color-foreground)',
            }}
          />
        </FormField>
        <FormField label="描述">
          <input
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="可选"
            className="w-full px-3 py-2 rounded-md text-sm border outline-none"
            style={{
              backgroundColor: 'var(--color-background)',
              borderColor: 'var(--color-border)',
              color: 'var(--color-foreground)',
            }}
          />
        </FormField>
        <FormField label="标识颜色">
          <div className="flex gap-2 flex-wrap">
            {ENV_COLORS.map(c => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className="w-6 h-6 rounded-full transition-transform"
                style={{
                  backgroundColor: c,
                  transform: color === c ? 'scale(1.25)' : 'scale(1)',
                  outline: color === c ? `2px solid ${c}` : 'none',
                  outlineOffset: '2px',
                }}
              />
            ))}
          </div>
        </FormField>
        {err && <p className="text-xs" style={{ color: 'var(--color-destructive)' }}>{err}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-md text-sm border"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-foreground)' }}
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-3 py-1.5 rounded-md text-sm font-medium"
            style={{
              backgroundColor: 'var(--color-primary)',
              color: 'var(--color-primary-foreground)',
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ── 分组表单弹窗 ──────────────────────────────────────

interface GroupFormModalProps {
  group: Group | null
  envId: number
  onClose: () => void
  onSave: (data: Omit<CreateGroupReq, 'environment_id'>) => Promise<void>
}

function GroupFormModal({ group, onClose, onSave }: GroupFormModalProps) {
  const [name, setName] = useState(group?.name ?? '')
  const [description, setDescription] = useState(group?.description ?? '')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const handleSubmit = async () => {
    if (!name.trim()) { setErr('分组名称不能为空'); return }
    setSaving(true)
    try {
      await onSave({ name: name.trim(), description })
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={group ? '编辑分组' : '新建分组'} onClose={onClose}>
      <div className="space-y-4">
        <FormField label="分组名称 *">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="例如：Web 层"
            className="w-full px-3 py-2 rounded-md text-sm border outline-none"
            style={{
              backgroundColor: 'var(--color-background)',
              borderColor: 'var(--color-border)',
              color: 'var(--color-foreground)',
            }}
          />
        </FormField>
        <FormField label="描述">
          <input
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="可选"
            className="w-full px-3 py-2 rounded-md text-sm border outline-none"
            style={{
              backgroundColor: 'var(--color-background)',
              borderColor: 'var(--color-border)',
              color: 'var(--color-foreground)',
            }}
          />
        </FormField>
        {err && <p className="text-xs" style={{ color: 'var(--color-destructive)' }}>{err}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-md text-sm border"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-foreground)' }}
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-3 py-1.5 rounded-md text-sm font-medium"
            style={{
              backgroundColor: 'var(--color-primary)',
              color: 'var(--color-primary-foreground)',
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ── 公共弹窗壳 ────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }} onClick={onClose} />
      <div
        className="relative z-10 rounded-lg border p-6 w-full max-w-md shadow-xl"
        style={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)' }}
      >
        <h3 className="text-base font-semibold mb-5" style={{ color: 'var(--color-foreground)' }}>
          {title}
        </h3>
        {children}
      </div>
    </div>
  )
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-muted-foreground)' }}>
        {label}
      </label>
      {children}
    </div>
  )
}
