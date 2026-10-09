import { useState } from 'react'
import { Icon, ICONS, StatusBadge, Card, Btn, PageHeader, Modal } from '../components/shared'
import { adCampaigns as initAds, type AdCampaign, type StatusKey } from '../data/store'

export default function Reklamlar() {
  const [ads, setAds] = useState<AdCampaign[]>(initAds)
  const [selected, setSelected] = useState<AdCampaign | null>(null)
  const [toast, setToast] = useState('')

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  function updateStatus(id: string, durum: StatusKey) {
    setAds(prev => prev.map(a => a.id === id ? { ...a, durum } : a))
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, durum } : null)
    showToast('Kampanya durumu güncellendi.')
  }

  const platformColor: Record<string, string> = { Meta: '#1877f2', Google: '#ea4335' }

  const toplam = ads.reduce((sum, a) => {
    const n = parseFloat(a.butce.replace(/[^\d.]/g, ''))
    return sum + (isNaN(n) ? 0 : n)
  }, 0)

  return (
    <div>
      <PageHeader title="Reklam & Kampanya" sub={`${ads.length} kampanya · ₺${toplam.toLocaleString('tr-TR')} toplam bütçe`}
        action={<Btn><Icon d={ICONS.plus} size={14} /> Yeni Kampanya</Btn>} />

      {/* Summary row */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 20 }}>
        {[
          { label: 'Aktif Kampanya', val: ads.filter(a=>a.durum==='Aktif').length, color: '#3b82f6' },
          { label: 'Optimizasyon', val: ads.filter(a=>a.durum==='Optimizasyon').length, color: '#ea580c' },
          { label: 'Onay Bekleyen', val: ads.filter(a=>a.durum==='Yönetici Onayı').length, color: '#7c3aed' },
        ].map(item => (
          <Card key={item.label} style={{ padding: '16px 20px', flex: 1 }}>
            <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 500, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{item.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: item.color, letterSpacing: '-0.03em' }}>{item.val}</div>
          </Card>
        ))}
      </div>

      {/* Campaign cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {ads.map(ad => {
          const pct = ad.harcanan === '₺0' ? 0 :
            Math.round((parseFloat(ad.harcanan.replace(/[^\d.]/g, '')) / parseFloat(ad.butce.replace(/[^\d.]/g, ''))) * 100)
          return (
            <Card key={ad.id} style={{ padding: '18px 20px', cursor: 'pointer', transition: 'box-shadow 0.15s' }}
              onMouseEnter={(e: any) => e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'}
              onMouseLeave={(e: any) => e.currentTarget.style.boxShadow = 'none'}
              onClick={() => setSelected(ad)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                {/* Platform badge */}
                <div style={{ width: 40, height: 40, borderRadius: 10, background: platformColor[ad.platform] + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: platformColor[ad.platform] }}>{ad.platform[0]}</span>
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{ad.marka}</span>
                    <span style={{ fontSize: 13, color: '#6b7280' }}>· {ad.adi}</span>
                    <span style={{ fontSize: 11, color: platformColor[ad.platform], background: platformColor[ad.platform] + '15', padding: '1px 7px', borderRadius: 6, fontWeight: 600 }}>{ad.platform}</span>
                  </div>
                  {ad.harcanan !== '₺0' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ flex: 1, maxWidth: 200, height: 4, background: '#e9eaf0', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, background: platformColor[ad.platform], height: '100%', borderRadius: 2 }} />
                      </div>
                      <span style={{ fontSize: 11, color: '#9ca3af' }}>{ad.harcanan} / {ad.butce}</span>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{ad.butce}</div>
                    <div style={{ fontSize: 11, color: '#9ca3af' }}>Bütçe</div>
                  </div>
                  {ad.etki !== '—' && (
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#16a34a' }}>{ad.etki}</div>
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>Performans</div>
                    </div>
                  )}
                  <StatusBadge label={ad.durum} />
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected ? `${selected.marka} · ${selected.adi}` : ''}>
        {selected && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <StatusBadge label={selected.durum} />
              <span style={{ fontSize: 12, color: platformColor[selected.platform], background: platformColor[selected.platform] + '15', padding: '2px 8px', borderRadius: 6, fontWeight: 600 }}>{selected.platform}</span>
            </div>
            <div style={{ display: 'flex', gap: 20 }}>
              {[
                { label: 'Bütçe', val: selected.butce },
                { label: 'Harcanan', val: selected.harcanan },
                { label: 'Performans', val: selected.etki },
              ].map(({label, val}) => (
                <div key={label}>
                  <div style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>{val}</div>
                </div>
              ))}
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Durumu Güncelle</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {(['Aktif', 'Bekliyor', 'Optimizasyon'] as StatusKey[]).map(s => (
                  <button key={s} onClick={() => updateStatus(selected.id, s)}
                    style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid #e4e6eb', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, background: selected.durum === s ? '#eef2ff' : '#f9fafb', color: selected.durum === s ? '#4f46e5' : '#6b7280' }}>
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

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: '#111827', color: '#fff', padding: '11px 20px', borderRadius: 10, fontSize: 13, fontWeight: 500, boxShadow: '0 4px 20px rgba(0,0,0,0.2)', zIndex: 500, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon d={ICONS.check} size={14} /> {toast}
        </div>
      )}
    </div>
  )
}
