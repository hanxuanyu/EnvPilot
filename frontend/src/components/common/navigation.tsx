import {
  Activity,
  ClipboardList,
  Database,
  Globe,
  LayoutDashboard,
  Layers,
  type LucideIcon,
  Server,
  Settings,
  Terminal,
} from 'lucide-react'

export interface HeaderAction {
  label: string
  to: string
}

export interface NavItem {
  path: string
  label: string
  icon: LucideIcon
  keywords?: string[]
}

export interface NavGroup {
  group: string
  items: NavItem[]
}

export interface RouteMeta {
  path: string
  match: 'exact' | 'prefix'
  group: string
  title: string
  description: string
  actions: HeaderAction[]
}

export interface BreadcrumbItem {
  label: string
  to?: string
}

export interface CommandItem {
  id: string
  type: 'page' | 'action'
  group: string
  label: string
  description: string
  to: string
  keywords: string[]
}

export const navGroups: NavGroup[] = [
  {
    group: '概览',
    items: [
      { path: '/', label: '仪表盘', icon: LayoutDashboard, keywords: ['dashboard', 'home', 'overview'] },
    ],
  },
  {
    group: '资产管理',
    items: [
      { path: '/assets', label: '资产列表', icon: Server, keywords: ['asset', 'server', 'middleware'] },
      { path: '/environments', label: '环境管理', icon: Layers, keywords: ['environment', 'group'] },
    ],
  },
  {
    group: '运维操作',
    items: [
      { path: '/executor', label: '命令执行', icon: Terminal, keywords: ['executor', 'command', 'batch'] },
      { path: '/terminal', label: '在线终端', icon: Terminal, keywords: ['terminal', 'shell', 'ssh'] },
      { path: '/connector', label: '中间件', icon: Database, keywords: ['connector', 'mysql', 'redis', 'mq'] },
    ],
  },
  {
    group: '基础设施',
    items: [
      { path: '/dns', label: 'DNS 管理', icon: Globe, keywords: ['dns', 'record', 'resolve'] },
      { path: '/health', label: '健康检查', icon: Activity, keywords: ['health', 'probe', 'status'] },
    ],
  },
  {
    group: '系统',
    items: [
      { path: '/audit', label: '操作审计', icon: ClipboardList, keywords: ['audit', 'log', 'history'] },
      { path: '/config', label: '系统配置', icon: Settings, keywords: ['config', 'setting', 'snapshot'] },
    ],
  },
]

export const routeMetaList: RouteMeta[] = [
  {
    path: '/',
    match: 'exact',
    group: '概览',
    title: '仪表盘',
    description: '汇总关键运行状态、主机资源、最近审计与执行动态。',
    actions: [
      { label: '资产列表', to: '/assets' },
      { label: '命令执行', to: '/executor' },
      { label: '系统配置', to: '/config' },
    ],
  },
  {
    path: '/assets',
    match: 'exact',
    group: '资产管理',
    title: '资产列表',
    description: '统一管理服务器与中间件资产、凭据和分组关系。',
    actions: [
      { label: '环境管理', to: '/environments' },
      { label: '健康检查', to: '/health' },
    ],
  },
  {
    path: '/environments',
    match: 'exact',
    group: '资产管理',
    title: '环境管理',
    description: '组织环境与资产分组，控制后续筛选、监控和执行范围。',
    actions: [
      { label: '资产列表', to: '/assets' },
      { label: '健康检查', to: '/health' },
    ],
  },
  {
    path: '/executor',
    match: 'exact',
    group: '运维操作',
    title: '命令执行',
    description: '面向批量运维和审计联动的命令执行台。',
    actions: [
      { label: '在线终端', to: '/terminal' },
      { label: '操作审计', to: '/audit' },
    ],
  },
  {
    path: '/terminal',
    match: 'prefix',
    group: '运维操作',
    title: '在线终端',
    description: '直接进入资产终端会话，适合单点排障与实时操作。',
    actions: [
      { label: '命令执行', to: '/executor' },
      { label: '资产列表', to: '/assets' },
    ],
  },
  {
    path: '/connector',
    match: 'prefix',
    group: '运维操作',
    title: '中间件连接器',
    description: '按类型管理数据库、缓存与消息队列连接操作。',
    actions: [
      { label: '资产列表', to: '/assets' },
      { label: '操作审计', to: '/audit' },
    ],
  },
  {
    path: '/dns',
    match: 'exact',
    group: '基础设施',
    title: 'DNS 管理',
    description: '管理解析记录、运行状态与查询日志。',
    actions: [
      { label: '健康检查', to: '/health' },
      { label: '资产列表', to: '/assets' },
    ],
  },
  {
    path: '/health',
    match: 'exact',
    group: '基础设施',
    title: '健康检查',
    description: '聚合资产可达性、延迟与运行状态，快速识别异常节点。',
    actions: [
      { label: 'DNS 管理', to: '/dns' },
      { label: '资产列表', to: '/assets' },
    ],
  },
  {
    path: '/audit',
    match: 'exact',
    group: '系统',
    title: '操作审计',
    description: '查看变更日志、执行历史和高风险操作记录。',
    actions: [
      { label: '命令执行', to: '/executor' },
      { label: '系统配置', to: '/config' },
    ],
  },
  {
    path: '/config',
    match: 'exact',
    group: '系统',
    title: '系统配置',
    description: '集中调整系统参数、管理快照并触发热更新。',
    actions: [
      { label: '操作审计', to: '/audit' },
      { label: '仪表盘', to: '/' },
    ],
  },
]

export function findRouteMeta(pathname: string) {
  const normalized = pathname === '/' ? '/' : pathname.replace(/\/+$/, '')
  const exactMatch = routeMetaList.find((item) => item.match === 'exact' && item.path === normalized)
  if (exactMatch) return exactMatch

  const prefixMatch = [...routeMetaList]
    .filter((item) => item.match === 'prefix' && normalized.startsWith(item.path))
    .sort((left, right) => right.path.length - left.path.length)[0]

  return prefixMatch ?? routeMetaList[0]
}

export function getBreadcrumbs(meta: RouteMeta): BreadcrumbItem[] {
  if (meta.path === '/') {
    return [
      { label: '首页', to: '/' },
      { label: meta.title },
    ]
  }

  return [
    { label: '首页', to: '/' },
    { label: meta.group },
    { label: meta.title },
  ]
}

export const commandItems: CommandItem[] = [
  ...navGroups.flatMap((group) =>
    group.items.map((item) => {
      const routeMeta = routeMetaList.find((meta) => meta.path === item.path) ?? routeMetaList[0]
      return {
        id: `page:${item.path}`,
        type: 'page' as const,
        group: group.group,
        label: item.label,
        description: routeMeta.description,
        to: item.path,
        keywords: [item.label, group.group, ...(item.keywords ?? [])],
      }
    })
  ),
  ...routeMetaList.flatMap((meta) =>
    meta.actions.map((action) => ({
      id: `action:${meta.path}:${action.to}:${action.label}`,
      type: 'action' as const,
      group: `${meta.title} · 快捷操作`,
      label: action.label,
      description: `从${meta.title}快速跳转到${action.label}`,
      to: action.to,
      keywords: [meta.title, action.label, meta.group],
    }))
  ),
]