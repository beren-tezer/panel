import { useState, useRef, useEffect } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router'
import { Icon, ICONS, Avatar } from '../components/shared'
import { notifications as initNotifs, type Notification } from '../data/store'

const NAV_ITEMS = [
  { label: 'Günlük Akış',  path: '/',          icon: 'home' },
  { label: 'Genel Bakış',  path: '/genel-bakis', icon: 'bar' },
  { label: 'İçerik Planı', path: '/icerik',    icon: 'calendar' },
  { label: 'Görevler',     path: '/gorevler',  icon: 'tasks' },
  { label: 'Markalar',     path: '/markalar',  icon: 'brands' },
  { label: 'Onaylar',      path: '/onaylar',   icon: 'approvals' },
  { label: 'Ekip',         path: '/ekip',      icon: 'team' },
  { label: 'Mesai',        path: '/mesai',     icon: 'time' },
  { label: 'Reklamlar',    path: '/reklamlar', icon: 'ads' },
]

export default function Root() {
  const navigate = useNavigate()
  const [notifs, setNotifs] = useState<Notification[]>(initNotifs)
  const [showNotifs, setShowNotifs] = useState(false)
  const [searchVal, setSearchVal] = useState('')
  const bellRef = useRef<HTMLButtonElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)

  const unread = notifs.filter(n => !n.okundu).length

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node) &&
          bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setShowNotifs(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function markAllRead() {
    setNotifs(ns => ns.map(n => ({ ...n, okundu: true })))
  }

  function handleSearch(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && searchVal.trim()) {
      navigate(`/gorevler?ara=${encodeURIComponent(searchVal.trim())}`)
      setSearchVal('')
    }
  }

  const tipIcon: Record<string, string> = {
    gecikme: ICONS.alert,
    onay: ICONS.approvals,
    musteri: ICONS.user,
    tamamlandi: ICONS.check,
  }
  const tipColor: Record<string, string> = {
    gecikme: '#ef4444', onay: '#7c3aed', musteri: '#d97706', tamamlandi: '#16a34a',
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#f1f2f5', fontFamily: 'Inter, system-ui, sans-serif', overflow: 'hidden' }}>

      {/* ── Sidebar ── */}
      <aside style={{ width: 240, borderRight: '1px solid #e4e6eb', background: '#fff', flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
        {/* Logo */}
        <div style={{ padding: '24px 20px 16px' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#111827', letterSpacing: '-0.02em' }}>AGENCYOS</div>
          <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 500, marginTop: 2, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Workspace</div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, overflowY: 'auto', padding: '4px 12px' }}>
          {NAV_ITEMS.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                padding: '9px 10px', borderRadius: 8, textDecoration: 'none',
                marginBottom: 2,
                background: isActive ? '#eef2ff' : 'transparent',
                color: isActive ? '#4f46e5' : '#6b7280',
                fontWeight: isActive ? 600 : 400,
                fontSize: 13.5,
                transition: 'all 0.15s',
              })}
            >
              {({ isActive }) => (
                <>
                  <Icon d={ICONS[item.icon as keyof typeof ICONS]} size={16} strokeWidth={isActive ? 2 : 1.7} />
                  {item.label}
                </>
              )}
            </NavLink>
          ))}

          <div style={{ margin: '12px 0', borderTop: '1px solid #e4e6eb' }} />

          {[
            { label: 'Ayarlar', path: '/ayarlar', icon: 'settings' },
            { label: 'Yardım',  path: '/yardim',  icon: 'help' },
          ].map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                padding: '9px 10px', borderRadius: 8, textDecoration: 'none',
                marginBottom: 2,
                background: isActive ? '#eef2ff' : 'transparent',
                color: isActive ? '#4f46e5' : '#6b7280',
                fontWeight: isActive ? 600 : 400,
                fontSize: 13.5, transition: 'all 0.15s',
              })}
            >
              {({ isActive }) => (
                <>
                  <Icon d={ICONS[item.icon as keyof typeof ICONS]} size={16} strokeWidth={isActive ? 2 : 1.7} />
                  {item.label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <button
          onClick={() => navigate('/ayarlar')}
          style={{ padding: '14px 16px 20px', borderTop: '1px solid #e4e6eb', display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%' }}
        >
          <Avatar name="Ahmet Yıldız" size={32} color="#4f46e5" />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>Ahmet Yıldız</div>
            <div style={{ fontSize: 11, color: '#9ca3af' }}>Ajans Yöneticisi</div>
          </div>
        </button>
      </aside>

      {/* ── Main ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <header style={{ background: '#fff', borderBottom: '1px solid #e4e6eb', padding: '0 28px', height: 68, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#111827', letterSpacing: '-0.025em' }}>
              Operasyon Merkezi
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 12.5, color: '#6b7280', fontWeight: 500 }}>30 Eylül 2026</span>

            {/* Search */}
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none' }}>
                <Icon d={ICONS.search} size={14} />
              </div>
              <input
                value={searchVal}
                onChange={e => setSearchVal(e.target.value)}
                onKeyDown={handleSearch}
                placeholder="Görev ara… (Enter)"
                style={{
                  paddingLeft: 32, paddingRight: 12, height: 34,
                  border: '1px solid #e4e6eb', borderRadius: 8,
                  fontSize: 13, color: '#111827', background: '#f9fafb',
                  outline: 'none', width: 210, fontFamily: 'inherit',
                }}
              />
            </div>

            {/* Bell */}
            <div style={{ position: 'relative' }}>
              <button ref={bellRef} onClick={() => setShowNotifs(v => !v)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: 6, borderRadius: 8, position: 'relative', display: 'flex' }}>
                <Icon d={ICONS.bell} size={20} />
                {unread > 0 && (
                  <span style={{ position: 'absolute', top: 2, right: 2, width: 9, height: 9, background: '#ef4444', borderRadius: '50%', border: '2px solid #fff', fontSize: 0 }} />
                )}
              </button>

              {showNotifs && (
                <div ref={dropRef} style={{
                  position: 'absolute', top: '110%', right: 0, width: 320, background: '#fff',
                  border: '1px solid #e4e6eb', borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                  zIndex: 200, overflow: 'hidden',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 10px', borderBottom: '1px solid #f3f4f6' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>Bildirimler</span>
                    <button onClick={markAllRead} style={{ fontSize: 11, color: '#4f46e5', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>Tümünü okundu işaretle</button>
                  </div>
                  {notifs.map(n => (
                    <div key={n.id} onClick={() => setNotifs(ns => ns.map(x => x.id === n.id ? { ...x, okundu: true } : x))}
                      style={{ display: 'flex', gap: 10, padding: '10px 16px', background: n.okundu ? '#fff' : '#fafbff', borderBottom: '1px solid #f3f4f6', cursor: 'pointer' }}>
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: tipColor[n.tip] + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', color: tipColor[n.tip], flexShrink: 0 }}>
                        <Icon d={tipIcon[n.tip]} size={14} />
                      </div>
                      <div>
                        <div style={{ fontSize: 12, color: '#111827', fontWeight: n.okundu ? 400 : 600 }}>{n.mesaj}</div>
                        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{n.zaman}</div>
                      </div>
                      {!n.okundu && <span style={{ width: 6, height: 6, background: '#4f46e5', borderRadius: '50%', flexShrink: 0, marginTop: 4 }} />}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button onClick={() => navigate('/ayarlar')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              <Avatar name="Ahmet Yıldız" size={34} color="#4f46e5" />
            </button>
          </div>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, overflowY: 'auto', padding: '24px 28px 32px' }}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
