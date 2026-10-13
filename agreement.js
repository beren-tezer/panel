/*
 * AgencyOS — "Gizlilik ve Rekabet Sözleşmesi" (ilk girişte zorunlu onay)
 *
 * Onay durumu profiles.agreement_accepted alanında tutulur (supabase/009_agreement.sql). Kullanıcı onaylamadan
 * router.resolveRoute yalnızca /sozlesme ekranını açar; onay accept_agreement() fonksiyonuyla kaydedilir.
 *
 * Metin panelden düzenlenir (Admin → Sözleşme; supabase/010_agreement_text.sql → agreement_text tablosu).
 * Veritabanında kayıtlı metin yoksa aşağıdaki DEFAULT_AGREEMENT gösterilir. Köşeli parantezli alanlar
 * ([Şirket Unvanı] gibi) yöneticinin doldurması gereken boşluklardır; doldurulmadıkça ekranda vurgulu görünür.
 */

export const DEFAULT_AGREEMENT = {
  version: "taslak",
  title: "Gizlilik ve Rekabet Sözleşmesi",
  consent: "Gizlilik ve Rekabet Sözleşmesi'ni okudum, anladım ve kabul ediyorum.",
  sections: [
    {
      heading: "1. Taraflar",
      body: "Bu sözleşme; [Şirket Unvanı] ([Şirket Adresi], Vergi Dairesi / No: [Vergi Dairesi / No]; bundan sonra \"Ajans\") ile AgencyOS paneline erişim verilen kullanıcı (bundan sonra \"Kullanıcı\") arasında, Kullanıcının panele ilk girişinde elektronik ortamda onaylanmasıyla kurulmuştur.",
    },
    {
      heading: "2. Amaç ve Kapsam",
      body: "Bu sözleşmenin amacı; Kullanıcının panel üzerinden eriştiği veya iş ilişkisi sırasında öğrendiği bilgilerin gizliliğini korumak, Ajansın müşteri ilişkilerini ve ticari menfaatlerini güvence altına almaktır. Sözleşme; Ajans çalışanlarını, serbest çalışanları, iş ortaklarını ve panele erişim verilen müşteri temsilcilerini kapsar.",
    },
    {
      heading: "3. Gizli Bilgi",
      body: "Panelde yer alan ve kamuya açık olmayan her türlü bilgi gizli bilgidir. Bunlar özellikle şunlardır:\n• Müşteri ve marka bilgileri, iletişim kişileri ve sözleşme koşulları\n• İçerik planları, yayımlanmamış tasarım, video, metin ve kampanya çalışmaları\n• Reklam hesapları, bütçeler, performans verileri ve raporlar\n• Fiyat, teklif ve ödeme bilgileri\n• Kullanıcı hesapları, şifreler ve erişim bağlantıları\n• Ajansın çalışma yöntemleri, şablonları ve iç yazışmaları",
    },
    {
      heading: "4. Gizlilik Yükümlülüğü",
      body: "Kullanıcı gizli bilgileri yalnızca kendisine verilen işin yürütülmesi amacıyla kullanır. Ajansın yazılı izni olmadan:\n• Gizli bilgileri üçüncü kişilerle paylaşmaz, yayımlamaz veya sosyal medyada göstermez\n• Panelden indirdiği dosyaları kişisel hesaplarında, cihazlarında veya bulut alanlarında iş gereğinden fazla saklamaz\n• Ekran görüntüsü, kopya veya kayıt yoluyla bilgileri panel dışına aktarmaz",
    },
    {
      heading: "5. Hesap Güvenliği",
      body: "Kullanıcı hesabını yalnızca kendisi kullanır; şifresini kimseyle paylaşmaz ve ortak cihazlarda oturumunu açık bırakmaz. Hesabının yetkisiz kullanıldığından veya bir bilginin yanlışlıkla paylaşıldığından şüphelenirse durumu derhâl [Bildirim E-posta Adresi] adresine bildirir.",
    },
    {
      heading: "6. Rekabet Yasağı",
      body: "Kullanıcı, Ajans ile çalışma ilişkisi sürdüğü müddetçe ve ilişkinin herhangi bir sebeple sona ermesinden itibaren [Rekabet Yasağı Süresi: ör. 12 ay] boyunca, [Geçerli Bölge: ör. Türkiye] sınırları içinde, panel aracılığıyla tanıdığı Ajans müşterilerine Ajansın yazılı izni olmadan doğrudan veya dolaylı olarak aynı veya benzer hizmeti sunmaz.",
    },
    {
      heading: "7. Müşteri ve Çalışanları Yönlendirmeme",
      body: "Kullanıcı aynı süre boyunca Ajansın müşterilerini Ajanstan ayrılmaya veya çalışmalarını azaltmaya yönlendirmez; Ajans çalışanlarını ve serbest çalışanlarını kendisi veya bir başkası adına işe almak amacıyla Ajanstan ayrılmaya teşvik etmez.",
    },
    {
      heading: "8. Fikrî Haklar",
      body: "Panel üzerinden üretilen veya paylaşılan tüm içerik, tasarım ve materyaller üzerindeki haklar, ilgili müşteri sözleşmelerinde aksi belirtilmedikçe Ajansa ve/veya müşteriye aittir. Kullanıcı bu çalışmaları kendi portföyünde, internet sitesinde veya başka bir mecrada ancak Ajansın yazılı izniyle kullanabilir.",
    },
    {
      heading: "9. Kişisel Verilerin Korunması",
      body: "Panelde işlenen kişisel veriler 6698 sayılı Kişisel Verilerin Korunması Kanunu'na uygun olarak yalnızca iş amacıyla ve gerektiği ölçüde kullanılır. Kullanıcının panel kullanımına ilişkin kayıtlar (giriş zamanları, yapılan işlemler, bu sözleşmenin onay tarihi ve sürümü) güvenlik ve denetim amacıyla saklanır. Ayrıntılı bilgi için: [Aydınlatma Metni Bağlantısı].",
    },
    {
      heading: "10. Bilgi ve Belgelerin İadesi",
      body: "Çalışma ilişkisi sona erdiğinde Kullanıcı, elindeki gizli bilgi içeren tüm dosya, belge ve kopyaları Ajansa iade eder veya kalıcı olarak siler; talep edilirse bunu yazılı olarak teyit eder. Panel erişimi ilişkinin sona erdiği gün kapatılır.",
    },
    {
      heading: "11. Aykırılık ve Cezai Şart",
      body: "Bu sözleşmeye aykırılık hâlinde Ajans erişimi derhâl kapatabilir. Kullanıcı, aykırılık başına [Cezai Şart Tutarı] TL cezai şart ödemeyi kabul eder; cezai şartın ödenmesi, Ajansın bunu aşan zararlarını talep etme hakkını ortadan kaldırmaz.",
    },
    {
      heading: "12. Süre",
      body: "Sözleşme onay tarihinde yürürlüğe girer. Gizlilik yükümlülüğü çalışma ilişkisinin ve panel erişiminin sona ermesinden sonra da süresiz devam eder; rekabet yasağı 6. maddede belirtilen süre boyunca geçerlidir.",
    },
    {
      heading: "13. Uyuşmazlıkların Çözümü",
      body: "Bu sözleşmeden doğan uyuşmazlıklarda Türk hukuku uygulanır; [Yetkili Mahkeme: ör. Antalya] Mahkemeleri ve İcra Daireleri yetkilidir.",
    },
    {
      heading: "14. Elektronik Onay",
      body: "Kullanıcı, sözleşmeyi panelde \"Onaylıyorum\" düğmesine basarak kabul eder. Onayın tarihi, saati ve sözleşme sürümü Ajansın kayıtlarında saklanır ve taraflar arasında delil niteliği taşır. Sözleşme metni değiştiğinde Kullanıcıdan yeniden onay istenebilir.",
    },
  ],
};

/* Sınırlar supabase/010_agreement_text.sql ile aynıdır. */
export const AGREEMENT_LIMITS = { title: 200, heading: 200, body: 5000, consent: 500, sections: 40 };

/* Köşeli parantezli boşluklar: "[Şirket Unvanı]". Satır sonu içermez, en fazla 80 karakter. */
export const PLACEHOLDER = /\[[^\][\n]{1,80}\]/g;

/* Metindeki doldurulmamış boşluklar (tekrarsız, ilk görünme sırasıyla). */
export function placeholdersIn(doc) {
  const all = [doc.title, ...doc.sections.flatMap((s) => [s.heading, s.body]), doc.consent].join("\n");
  return [...new Set(all.match(PLACEHOLDER) || [])];
}

/* Metni parçalara böler: [{ text, blank }] — boşluklar ekranda vurgulanır. */
export function splitBlanks(text) {
  const out = [];
  let last = 0;
  for (const m of String(text).matchAll(PLACEHOLDER)) {
    if (m.index > last) out.push({ text: text.slice(last, m.index), blank: false });
    out.push({ text: m[0], blank: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), blank: false });
  return out;
}

const clean = (s) => String(s ?? "").replace(/\r\n?/g, "\n").trim();

/* Kaydetmeden önce: baştaki / sondaki boşlukları kırpar, satır sonlarını birleştirir (bölüm sırası korunur). */
export function normalizeAgreement(doc) {
  return {
    title: clean(doc.title),
    consent: clean(doc.consent),
    sections: (doc.sections || []).map((s) => ({ heading: clean(s.heading), body: clean(s.body) })),
  };
}

/* { alan: mesaj } — boşsa geçerli. Bölüm hataları "s<index>.heading" / "s<index>.body" anahtarlarıyla döner. */
export function validateAgreement(doc) {
  const e = {};
  const L = AGREEMENT_LIMITS;
  if (!doc.title) e.title = "Başlık boş olamaz.";
  else if (doc.title.length > L.title) e.title = `Başlık en fazla ${L.title} karakter olabilir.`;
  if (!doc.consent) e.consent = "Onay cümlesi boş olamaz.";
  else if (doc.consent.length > L.consent) e.consent = `Onay cümlesi en fazla ${L.consent} karakter olabilir.`;
  if (!doc.sections.length) e.sections = "En az bir bölüm olmalı.";
  else if (doc.sections.length > L.sections) e.sections = `En fazla ${L.sections} bölüm eklenebilir.`;
  doc.sections.forEach((s, i) => {
    if (!s.heading) e[`s${i}.heading`] = "Bölüm başlığı boş olamaz.";
    else if (s.heading.length > L.heading) e[`s${i}.heading`] = `En fazla ${L.heading} karakter.`;
    if (!s.body) e[`s${i}.body`] = "Bölüm metni boş olamaz.";
    else if (s.body.length > L.body) e[`s${i}.body`] = `En fazla ${L.body} karakter.`;
  });
  return e;
}

/* Veritabanı satırı → metin (yoksa / bozuksa varsayılan taslak). */
export function rowToAgreementText(r) {
  if (!r || !Array.isArray(r.sections)) return null;
  return {
    version: r.version, title: r.title, consent: r.consent, updatedAt: r.updated_at || null, updatedBy: r.updated_by || null,
    sections: r.sections.filter((s) => s && typeof s === "object").map((s) => ({ heading: String(s.heading || ""), body: String(s.body || "") })),
  };
}
