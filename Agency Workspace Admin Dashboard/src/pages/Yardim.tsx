import { useState } from 'react'
import { Icon, ICONS, Card, Btn, PageHeader } from '../components/shared'

const SORULAR = [
  { soru: 'Yeni bir görev nasıl oluştururum?', cevap: 'Sol menüden "Görevler" sayfasına git ve sağ üstteki "Yeni Görev" butonuna tıkla. Açılan formda marka, görev adı, sorumlu ve türü gir.' },
  { soru: 'Onay bekleyen işleri nasıl görürüm?', cevap: '"Onaylar" sayfasında hem yönetici hem müşteri onaylarını görebilirsin. Genel Bakış sayfasındaki "Yönetici Onayı" kartına tıklayarak da ulaşabilirsin.' },
  { soru: 'Ekip üyesi nasıl davet ederim?', cevap: '"Ekip" sayfasında "Üye Davet Et" butonunu kullan. Davet e-postası otomatik gönderilecektir.' },
  { soru: 'İçerik takvimini nasıl kullanırım?', cevap: '"İçerik Planı" sayfasında haftalık içerik takvimine ulaşabilirsin. Her günün üstüne tıklayarak o güne içerik ekleyebilirsin.' },
  { soru: 'Geciken işlere nasıl hızlı erişirim?', cevap: 'Genel Bakış\'ta "Geciken İşler" KPI kartına tıkla ya da Görevler sayfasında "Geciken" filtresini seç.' },
]

export default function Yardim() {
  const [acik, setAcik] = useState<number | null>(null)
  const [mesaj, setMesaj] = useState('')
  const [gonderildi, setGonderildi] = useState(false)

  function gonder() {
    if (!mesaj.trim()) return
    setGonderildi(true)
    setMesaj('')
    setTimeout(() => setGonderildi(false), 3000)
  }

  return (
    <div style={{ maxWidth: 700 }}>
      <PageHeader title="Yardım Merkezi" sub="Sıkça sorulan sorular ve destek talebi." />

      {/* FAQ */}
      <Card style={{ padding: '8px 0', marginBottom: 20 }}>
        {SORULAR.map((item, i) => (
          <div key={i} style={{ borderBottom: i < SORULAR.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
            <button onClick={() => setAcik(acik === i ? null : i)}
              style={{ width: '100%', padding: '16px 20px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, fontFamily: 'inherit', textAlign: 'left' }}>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: '#111827' }}>{item.soru}</span>
              <Icon d={acik === i ? ICONS.chevDown : ICONS.chevRight} size={16} style={{ color: '#9ca3af', flexShrink: 0, transform: acik === i ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 0.2s' }} />
            </button>
            {acik === i && (
              <div style={{ padding: '0 20px 16px' }}>
                <p style={{ fontSize: 13, color: '#4b5563', margin: 0, lineHeight: 1.6 }}>{item.cevap}</p>
              </div>
            )}
          </div>
        ))}
      </Card>

      {/* Contact */}
      <Card style={{ padding: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 16 }}>Destek Talebi Gönder</div>
        {gonderildi ? (
          <div style={{ padding: '16px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, color: '#15803d', fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon d={ICONS.check} size={16} /> Talebiniz alındı. En kısa sürede yanıt vereceğiz.
          </div>
        ) : (
          <>
            <textarea value={mesaj} onChange={e => setMesaj(e.target.value)} rows={5}
              placeholder="Sorununuzu veya talebinizi buraya yazın…"
              style={{ width: '100%', padding: '12px', border: '1px solid #e4e6eb', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none', resize: 'none', boxSizing: 'border-box', marginBottom: 12 }} />
            <Btn onClick={gonder} disabled={!mesaj.trim()}>
              <Icon d={ICONS.send} size={14} /> Gönder
            </Btn>
          </>
        )}
      </Card>
    </div>
  )
}
