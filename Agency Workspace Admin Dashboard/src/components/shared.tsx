import type { StatusKey } from '../data/store'

// ── SVG Icon ──────────────────────────────────────────────────────────────────
export function Icon({ d, size = 16, strokeWidth = 1.7, className = '', style }: {
  d: string; size?: number; strokeWidth?: number; className?: string; style?: React.CSSProperties
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
      <path d={d} />
    </svg>
  )
}

export const ICONS = {
  home:      'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10',
  calendar:  'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z',
  tasks:     'M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11',
  brands:    'M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z M7 7h.01',
  approvals: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0',
  team:      'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75',
  time:      'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0',
  ads:       'M11 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-6M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z',
  settings:  'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z',
  help:      'M12 22a10 10 0 100-20 10 10 0 000 20zM9.09 9a3 3 0 015.83 1c0 2-3 3-3 3M12 17h.01',
  search:    'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0',
  bell:      'M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0',
  alert:     'M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01',
  check:     'M20 6L9 17l-5-5',
  clock:     'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0',
  more:      'M12 5v.01M12 12v.01M12 19v.01',
  trendUp:   'M23 6l-9.5 9.5-5-5L1 18M17 6h6v6',
  x:         'M18 6L6 18M6 6l12 12',
  edit:      'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z',
  plus:      'M12 5v14M5 12h14',
  image:     'M21 19a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h4l2-3h4l2 3h4a2 2 0 012 2z M12 13a3 3 0 100-6 3 3 0 000 6',
  trash:     'M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6',
  filter:    'M22 3H2l8 9.46V19l4 2v-8.54L22 3',
  eye:       'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 9a3 3 0 100 6 3 3 0 000-6',
  chevDown:  'M6 9l6 6 6-6',
  chevRight: 'M9 18l6-6-6-6',
  send:      'M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z',
  link:      'M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71',
  bar:       'M18 20V10M12 20V4M6 20v-6',
  user:      'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8',
}

// ── Avatar ────────────────────────────────────────────────────────────────────
export const AVATAR_COLORS: Record<string, string> = {
  'Ayşe': '#7c3aed', 'Burak': '#2563eb', 'Can': '#059669',
  'Ahmet': '#4f46e5', 'Ekip': '#6b7280', 'Ali': '#ea580c',
  'Selin': '#db2777', 'Mert': '#4f46e5',
}

export function Avatar({ name, size = 28, color }: { name: string; size?: number; color?: string }) {
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const bg = color ?? AVATAR_COLORS[name.split(' ')[0]] ?? '#4f46e5'
  return (
    <span style={{ width: size, height: size, background: bg, fontSize: size * 0.38, flexShrink: 0 }}
      className="inline-flex items-center justify-center rounded-full text-white font-semibold select-none">
      {initials}
    </span>
  )
}

// ── Status Badge ──────────────────────────────────────────────────────────────
export const STATUS_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  'Başlanmadı':      { bg: '#f3f4f6', text: '#4b5563', dot: '#9ca3af' },
  'Çalışılıyor':     { bg: '#eff6ff', text: '#1d4ed8', dot: '#3b82f6' },
  'Aktif':           { bg: '#eff6ff', text: '#1d4ed8', dot: '#3b82f6' },
  'Bekliyor':        { bg: '#f3f4f6', text: '#6b7280', dot: '#9ca3af' },
  'Gecikti':         { bg: '#fef2f2', text: '#dc2626', dot: '#ef4444' },
  'Acil':            { bg: '#fef2f2', text: '#dc2626', dot: '#dc2626' },
  'Yönetici Onayı': { bg: '#f5f3ff', text: '#6d28d9', dot: '#7c3aed' },
  'Müşteri Onayı':  { bg: '#fffbeb', text: '#b45309', dot: '#d97706' },
  'Revizyon':        { bg: '#fff7ed', text: '#c2410c', dot: '#ea580c' },
  'Tamamlandı':      { bg: '#f0fdf4', text: '#15803d', dot: '#16a34a' },
  'Yayına Hazır':   { bg: '#f0fdf4', text: '#15803d', dot: '#16a34a' },
  'Geliştiriliyor': { bg: '#eff6ff', text: '#1d4ed8', dot: '#3b82f6' },
  'İnceleniyor':    { bg: '#f5f3ff', text: '#6d28d9', dot: '#7c3aed' },
  'Optimizasyon':   { bg: '#fff7ed', text: '#c2410c', dot: '#ea580c' },
  'Reddedildi':     { bg: '#fef2f2', text: '#991b1b', dot: '#ef4444' },
  'Onaylandı':      { bg: '#f0fdf4', text: '#166534', dot: '#22c55e' },
}

export function StatusBadge({ label }: { label: string }) {
  const s = STATUS_STYLES[label] ?? { bg: '#f3f4f6', text: '#6b7280', dot: '#9ca3af' }
  return (
    <span style={{ background: s.bg, color: s.text }}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap">
      <span style={{ background: s.dot }} className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0" />
      {label}
    </span>
  )
}

// ── Progress Bar ──────────────────────────────────────────────────────────────
export function ProgressBar({ value }: { value: number }) {
  const color = value >= 75 ? '#16a34a' : value >= 50 ? '#4f46e5' : '#d97706'
  return (
    <div style={{ height: 4, background: '#e9eaf0', borderRadius: 2, overflow: 'hidden' }}>
      <div style={{ width: `${value}%`, background: color, height: '100%', transition: 'width 0.4s ease', borderRadius: 2 }} />
    </div>
  )
}

// ── Card wrapper ──────────────────────────────────────────────────────────────
export function Card({ children, style, className }: { children: React.ReactNode; style?: React.CSSProperties; className?: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e4e6eb', borderRadius: 12, ...style }} className={className}>
      {children}
    </div>
  )
}

// ── Button ────────────────────────────────────────────────────────────────────
export function Btn({ children, onClick, variant = 'primary', size = 'md', disabled, style }: {
  children: React.ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success'
  size?: 'sm' | 'md'
  disabled?: boolean
  style?: React.CSSProperties
}) {
  const base: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    border: 'none', cursor: disabled ? 'not-allowed' : 'pointer', borderRadius: 8,
    fontFamily: 'inherit', fontWeight: 600, transition: 'all 0.15s', opacity: disabled ? 0.5 : 1,
    fontSize: size === 'sm' ? 12 : 13,
    padding: size === 'sm' ? '5px 12px' : '8px 16px',
  }
  const variants: Record<string, React.CSSProperties> = {
    primary:   { background: '#4f46e5', color: '#fff' },
    secondary: { background: '#f3f4f6', color: '#374151', border: '1px solid #e4e6eb' },
    danger:    { background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' },
    ghost:     { background: 'transparent', color: '#6b7280' },
    success:   { background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' },
  }
  return (
    <button onClick={disabled ? undefined : onClick} style={{ ...base, ...variants[variant], ...style }}>
      {children}
    </button>
  )
}

// ── Task Row ──────────────────────────────────────────────────────────────────
export function TaskRow({ marka, adi, sorumlu, tarih, durum, progress, onClick }: {
  marka: string; adi: string; sorumlu?: string; tarih?: string
  durum?: string; progress?: number; onClick?: () => void
}) {
  return (
    <div onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '9px 0', borderBottom: '1px solid #f3f4f6',
      cursor: onClick ? 'pointer' : 'default',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#111827', whiteSpace: 'nowrap' }}>{marka}</span>
          <span style={{ width: 3, height: 3, background: '#d1d5db', borderRadius: '50%', flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: '#4b5563', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{adi}</span>
        </div>
        {(sorumlu || tarih) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {sorumlu && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#9ca3af' }}>
                <Avatar name={sorumlu} size={14} />
                {sorumlu}
              </span>
            )}
            {tarih && <span style={{ fontSize: 11, color: '#9ca3af' }}>{sorumlu ? '· ' : ''}{tarih}</span>}
          </div>
        )}
        {progress !== undefined && (
          <div style={{ marginTop: 5 }}>
            <ProgressBar value={progress} />
          </div>
        )}
      </div>
      {durum && <StatusBadge label={durum} />}
    </div>
  )
}

// ── Page Header ───────────────────────────────────────────────────────────────
export function PageHeader({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: 0, letterSpacing: '-0.025em' }}>{title}</h1>
        {sub && <p style={{ fontSize: 13, color: '#9ca3af', marginTop: 4, marginBottom: 0 }}>{sub}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}

// ── Empty State ───────────────────────────────────────────────────────────────
export function EmptyState({ text }: { text: string }) {
  return (
    <div style={{ padding: '32px 0', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
      {text}
    </div>
  )
}

// ── Modal ─────────────────────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, width = 520 }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode; width?: number
}) {
  if (!open) return null
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 14, width, maxHeight: '80vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 16px', borderBottom: '1px solid #e4e6eb' }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>{title}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 4 }}>
            <Icon d={ICONS.x} size={18} />
          </button>
        </div>
        <div style={{ padding: 24 }}>{children}</div>
      </div>
    </div>
  )
}
