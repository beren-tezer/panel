import { useState } from 'react'
import { Avatar, Card, Btn, PageHeader, Icon, ICONS } from '../components/shared'
import { team } from '../data/store'

interface MesaiEntry {
  id: string; kisi: string; tarih: string; baslangic: string; bitis: string; sure: number; proje: string
}

const initMesai: MesaiEntry[] = [
  { id: 'm1', kisi: 'Ayşe', tarih: '30 Eylül', baslangic: '09:00', bitis: '18:00', sure: 9, proje: 'Sofra Pide Reels' },
  { id: 'm2', kisi: 'Burak', tarih: '30 Eylül', baslangic: '10:00', bitis: '18:30', sure: 8.5, proje: 'Edva Kampanya' },
  { id: 'm3', kisi: 'Can', tarih: '30 Eylül', baslangic: '09:30', bitis: '17:30', sure: 8, proje: 'Tepe Emlak Web' },
  { id: 'm4', kisi: 'Selin', tarih: '30 Eylül', baslangic: '08:30', bitis: '17:00', sure: 8.5, proje: 'İçerik Yazımı' },
  { id: 'm5', kisi: 'Ali', tarih: '30 Eylül', baslangic: '10:00', bitis: '16:00', sure: 6, proje: 'Teknik Destek' },
  { id: 'm6', kisi: 'Ayşe', tarih: '29 Eylül', baslangic: '09:00', bitis: '18:00', sure: 9, proje: '3K Perde Tasarım' },
  { id: 'm7', kisi: 'Burak', tarih: '29 Eylül', baslangic: '09:30', bitis: '18:30', sure: 9, proje: 'Video Montaj' },
]

export default function Mesai() {
  const [entries] = useState<MesaiEntry[]>(initMesai)
  const [seciliGun, setSeciliGun] = useState('30 Eylül')

  const gunler = [...new Set(entries.map(e => e.tarih))]
  const filtered = entries.filter(e => e.tarih === seciliGun)
  const toplamSure = filtered.reduce((a, e) => a + e.sure, 0)

  return (
    <div>
      <PageHeader title="Mesai Takibi" sub="Ekip çalışma saatleri ve proje bazlı süre takibi"
        action={<Btn><Icon d={ICONS.plus} size={14} /> Mesai Ekle</Btn>} />

      {/* Day tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {gunler.map(g => (
          <button key={g} onClick={() => setSeciliGun(g)}
            style={{
              padding: '7px 16px', borderRadius: 8, border: '1px solid', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
              borderColor: seciliGun === g ? '#4f46e5' : '#e4e6eb',
              background: seciliGun === g ? '#eef2ff' : '#fff',
              color: seciliGun === g ? '#4f46e5' : '#6b7280',
            }}>
            {g}
          </button>
        ))}
      </div>

      {/* Summary */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 20 }}>
        <Card style={{ padding: '16px 20px', flex: 1 }}>
          <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 500, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Toplam Çalışma</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#111827', letterSpacing: '-0.03em' }}>{toplamSure} saat</div>
        </Card>
        <Card style={{ padding: '16px 20px', flex: 1 }}>
          <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 500, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Aktif Personel</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#111827', letterSpacing: '-0.03em' }}>{filtered.length}</div>
        </Card>
        <Card style={{ padding: '16px 20px', flex: 1 }}>
          <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 500, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Ort. Çalışma</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#111827', letterSpacing: '-0.03em' }}>{filtered.length ? (toplamSure / filtered.length).toFixed(1) : 0} s</div>
        </Card>
      </div>

      <Card>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
              {['Personel', 'Proje', 'Giriş', 'Çıkış', 'Süre'].map(h => (
                <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11.5, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(e => {
              const member = team.find(t => t.ad.startsWith(e.kisi))
              return (
                <tr key={e.id} style={{ borderBottom: '1px solid #f9fafb' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Avatar name={e.kisi} size={28} color={member?.renk} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{e.kisi}</div>
                        <div style={{ fontSize: 11, color: '#9ca3af' }}>{member?.rol}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: '#374151' }}>{e.proje}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: '#6b7280', fontWeight: 500 }}>{e.baslangic}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: '#6b7280', fontWeight: 500 }}>{e.bitis}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{e.sure} saat</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
