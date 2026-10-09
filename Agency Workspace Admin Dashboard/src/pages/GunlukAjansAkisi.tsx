import { useMemo, useState } from 'react'
import { Avatar, Btn, Card, Icon, ICONS, StatusBadge } from '../components/shared'

type AkisDurumu =
  | 'Başlanmadı'
  | 'Çalışılıyor'
  | 'Yönetici Onayı'
  | 'Müşteri Onayı'
  | 'Revizyon'
  | 'Tamamlandı'
  | 'Gecikti'

type Oncelik = 'Yüksek' | 'Orta' | 'Düşük'
type IcerikTuru = 'REELS' | 'POST' | 'STORY' | 'CAROUSEL' | 'VIDEO' | 'WEB' | 'ADS'

interface AkisGorevi {
  id: string
  baslik: string
  marka: string
  tur: IcerikTuru
  sorumlu: string
  teslim: string
  durum: AkisDurumu
  oncelik: Oncelik
  sonGuncelleme: string
  brief: string
  dosyaSayisi: number
  yorumSayisi: number
  revizyonSayisi: number
}

const MARKALAR = ['Sofra Pide', 'Tepe Emlak', '3 Kartal Perde', 'Edva']
const DURUMLAR: AkisDurumu[] = [
  'Başlanmadı',
  'Çalışılıyor',
  'Yönetici Onayı',
  'Müşteri Onayı',
  'Revizyon',
  'Tamamlandı',
  'Gecikti',
]
const TURLER: IcerikTuru[] = ['REELS', 'POST', 'STORY', 'CAROUSEL', 'VIDEO', 'WEB', 'ADS']
const CALISANLAR = ['Ayşe Demir', 'Burak Yılmaz', 'Can Şahin', 'Selin Arslan']
const NORMAL_AKIS: AkisDurumu[] = [
  'Başlanmadı',
  'Çalışılıyor',
  'Yönetici Onayı',
  'Müşteri Onayı',
  'Tamamlandı',
]

const ILK_GOREVLER: AkisGorevi[] = [
  {
    id: 'G-1048',
    baslik: 'Yeni menü lansmanı Reels montajı',
    marka: 'Sofra Pide',
    tur: 'REELS',
    sorumlu: 'Burak Yılmaz',
    teslim: '10:30',
    durum: 'Gecikti',
    oncelik: 'Yüksek',
    sonGuncelleme: '09:42',
    brief: 'Yeni sonbahar menüsündeki dört ana ürünün hızlı geçişlerle anlatıldığı 30 saniyelik dikey video.',
    dosyaSayisi: 8,
    yorumSayisi: 5,
    revizyonSayisi: 2,
  },
  {
    id: 'G-1051',
    baslik: 'Öğle menüsü duyuru serisi',
    marka: 'Sofra Pide',
    tur: 'STORY',
    sorumlu: 'Ayşe Demir',
    teslim: '14:00',
    durum: 'Çalışılıyor',
    oncelik: 'Orta',
    sonGuncelleme: '10:18',
    brief: 'Hafta içi öğle menüsünü anlatan üç karelik hareketli hikâye serisi.',
    dosyaSayisi: 4,
    yorumSayisi: 2,
    revizyonSayisi: 0,
  },
  {
    id: 'G-1057',
    baslik: 'Hafta sonu rezervasyon reklamı',
    marka: 'Sofra Pide',
    tur: 'ADS',
    sorumlu: 'Selin Arslan',
    teslim: '17:30',
    durum: 'Yönetici Onayı',
    oncelik: 'Düşük',
    sonGuncelleme: '11:06',
    brief: 'Hafta sonu rezervasyonlarını artırmaya yönelik kısa reklam metni ve görsel uyarlaması.',
    dosyaSayisi: 3,
    yorumSayisi: 1,
    revizyonSayisi: 0,
  },
  {
    id: 'G-1043',
    baslik: 'Yeni proje tanıtım videosu',
    marka: 'Tepe Emlak',
    tur: 'VIDEO',
    sorumlu: 'Burak Yılmaz',
    teslim: '11:00',
    durum: 'Müşteri Onayı',
    oncelik: 'Yüksek',
    sonGuncelleme: '09:55',
    brief: 'Vadi Konakları projesinin sosyal medya ve satış ekibi için 45 saniyelik tanıtım kurgusu.',
    dosyaSayisi: 12,
    yorumSayisi: 7,
    revizyonSayisi: 1,
  },
  {
    id: 'G-1054',
    baslik: 'Konut kredisi bilgilendirme',
    marka: 'Tepe Emlak',
    tur: 'CAROUSEL',
    sorumlu: 'Ayşe Demir',
    teslim: '15:00',
    durum: 'Revizyon',
    oncelik: 'Yüksek',
    sonGuncelleme: '10:44',
    brief: 'Güncel konut kredisi seçeneklerini sade biçimde açıklayan altı sayfalık kaydırmalı gönderi.',
    dosyaSayisi: 6,
    yorumSayisi: 9,
    revizyonSayisi: 3,
  },
  {
    id: 'G-1062',
    baslik: 'Portföy sayfası güncellemesi',
    marka: 'Tepe Emlak',
    tur: 'WEB',
    sorumlu: 'Can Şahin',
    teslim: '18:00',
    durum: 'Başlanmadı',
    oncelik: 'Orta',
    sonGuncelleme: '08:35',
    brief: 'Yeni eklenen sekiz ilanın web sitesi portföy alanına girilmesi ve filtrelerin kontrolü.',
    dosyaSayisi: 8,
    yorumSayisi: 0,
    revizyonSayisi: 0,
  },
  {
    id: 'G-1046',
    baslik: 'Kış koleksiyonu ürün gönderisi',
    marka: '3 Kartal Perde',
    tur: 'POST',
    sorumlu: 'Ayşe Demir',
    teslim: '12:00',
    durum: 'Gecikti',
    oncelik: 'Yüksek',
    sonGuncelleme: '10:02',
    brief: 'Yeni kış koleksiyonundaki kadife perde grubunu öne çıkaran ürün odaklı gönderi.',
    dosyaSayisi: 5,
    yorumSayisi: 4,
    revizyonSayisi: 1,
  },
  {
    id: 'G-1059',
    baslik: 'Ölçü alma rehberi',
    marka: '3 Kartal Perde',
    tur: 'CAROUSEL',
    sorumlu: 'Selin Arslan',
    teslim: '16:00',
    durum: 'Çalışılıyor',
    oncelik: 'Orta',
    sonGuncelleme: '11:12',
    brief: 'Müşterilerin evde doğru perde ölçüsü almasını anlatan beş adımlı rehber içerik.',
    dosyaSayisi: 2,
    yorumSayisi: 3,
    revizyonSayisi: 0,
  },
  {
    id: 'G-1049',
    baslik: 'Seramik atölyesi tanıtımı',
    marka: 'Edva',
    tur: 'REELS',
    sorumlu: 'Burak Yılmaz',
    teslim: '13:30',
    durum: 'Yönetici Onayı',
    oncelik: 'Orta',
    sonGuncelleme: '10:28',
    brief: 'Atölye sürecini ve eğitmeni öne çıkaran, ritmik kesimlere sahip kısa tanıtım videosu.',
    dosyaSayisi: 10,
    yorumSayisi: 3,
    revizyonSayisi: 1,
  },
  {
    id: 'G-1064',
    baslik: 'Ekim etkinlik programı',
    marka: 'Edva',
    tur: 'POST',
    sorumlu: 'Selin Arslan',
    teslim: '17:00',
    durum: 'Tamamlandı',
    oncelik: 'Düşük',
    sonGuncelleme: '11:25',
    brief: 'Ekim ayındaki atölye ve etkinliklerin tarihlerini tek görselde duyuran program gönderisi.',
    dosyaSayisi: 3,
    yorumSayisi: 2,
    revizyonSayisi: 0,
  },
]

const oncelikSinifi: Record<Oncelik, string> = {
  Yüksek: 'bg-status-gecikti text-red-700',
  Orta: 'bg-amber-400 text-amber-900',
  Düşük: 'bg-slate-300 text-slate-700',
}

function Filtre({
  etiket,
  deger,
  secenekler,
  onChange,
}: {
  etiket: string
  deger: string
  secenekler: string[]
  onChange: (deger: string) => void
}) {
  return (
    <label className="flex min-w-36 flex-col gap-1.5">
      <span className="text-[11px] font-semibold tracking-wide text-muted uppercase">{etiket}</span>
      <select
        value={deger}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 rounded-lg border border-border bg-card px-3 text-xs font-medium text-foreground outline-none transition focus:border-primary"
      >
        <option value="">Tümü</option>
        {secenekler.map((secenek) => (
          <option key={secenek} value={secenek}>
            {secenek}
          </option>
        ))}
      </select>
    </label>
  )
}

function GorevKarti({
  gorev,
  sec,
}: {
  gorev: AkisGorevi
  sec: (gorev: AkisGorevi, bolum?: string) => void
}) {
  const [menuAcik, setMenuAcik] = useState(false)
  const akisIndex = gorev.durum === 'Gecikti' ? 1 : NORMAL_AKIS.indexOf(gorev.durum)
  const aksiyonlar = [
    ['Görevi Aç', 'genel'],
    ['Detayları Gör', 'brief'],
    ['Yorumu Gör', 'aktivite'],
    ['Revizyonları Gör', 'revizyon'],
    ['Sorumluyu Gör', 'sorumlu'],
  ]

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => sec(gorev)}
      onKeyDown={(event) => event.key === 'Enter' && sec(gorev)}
      className={`group relative rounded-xl border bg-card p-3.5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
        gorev.durum === 'Gecikti' ? 'border-red-200' : 'border-border'
      }`}
    >
      {gorev.oncelik === 'Yüksek' && (
        <div className="absolute inset-y-3 left-0 w-1 rounded-r-full bg-status-gecikti" />
      )}

      <div className="mb-2.5 flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] font-semibold text-muted">{gorev.id}</span>
        <div className="relative" onClick={(event) => event.stopPropagation()}>
          <Btn variant="ghost" size="sm" onClick={() => setMenuAcik((acik) => !acik)}>
            <Icon d={ICONS.more} size={15} />
            İşlemler
          </Btn>
          {menuAcik && (
            <div className="absolute top-full right-0 z-30 mt-1 w-44 rounded-xl border border-border bg-card p-1.5 shadow-xl">
              {aksiyonlar.map(([etiket, bolum]) => (
                <div key={etiket}>
                  <Btn
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      sec(gorev, bolum)
                      setMenuAcik(false)
                    }}
                  >
                    {etiket}
                  </Btn>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mb-3 min-h-10 text-[13px] leading-5 font-semibold text-foreground">
        {gorev.baslik}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <span className="rounded-md bg-primary-light px-2 py-1 text-[10px] font-bold tracking-wide text-primary">
          {gorev.tur}
        </span>
        <StatusBadge label={gorev.durum} />
      </div>

      <div className="mb-3 flex items-center gap-2">
        <Avatar name={gorev.sorumlu} size={24} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[11px] font-medium text-foreground">{gorev.sorumlu}</div>
          <div
            className={`text-[10px] ${gorev.durum === 'Gecikti' ? 'font-semibold text-red-600' : 'text-muted'}`}
          >
            Teslim: {gorev.teslim}
          </div>
        </div>
        <span className={`h-2 w-2 rounded-full ${oncelikSinifi[gorev.oncelik].split(' ')[0]}`} />
        <span className="text-[10px] font-medium text-muted">{gorev.oncelik}</span>
      </div>

      <div className="mb-2 flex items-center justify-between text-[10px] text-muted">
        <span>{gorev.durum === 'Revizyon' ? 'Revizyon → Çalışılıyor' : `Akış ${Math.max(akisIndex + 1, 1)}/5`}</span>
        <span>Son güncelleme {gorev.sonGuncelleme}</span>
      </div>
      <div className="flex gap-1">
        {NORMAL_AKIS.map((adim, index) => (
          <span
            key={adim}
            title={adim}
            className={`h-1 flex-1 rounded-full ${
              index <= akisIndex ? (gorev.durum === 'Gecikti' ? 'bg-status-gecikti' : 'bg-primary') : 'bg-slate-200'
            }`}
          />
        ))}
      </div>
    </div>
  )
}

function OzetSatiri({
  etiket,
  deger,
  vurgu,
}: {
  etiket: string
  deger: number
  vurgu?: 'kirmizi' | 'mor' | 'sari' | 'turuncu' | 'yesil'
}) {
  const renkler = {
    kirmizi: 'bg-status-gecikti text-red-700',
    mor: 'bg-status-yonetici-bg text-violet-700',
    sari: 'bg-status-musteri-bg text-amber-700',
    turuncu: 'bg-status-revizyon-bg text-orange-700',
    yesil: 'bg-status-tamamlandi-bg text-green-700',
  }
  return (
    <div className="flex items-center justify-between border-b border-slate-100 py-3 last:border-0">
      <span className="text-xs text-muted">{etiket}</span>
      <span
        className={`min-w-7 rounded-lg px-2 py-1 text-center text-xs font-bold ${
          vurgu ? renkler[vurgu] : 'bg-slate-100 text-foreground'
        }`}
      >
        {deger}
      </span>
    </div>
  )
}

export default function GunlukAjansAkisi() {
  const [gorevler, setGorevler] = useState(ILK_GOREVLER)
  const [tarih, setTarih] = useState('2026-09-30')
  const [marka, setMarka] = useState('')
  const [calisan, setCalisan] = useState('')
  const [durum, setDurum] = useState('')
  const [tur, setTur] = useState('')
  const [arama, setArama] = useState('')
  const [secilen, setSecilen] = useState<AkisGorevi | null>(null)
  const [odakBolumu, setOdakBolumu] = useState('genel')

  const filtrelenmis = useMemo(() => {
    if (tarih !== '2026-09-30') return []
    const sorgu = arama.trim().toLocaleLowerCase('tr')
    return gorevler.filter(
      (gorev) =>
        (!marka || gorev.marka === marka) &&
        (!calisan || gorev.sorumlu === calisan) &&
        (!durum || gorev.durum === durum) &&
        (!tur || gorev.tur === tur) &&
        (!sorgu ||
          `${gorev.id} ${gorev.baslik} ${gorev.marka} ${gorev.sorumlu}`
            .toLocaleLowerCase('tr')
            .includes(sorgu)),
    )
  }, [gorevler, tarih, marka, calisan, durum, tur, arama])

  const gorunenMarkalar = marka ? [marka] : MARKALAR
  const say = (aranan: AkisDurumu) => filtrelenmis.filter((gorev) => gorev.durum === aranan).length

  function gorevSec(gorev: AkisGorevi, bolum = 'genel') {
    setSecilen(gorev)
    setOdakBolumu(bolum)
  }

  function durumGuncelle(yeniDurum: AkisDurumu) {
    if (!secilen) return
    const guncel = { ...secilen, durum: yeniDurum, sonGuncelleme: 'Şimdi' }
    setGorevler((liste) => liste.map((gorev) => (gorev.id === secilen.id ? guncel : gorev)))
    setSecilen(guncel)
  }

  function filtreleriTemizle() {
    setMarka('')
    setCalisan('')
    setDurum('')
    setTur('')
    setArama('')
    setTarih('2026-09-30')
  }

  return (
    <div className="-m-7 flex min-h-full flex-col bg-background">
      <div className="border-b border-border bg-card px-7 py-5">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xl font-bold tracking-tight text-foreground">Günlük Ajans Akışı</div>
            <div className="mt-1 text-xs text-muted">
              Tüm markaların günlük iş yükünü, onaylarını ve darboğazlarını tek yerden yönetin.
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-lg border border-border bg-muted-light px-3 py-2 text-xs font-medium text-muted">
              Son eşitleme: 11:28
            </span>
            <Btn onClick={() => window.alert('Yeni görev oluşturma formu açıldı.')}>
              <Icon d={ICONS.plus} size={14} />
              Yeni Görev
            </Btn>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold tracking-wide text-muted uppercase">Tarih Seç</span>
            <input
              type="date"
              value={tarih}
              onChange={(event) => setTarih(event.target.value)}
              className="h-9 rounded-lg border border-border bg-card px-3 text-xs font-medium text-foreground outline-none transition focus:border-primary"
            />
          </label>
          <Filtre etiket="Marka Filtrele" deger={marka} secenekler={MARKALAR} onChange={setMarka} />
          <Filtre etiket="Çalışan Filtrele" deger={calisan} secenekler={CALISANLAR} onChange={setCalisan} />
          <Filtre etiket="Durum Filtrele" deger={durum} secenekler={DURUMLAR} onChange={setDurum} />
          <Filtre etiket="İçerik Türü Filtrele" deger={tur} secenekler={TURLER} onChange={setTur} />
          <label className="flex min-w-52 flex-1 flex-col gap-1.5">
            <span className="text-[11px] font-semibold tracking-wide text-muted uppercase">Arama</span>
            <span className="relative">
              <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted">
                <Icon d={ICONS.search} size={14} />
              </span>
              <input
                value={arama}
                onChange={(event) => setArama(event.target.value)}
                placeholder="Görev, marka veya çalışan ara"
                className="h-9 w-full rounded-lg border border-border bg-card pr-3 pl-9 text-xs text-foreground outline-none transition placeholder:text-slate-400 focus:border-primary"
              />
            </span>
          </label>
          <Btn variant="secondary" size="sm" onClick={filtreleriTemizle}>
            Temizle
          </Btn>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 overflow-x-auto p-5">
          <div className="flex min-w-max items-start gap-4">
            {gorunenMarkalar.map((markaAdi) => {
              const markaGorevleri = filtrelenmis.filter((gorev) => gorev.marka === markaAdi)
              const geciken = markaGorevleri.filter((gorev) => gorev.durum === 'Gecikti').length
              return (
                <div key={markaAdi} className="w-72 shrink-0">
                  <div className="mb-3 flex items-center justify-between rounded-xl border border-border bg-card px-3.5 py-3 shadow-sm">
                    <div>
                      <div className="text-[13px] font-bold text-foreground">{markaAdi}</div>
                      <div className="mt-0.5 text-[10px] text-muted">{markaGorevleri.length} günlük görev</div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {geciken > 0 && (
                        <span className="rounded-md bg-status-gecikti-bg px-2 py-1 text-[10px] font-bold text-red-600">
                          {geciken} geciken
                        </span>
                      )}
                      <Btn variant="ghost" size="sm" onClick={() => window.alert(`${markaAdi} için görev ekleniyor.`)}>
                        <Icon d={ICONS.plus} size={14} />
                      </Btn>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3">
                    {markaGorevleri.map((gorev) => (
                      <GorevKarti key={gorev.id} gorev={gorev} sec={gorevSec} />
                    ))}
                    {markaGorevleri.length === 0 && (
                      <div className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-xs text-muted">
                        Bu filtrelere uygun görev yok.
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <aside className="hidden w-60 shrink-0 border-l border-border bg-card p-5 xl:block">
          <div className="mb-1 text-sm font-bold text-foreground">Bugünkü Durum</div>
          <div className="mb-5 text-[11px] text-muted">30 Eylül Çarşamba</div>
          <Card className="px-3">
            <OzetSatiri etiket="Toplam Görev" deger={filtrelenmis.length} />
            <OzetSatiri etiket="Tamamlanan" deger={say('Tamamlandı')} vurgu="yesil" />
            <OzetSatiri etiket="Geciken" deger={say('Gecikti')} vurgu="kirmizi" />
            <OzetSatiri etiket="Yönetici Onayı" deger={say('Yönetici Onayı')} vurgu="mor" />
            <OzetSatiri etiket="Müşteri Onayı" deger={say('Müşteri Onayı')} vurgu="sari" />
            <OzetSatiri etiket="Revizyon Bekleyen" deger={say('Revizyon')} vurgu="turuncu" />
          </Card>

          <div className="mt-6 mb-3 text-xs font-bold text-foreground">Öncelik Göstergesi</div>
          <div className="space-y-2">
            {(['Yüksek', 'Orta', 'Düşük'] as Oncelik[]).map((deger) => (
              <div key={deger} className="flex items-center justify-between text-[11px] text-muted">
                <span className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${oncelikSinifi[deger].split(' ')[0]}`} />
                  {deger} öncelik
                </span>
                <strong className="text-foreground">
                  {filtrelenmis.filter((gorev) => gorev.oncelik === deger).length}
                </strong>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-xl bg-slate-900 p-4 text-white">
            <div className="mb-1 text-xs font-bold">Darboğaz uyarısı</div>
            <div className="text-[11px] leading-5 text-slate-300">
              Burak Yılmaz üzerinde 3 aktif iş bulunuyor. Bir iş gecikmiş durumda.
            </div>
            <div className="mt-3">
              <Btn variant="secondary" size="sm" onClick={() => setCalisan('Burak Yılmaz')}>
                İş yükünü göster
              </Btn>
            </div>
          </div>
        </aside>
      </div>

      {secilen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/30" onClick={() => setSecilen(null)}>
          <div
            className="h-full w-full max-w-xl overflow-y-auto border-l border-border bg-card shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-start justify-between border-b border-border bg-card px-6 py-5">
              <div>
                <div className="mb-1 font-mono text-[11px] font-semibold text-muted">{secilen.id}</div>
                <div className="pr-6 text-lg font-bold leading-6 text-foreground">{secilen.baslik}</div>
              </div>
              <Btn variant="ghost" size="sm" onClick={() => setSecilen(null)}>
                <Icon d={ICONS.x} size={18} />
              </Btn>
            </div>

            <div className="space-y-6 p-6">
              <div className="flex flex-wrap gap-2">
                <StatusBadge label={secilen.durum} />
                <span className="rounded-md bg-primary-light px-2 py-1 text-[10px] font-bold text-primary">
                  {secilen.tur}
                </span>
                <span className={`rounded-md px-2 py-1 text-[10px] font-bold ${oncelikSinifi[secilen.oncelik]}`}>
                  {secilen.oncelik} öncelik
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  ['Marka', secilen.marka],
                  ['Teslim Tarihi', `30 Eylül 2026 · ${secilen.teslim}`],
                  ['Sorumlu Kişi', secilen.sorumlu],
                  ['Son Güncelleme', secilen.sonGuncelleme],
                ].map(([etiket, deger]) => (
                  <div
                    key={etiket}
                    className={`rounded-xl border p-3.5 ${
                      odakBolumu === 'sorumlu' && etiket === 'Sorumlu Kişi'
                        ? 'border-primary bg-primary-light'
                        : 'border-border bg-muted-light'
                    }`}
                  >
                    <div className="mb-1 text-[10px] font-semibold tracking-wide text-muted uppercase">{etiket}</div>
                    <div className="text-xs font-semibold text-foreground">{deger}</div>
                  </div>
                ))}
              </div>

              <section className={odakBolumu === 'brief' ? 'rounded-xl ring-2 ring-primary/20' : ''}>
                <div className="mb-2 text-xs font-bold text-foreground">Brief</div>
                <div className="rounded-xl border border-border bg-muted-light p-4 text-xs leading-5 text-slate-600">
                  {secilen.brief}
                </div>
              </section>

              <section>
                <div className="mb-2 text-xs font-bold text-foreground">Dosyalar</div>
                <div className="flex items-center justify-between rounded-xl border border-border p-3.5">
                  <span className="flex items-center gap-2 text-xs font-medium text-foreground">
                    <Icon d={ICONS.link} size={15} />
                    Proje dosyaları
                  </span>
                  <span className="text-[11px] text-muted">{secilen.dosyaSayisi} dosya</span>
                </div>
              </section>

              <section>
                <div className="mb-3 text-xs font-bold text-foreground">İş Akışı</div>
                <div className="flex items-start">
                  {NORMAL_AKIS.map((adim, index) => {
                    const aktifIndex =
                      secilen.durum === 'Gecikti' ? 1 : Math.max(NORMAL_AKIS.indexOf(secilen.durum), 0)
                    return (
                      <div key={adim} className="flex min-w-0 flex-1 items-start">
                        <div className="flex min-w-0 flex-1 flex-col items-center text-center">
                          <span
                            className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${
                              index <= aktifIndex ? 'bg-primary text-white' : 'bg-slate-100 text-muted'
                            }`}
                          >
                            {index + 1}
                          </span>
                          <span className="mt-1.5 text-[9px] leading-3 text-muted">{adim}</span>
                        </div>
                        {index < NORMAL_AKIS.length - 1 && (
                          <span className={`mt-3 h-px w-3 ${index < aktifIndex ? 'bg-primary' : 'bg-slate-200'}`} />
                        )}
                      </div>
                    )
                  })}
                </div>
                {secilen.durum === 'Revizyon' && (
                  <div className="mt-3 rounded-lg bg-status-revizyon-bg px-3 py-2 text-[11px] font-semibold text-orange-700">
                    Revizyon alındı → İş yeniden “Çalışılıyor” adımına dönecek.
                  </div>
                )}
              </section>

              <section className={odakBolumu === 'revizyon' ? 'rounded-xl ring-2 ring-primary/20' : ''}>
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-xs font-bold text-foreground">Revizyon Geçmişi</div>
                  <span className="text-[11px] text-muted">{secilen.revizyonSayisi} kayıt</span>
                </div>
                <div className="rounded-xl border border-border p-3.5 text-xs text-slate-600">
                  {secilen.revizyonSayisi
                    ? 'Son revizyon: Metin hiyerarşisi ve kapanış karesi güncellendi.'
                    : 'Bu görev için revizyon kaydı bulunmuyor.'}
                </div>
              </section>

              <section className={odakBolumu === 'aktivite' ? 'rounded-xl ring-2 ring-primary/20' : ''}>
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-xs font-bold text-foreground">Aktivite Geçmişi</div>
                  <span className="text-[11px] text-muted">{secilen.yorumSayisi} yorum</span>
                </div>
                <div className="space-y-3 border-l border-slate-200 pl-4">
                  <div>
                    <div className="text-[11px] font-semibold text-foreground">
                      {secilen.sorumlu} görevi güncelledi
                    </div>
                    <div className="mt-0.5 text-[10px] text-muted">Bugün, {secilen.sonGuncelleme}</div>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold text-foreground">Ahmet Yıldız görevi atadı</div>
                    <div className="mt-0.5 text-[10px] text-muted">Bugün, 08:35</div>
                  </div>
                </div>
              </section>

              <section>
                <div className="mb-2 text-xs font-bold text-foreground">Durumu Güncelle</div>
                <select
                  value={secilen.durum}
                  onChange={(event) => durumGuncelle(event.target.value as AkisDurumu)}
                  className="h-10 w-full rounded-lg border border-border bg-card px-3 text-xs font-medium text-foreground outline-none focus:border-primary"
                >
                  {DURUMLAR.map((deger) => (
                    <option key={deger}>{deger}</option>
                  ))}
                </select>
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
