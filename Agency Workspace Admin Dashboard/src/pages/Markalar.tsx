import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Icon, ICONS, Avatar, Card, Btn, PageHeader, Modal } from '../components/shared'
import { brands as initBrands, type Brand } from '../data/store'

function BrandCard({ brand, onClick }: { brand: Brand; onClick: () => void }) {
  return (
    <Card style={{ padding: '20px', cursor: 'pointer', transition: 'box-shadow 0.15s', borderTop: `3px solid ${brand.renk}` }}
      onMouseEnter={(e: any) => e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'}
      onMouseLeave={(e: any) => e.currentTarget.style.boxShadow = 'none'}
      onClick={onClick}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ width: 44, height: 44, borderRadius: 10, background: brand.renk + '18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: brand.renk }}>{brand.ad[0]}</span>
        </div>
        {brand.geciken > 0 && (
          <span style={{ fontSize: 11, background: '#fef2f2', color: '#dc2626', padding: '3px 8px', borderRadius: 20, fontWeight: 600 }}>
            {brand.geciken} gecikmiş
          </span>
        )}
      </div>

      <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 4 }}>{brand.ad}</div>
      <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 16 }}>{brand.sektor}</div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#111827', letterSpacing: '-0.03em' }}>{brand.aktifIs}</div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>Aktif İş</div>
        </div>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: brand.geciken > 0 ? '#dc2626' : '#16a34a', letterSpacing: '-0.03em' }}>{brand.geciken}</div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>Geciken</div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingTop: 12, borderTop: '1px solid #f3f4f6' }}>
        <Avatar name={brand.sorumlu} size={22} />
        <span style={{ fontSize: 12, color: '#6b7280' }}>{brand.sorumlu}</span>
      </div>
    </Card>
  )
}

export default function Markalar() {
  const navigate = useNavigate()
  const [brands] = useState<Brand[]>(initBrands)
  const [selected, setSelected] = useState<Brand | null>(null)
  const [yeniModal, setYeniModal] = useState(false)

  return (
    <div>
      <PageHeader title="Markalar" sub="Ajansın tüm müşteri ve marka portfolyosu."
        action={<Btn onClick={() => setYeniModal(true)}><Icon d={ICONS.plus} size={14} /> Marka Ekle</Btn>} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
        {brands.map(b => <BrandCard key={b.id} brand={b} onClick={() => setSelected(b)} />)}
      </div>

      {/* Detail */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.ad ?? ''} width={480}>
        {selected && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', gap: 24 }}>
              {[
                { label: 'Sektör', val: selected.sektor },
                { label: 'Sorumlu', val: selected.sorumlu },
                { label: 'Aktif İş', val: selected.aktifIs },
                { label: 'Geciken', val: selected.geciken },
              ].map(({ label, val }) => (
                <div key={label}>
                  <div style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{val}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, paddingTop: 8, borderTop: '1px solid #f3f4f6' }}>
              <Btn onClick={() => { navigate('/gorevler'); setSelected(null) }}>Görevleri Gör</Btn>
              <Btn variant="secondary" onClick={() => setSelected(null)}>Kapat</Btn>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={yeniModal} onClose={() => setYeniModal(false)} title="Yeni Marka Ekle">
        <p style={{ color: '#9ca3af', fontSize: 13 }}>Marka ekleme formu burada görüntülenecek.</p>
        <Btn variant="secondary" onClick={() => setYeniModal(false)}>Kapat</Btn>
      </Modal>
    </div>
  )
}
