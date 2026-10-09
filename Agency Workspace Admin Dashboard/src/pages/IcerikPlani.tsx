import { useState } from 'react'
import { Icon, ICONS, Avatar, StatusBadge, Card, Btn, PageHeader, Modal } from '../components/shared'

const GUNLER = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']
const GUNLER_FULL = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar']

interface IcerikItem {
  id: string; marka: string; tur: string; sorumlu: string; durum: string; gun: number
  saat?: string; aciklama?: string
}

const initIcerikler: IcerikItem[] = [
  { id: 'i1', marka: 'Sofra Pide', tur: 'Reels', sorumlu: 'Ayşe', durum: 'Aktif', gun: 0, saat: '09:00', aciklama: 'Menü tanıtım reelsi' },
  { id: 'i2', marka: 'Edva', tur: 'Carousel', sorumlu: 'Burak', durum: 'Bekliyor', gun: 1, saat: '11:00', aciklama: 'Ürün detay carousel' },
  { id: 'i3', marka: 'Tepe Emlak', tur: 'Story', sorumlu: 'Can', durum: 'Gecikti', gun: 1, saat: '14:00', aciklama: 'Yeni proje tanıtımı' },
  { id: 'i4', marka: '3K Perde', tur: 'Gönderi', sorumlu: 'Ayşe', durum: 'Tamamlandı', gun: 2, saat: '10:00', aciklama: 'Sezon koleksiyonu' },
  { id: 'i5', marka: 'Sofra Pide', tur: 'Video', sorumlu: 'Can', durum: 'Yönetici Onayı', gun: 3, saat: '15:00', aciklama: 'Ürün çekim montajı' },
  { id: 'i6', marka: 'Edva', tur: 'Reels', sorumlu: 'Burak', durum: 'Bekliyor', gun: 4, saat: '13:00', aciklama: 'Kampanya reelsi' },
  { id: 'i7', marka: 'Tepe Emlak', tur: 'Carousel', sorumlu: 'Ayşe', durum: 'Aktif', gun: 4, saat: '16:00', aciklama: 'Lokasyon tanıtımı' },
  { id: 'i8', marka: 'Sofra Pide', tur: 'Story', sorumlu: 'Can', durum: 'Bekliyor', gun: 5, saat: '12:00', aciklama: 'Özel gün kutlaması' },
]

const turRenk: Record<string, string> = {
  Reels: '#7c3aed', Carousel: '#2563eb', Story: '#d97706', Video: '#dc2626', Gönderi: '#16a34a',
}

const TUR_LIST = ['Reels', 'Carousel', 'Story', 'Video', 'Gönderi']
const MARKALAR_LIST = ['Sofra Pide', 'Edva', 'Tepe Emlak', '3K Perde']
const EKIP_LIST = ['Ayşe', 'Burak', 'Can', 'Selin', 'Ali']

export default function IcerikPlani() {
  const [icerikler, setIcerikler] = useState<IcerikItem[]>(initIcerikler)
  const [selected, setSelected] = useState<IcerikItem | null>(null)
  const [yeniModal, setYeniModal] = useState(false)
  const [yeni, setYeni] = useState({ marka: MARKALAR_LIST[0], tur: TUR_LIST[0], sorumlu: EKIP_LIST[0], gun: 0, saat: '10:00', aciklama: '' })

  function addItem() {
    const item: IcerikItem = { id: 'ic-' + Date.now(), ...yeni, durum: 'Bekliyor' }
    setIcerikler(prev => [...prev, item])
    setYeniModal(false)
  }

  return (
    <div>
      <PageHeader title="İçerik Planı" sub="Haftanın içerik takvimi"
        action={<Btn onClick={() => setYeniModal(true)}><Icon d={ICONS.plus} size={14} /> İçerik Ekle</Btn>} />

      {/* Weekly grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 10 }}>
        {GUNLER.map((g, idx) => (
          <div key={g}>
            <div style={{ fontSize: 12, fontWeight: 700, color: idx < 5 ? '#111827' : '#9ca3af', textAlign: 'center', marginBottom: 8, padding: '6px 0' }}>
              {GUNLER_FULL[idx]}
            </div>
            <div style={{ minHeight: 180, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {icerikler.filter(ic => ic.gun === idx).map(ic => (
                <div key={ic.id} onClick={() => setSelected(ic)}
                  style={{
                    background: turRenk[ic.tur] + '12', border: `1px solid ${turRenk[ic.tur]}30`,
                    borderLeft: `3px solid ${turRenk[ic.tur]}`, borderRadius: 8,
                    padding: '8px 10px', cursor: 'pointer', transition: 'transform 0.1s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.02)')}
                  onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: turRenk[ic.tur], marginBottom: 3 }}>{ic.tur}</div>
                  <div style={{ fontSize: 11.5, fontWeight: 600, color: '#111827', marginBottom: 2 }}>{ic.marka}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                    <Avatar name={ic.sorumlu} size={14} />
                    <span style={{ fontSize: 10, color: '#9ca3af' }}>{ic.sorumlu} · {ic.saat}</span>
                  </div>
                </div>
              ))}
              <button onClick={() => { setYeni(p => ({ ...p, gun: idx })); setYeniModal(true) }}
                style={{ background: 'none', border: '1px dashed #d1d5db', borderRadius: 8, padding: '8px', cursor: 'pointer', color: '#9ca3af', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                <Icon d={ICONS.plus} size={12} /> Ekle
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Detail modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected ? `${selected.marka} · ${selected.tur}` : ''}>
        {selected && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <StatusBadge label={selected.durum} />
            <div style={{ display: 'flex', gap: 20 }}>
              {[
                { label: 'Gün', val: GUNLER_FULL[selected.gun] },
                { label: 'Saat', val: selected.saat ?? '—' },
                { label: 'Sorumlu', val: selected.sorumlu },
              ].map(({ label, val }) => (
                <div key={label}>
                  <div style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{val}</div>
                </div>
              ))}
            </div>
            {selected.aciklama && <p style={{ fontSize: 13, color: '#4b5563', margin: 0, lineHeight: 1.5, padding: '10px 12px', background: '#f9fafb', borderRadius: 8 }}>{selected.aciklama}</p>}
            <Btn variant="secondary" onClick={() => setSelected(null)}>Kapat</Btn>
          </div>
        )}
      </Modal>

      {/* Add modal */}
      <Modal open={yeniModal} onClose={() => setYeniModal(false)} title="İçerik Ekle">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[
            { label: 'Marka', field: 'marka', options: MARKALAR_LIST },
            { label: 'Tür', field: 'tur', options: TUR_LIST },
            { label: 'Sorumlu', field: 'sorumlu', options: EKIP_LIST },
            { label: 'Gün', field: 'gun', options: GUNLER_FULL, isIndex: true },
          ].map(({ label, field, options, isIndex }) => (
            <div key={field}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>{label}</label>
              <select value={(yeni as any)[field]} onChange={e => setYeni(p => ({ ...p, [field]: isIndex ? parseInt(e.target.value) : e.target.value }))}
                style={{ width: '100%', height: 38, padding: '0 12px', border: '1px solid #e4e6eb', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none' }}>
                {options.map((o, i) => <option key={o} value={isIndex ? i : o}>{o}</option>)}
              </select>
            </div>
          ))}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Saat</label>
            <input type="time" value={yeni.saat} onChange={e => setYeni(p => ({ ...p, saat: e.target.value }))}
              style={{ width: '100%', height: 38, padding: '0 12px', border: '1px solid #e4e6eb', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Açıklama</label>
            <textarea value={yeni.aciklama} onChange={e => setYeni(p => ({ ...p, aciklama: e.target.value }))} rows={3}
              placeholder="İçerik açıklaması…"
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #e4e6eb', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none', resize: 'none', boxSizing: 'border-box' }} />
          </div>
          <div style={{ display: 'flex', gap: 8, paddingTop: 4, borderTop: '1px solid #f3f4f6' }}>
            <Btn onClick={addItem}>Kaydet</Btn>
            <Btn variant="secondary" onClick={() => setYeniModal(false)}>İptal</Btn>
          </div>
        </div>
      </Modal>
    </div>
  )
}
