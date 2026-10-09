import { useState } from 'react'
import { Avatar, Card, Btn, PageHeader, Icon, ICONS } from '../components/shared'

export default function Ayarlar() {
  const [profil, setProfil] = useState({
    ad: 'Ahmet Yıldız', rol: 'Ajans Yöneticisi',
    email: 'yonetici@example.com', telefon: '+90 555 123 4567',
    ajans: 'Atlas Ajans', website: 'www.atlasajans.example',
  })
  const [notifAyar, setNotifAyar] = useState({
    gecikme: true, onay: true, musteri: true, tamamlandi: false,
  })
  const [saved, setSaved] = useState(false)

  function save() {
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <PageHeader title="Ayarlar" sub="Profil ve uygulama tercihlerini yönet." />

      {/* Profile */}
      <Card style={{ padding: 24, marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 20 }}>Profil Bilgileri</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          <Avatar name="Ahmet Yıldız" size={56} color="#4f46e5" />
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>{profil.ad}</div>
            <div style={{ fontSize: 12, color: '#9ca3af' }}>{profil.rol}</div>
          </div>
          <Btn variant="secondary" size="sm" style={{ marginLeft: 'auto' }}>
            <Icon d={ICONS.edit} size={13} /> Fotoğraf Değiştir
          </Btn>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {[
            { label: 'Ad Soyad', field: 'ad' },
            { label: 'Rol', field: 'rol' },
            { label: 'E-posta', field: 'email' },
            { label: 'Telefon', field: 'telefon' },
            { label: 'Ajans Adı', field: 'ajans' },
            { label: 'Web Sitesi', field: 'website' },
          ].map(({ label, field }) => (
            <div key={field}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>{label}</label>
              <input
                value={(profil as any)[field]}
                onChange={e => setProfil(p => ({ ...p, [field]: e.target.value }))}
                style={{ width: '100%', height: 38, padding: '0 12px', border: '1px solid #e4e6eb', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', color: '#111827' }}
              />
            </div>
          ))}
        </div>
      </Card>

      {/* Notifications */}
      <Card style={{ padding: 24, marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 20 }}>Bildirim Tercihleri</div>
        {[
          { key: 'gecikme', label: 'Geciken işler', sub: 'İş geciktiğinde bildirim al' },
          { key: 'onay', label: 'Onay istekleri', sub: 'Yönetici onayı gereken işler için' },
          { key: 'musteri', label: 'Müşteri yanıtları', sub: 'Müşteri onay verdiğinde veya geri bildirim yaptığında' },
          { key: 'tamamlandi', label: 'Tamamlanan işler', sub: 'Ekip üyesi işi bitirdiğinde' },
        ].map(item => (
          <div key={item.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #f3f4f6' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{item.label}</div>
              <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{item.sub}</div>
            </div>
            <button
              onClick={() => setNotifAyar(p => ({ ...p, [item.key]: !p[item.key as keyof typeof p] }))}
              style={{
                width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0,
                background: notifAyar[item.key as keyof typeof notifAyar] ? '#4f46e5' : '#d1d5db',
                position: 'relative',
              }}>
              <span style={{
                position: 'absolute', top: 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left 0.2s',
                left: notifAyar[item.key as keyof typeof notifAyar] ? 23 : 3,
              }} />
            </button>
          </div>
        ))}
      </Card>

      {/* Danger zone */}
      <Card style={{ padding: 24, marginBottom: 24, border: '1px solid #fecaca' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#dc2626', marginBottom: 12 }}>Tehlikeli Bölge</div>
        <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 16px' }}>Bu işlemler geri alınamaz. Dikkatli ol.</p>
        <Btn variant="danger">Hesabı Sil</Btn>
      </Card>

      <div style={{ display: 'flex', gap: 8 }}>
        <Btn onClick={save}>
          {saved ? <><Icon d={ICONS.check} size={14} /> Kaydedildi</> : 'Değişiklikleri Kaydet'}
        </Btn>
        <Btn variant="secondary">İptal</Btn>
      </div>

      {saved && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: '#111827', color: '#fff', padding: '11px 20px', borderRadius: 10, fontSize: 13, fontWeight: 500, boxShadow: '0 4px 20px rgba(0,0,0,0.2)', zIndex: 500, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon d={ICONS.check} size={14} /> Değişiklikler başarıyla kaydedildi.
        </div>
      )}
    </div>
  )
}
