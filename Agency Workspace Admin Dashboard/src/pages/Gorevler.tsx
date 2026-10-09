import { useState, useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { Icon, ICONS, Avatar, StatusBadge, ProgressBar, Card, Btn, PageHeader, Modal } from '../components/shared'
import { tasks as initTasks, type Task, type StatusKey } from '../data/store'

const FILTERS = [
  { key: 'tumu', label: 'Tümü' },
  { key: 'gecikti', label: 'Geciken' },
  { key: 'aktif', label: 'Aktif' },
  { key: 'tamamlandi', label: 'Tamamlanan' },
  { key: 'web', label: 'Web & Teknik' },
  { key: 'ic', label: 'Ajans İçi' },
]

const TURLER = ['Tasarım', 'Video', 'Metin', 'Web', 'Teknik', 'Kampanya', 'Rapor', 'İç İş', 'Toplantı', 'Fotoğraf']

export default function Gorevler() {
  const [params, setParams] = useSearchParams()
  const filtre = params.get('filtre') ?? 'tumu'
  const araParam = params.get('ara') ?? ''

  const [gorevler, setGorevler] = useState<Task[]>(initTasks)
  const [ara, setAra] = useState(araParam)
  const [selected, setSelected] = useState<Task | null>(null)
  const [yeniModal, setYeniModal] = useState(false)
  const [yeni, setYeni] = useState({ marka: '', adi: '', sorumlu: '', tur: 'Tasarım', durum: 'Bekliyor' as StatusKey })
  const [toast, setToast] = useState('')

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  function setFiltre(key: string) {
    const next = new URLSearchParams(params)
    if (key === 'tumu') next.delete('filtre')
    else next.set('filtre', key)
    setParams(next)
  }

  const filtered = useMemo(() => {
    let list = gorevler
    if (ara) list = list.filter(t =>
      t.marka.toLowerCase().includes(ara.toLowerCase()) ||
      t.adi.toLowerCase().includes(ara.toLowerCase()) ||
      (t.sorumlu ?? '').toLowerCase().includes(ara.toLowerCase())
    )
    if (filtre === 'gecikti') list = list.filter(t => t.durum === 'Gecikti' || t.durum === 'Acil')
    if (filtre === 'aktif')   list = list.filter(t => t.durum === 'Aktif' || t.durum === 'Geliştiriliyor')
    if (filtre === 'tamamlandi') list = list.filter(t => t.durum === 'Tamamlandı' || t.durum === 'Yayına Hazır')
    if (filtre === 'web')     list = list.filter(t => t.tur === 'Web' || t.tur === 'Teknik')
    if (filtre === 'ic')      list = list.filter(t => t.tur === 'İç İş' || t.tur === 'Rapor' || t.tur === 'Toplantı')
    return list
  }, [gorevler, ara, filtre])

  function addTask() {
    if (!yeni.marka || !yeni.adi) return
    const t: Task = { id: 'new-' + Date.now(), ...yeni, progress: 0, oncelik: 'normal' }
    setGorevler(prev => [t, ...prev])
    setYeniModal(false)
    setYeni({ marka: '', adi: '', sorumlu: '', tur: 'Tasarım', durum: 'Bekliyor' })
    showToast('Yeni görev oluşturuldu.')
  }

  function updateStatus(id: string, durum: StatusKey) {
    setGorevler(prev => prev.map(t => t.id === id ? { ...t, durum } : t))
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, durum } : null)
    showToast('Durum güncellendi.')
  }

  const oncelikColor: Record<string, string> = { kritik: '#ef4444', normal: '#9ca3af', dusuk: '#d1d5db' }

  return (
    <div>
      <PageHeader
        title="Görevler"
        sub={`${gorevler.length} görev · ${gorevler.filter(t=>t.durum==='Gecikti'||t.durum==='Acil').length} gecikmiş`}
        action={
          <Btn onClick={() => setYeniModal(true)}>
            <Icon d={ICONS.plus} size={14} /> Yeni Görev
          </Btn>
        }
      />

      {/* Filters + Search */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {FILTERS.map(f => (
            <button key={f.key} onClick={() => setFiltre(f.key)} style={{
              padding: '6px 14px', borderRadius: 8, border: '1px solid',
              borderColor: filtre === f.key ? '#4f46e5' : '#e4e6eb',
              background: filtre === f.key ? '#eef2ff' : '#fff',
              color: filtre === f.key ? '#4f46e5' : '#6b7280',
              fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              transition: 'all 0.15s',
            }}>
              {f.label}
            </button>
          ))}
        </div>
        <div style={{ position: 'relative' }}>
          <div style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none' }}>
            <Icon d={ICONS.search} size={14} />
          </div>
          <input value={ara} onChange={e => setAra(e.target.value)}
            placeholder="Marka, görev veya sorumlu ara…"
            style={{ paddingLeft: 32, paddingRight: 12, height: 34, border: '1px solid #e4e6eb', borderRadius: 8, fontSize: 13, background: '#f9fafb', outline: 'none', width: 240, fontFamily: 'inherit' }} />
        </div>
      </div>

      {/* Table */}
      <Card>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
              {['Marka', 'Görev', 'Tür', 'Sorumlu', 'Teslim', 'İlerleme', 'Durum'].map(h => (
                <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11.5, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={7} style={{ padding: '32px 16px', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
                Görev bulunamadı.
              </td></tr>
            )}
            {filtered.map(t => (
              <tr key={t.id} onClick={() => setSelected(t)} style={{ borderBottom: '1px solid #f9fafb', cursor: 'pointer', transition: 'background 0.1s' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#fafbff')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: oncelikColor[t.oncelik ?? 'normal'], flexShrink: 0 }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{t.marka}</span>
                  </div>
                </td>
                <td style={{ padding: '12px 16px', fontSize: 13, color: '#374151', maxWidth: 220 }}>
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.adi}</div>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ fontSize: 12, color: '#6b7280', background: '#f3f4f6', padding: '2px 8px', borderRadius: 6 }}>{t.tur ?? '—'}</span>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  {t.sorumlu ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Avatar name={t.sorumlu} size={22} />
                      <span style={{ fontSize: 12.5, color: '#374151' }}>{t.sorumlu}</span>
                    </div>
                  ) : <span style={{ color: '#d1d5db' }}>—</span>}
                </td>
                <td style={{ padding: '12px 16px', fontSize: 12.5, color: t.durum === 'Gecikti' || t.durum === 'Acil' ? '#dc2626' : '#6b7280', whiteSpace: 'nowrap' }}>
                  {t.tarih ?? '—'}
                </td>
                <td style={{ padding: '12px 16px', width: 100 }}>
                  {t.progress !== undefined ? (
                    <div>
                      <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4 }}>%{t.progress}</div>
                      <ProgressBar value={t.progress} />
                    </div>
                  ) : <span style={{ color: '#d1d5db' }}>—</span>}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <StatusBadge label={t.durum} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Detail Modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected ? `${selected.marka} · ${selected.adi}` : ''}>
        {selected && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <StatusBadge label={selected.durum} />
              {selected.tur && <span style={{ fontSize: 12, color: '#9ca3af', background: '#f3f4f6', padding: '2px 8px', borderRadius: 6 }}>{selected.tur}</span>}
            </div>

            {selected.aciklama && (
              <p style={{ fontSize: 13, color: '#4b5563', lineHeight: 1.6, margin: 0, padding: '12px 14px', background: '#f9fafb', borderRadius: 8 }}>
                {selected.aciklama}
              </p>
            )}

            {selected.progress !== undefined && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: '#6b7280' }}>İlerleme</span>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>%{selected.progress}</span>
                </div>
                <ProgressBar value={selected.progress} />
              </div>
            )}

            <div>
              <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Durumu Güncelle</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {(['Aktif', 'Bekliyor', 'Tamamlandı', 'Yayına Hazır'] as StatusKey[]).map(s => (
                  <button key={s} onClick={() => updateStatus(selected.id, s)}
                    style={{
                      padding: '5px 12px', borderRadius: 8, border: '1px solid #e4e6eb', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
                      background: selected.durum === s ? '#eef2ff' : '#f9fafb', color: selected.durum === s ? '#4f46e5' : '#6b7280',
                      transition: 'all 0.15s',
                    }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, paddingTop: 8, borderTop: '1px solid #f3f4f6' }}>
              <Btn variant="secondary" onClick={() => setSelected(null)}>Kapat</Btn>
            </div>
          </div>
        )}
      </Modal>

      {/* New Task Modal */}
      <Modal open={yeniModal} onClose={() => setYeniModal(false)} title="Yeni Görev Oluştur">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[
            { label: 'Marka', field: 'marka', placeholder: 'Örn: Sofra Pide' },
            { label: 'Görev Adı', field: 'adi', placeholder: 'Örn: Reels Montajı' },
            { label: 'Sorumlu', field: 'sorumlu', placeholder: 'Örn: Ayşe' },
          ].map(({ label, field, placeholder }) => (
            <div key={field}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>{label}</label>
              <input value={(yeni as any)[field]} onChange={e => setYeni(p => ({ ...p, [field]: e.target.value }))}
                placeholder={placeholder}
                style={{ width: '100%', height: 38, padding: '0 12px', border: '1px solid #e4e6eb', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
            </div>
          ))}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Tür</label>
            <select value={yeni.tur} onChange={e => setYeni(p => ({ ...p, tur: e.target.value }))}
              style={{ width: '100%', height: 38, padding: '0 12px', border: '1px solid #e4e6eb', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none' }}>
              {TURLER.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8, paddingTop: 4, borderTop: '1px solid #f3f4f6' }}>
            <Btn onClick={addTask}>Kaydet</Btn>
            <Btn variant="secondary" onClick={() => setYeniModal(false)}>İptal</Btn>
          </div>
        </div>
      </Modal>

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: '#111827', color: '#fff', padding: '11px 20px', borderRadius: 10, fontSize: 13, fontWeight: 500, boxShadow: '0 4px 20px rgba(0,0,0,0.2)', zIndex: 500, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon d={ICONS.check} size={14} /> {toast}
        </div>
      )}
    </div>
  )
}
