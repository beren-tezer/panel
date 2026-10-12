/*
 * AgencyOS — "Gizlilik ve Rekabet Sözleşmesi" (ilk girişte zorunlu onay)
 *
 * Onay durumu profiles.agreement_accepted alanında tutulur (supabase/009_agreement.sql). Kullanıcı onaylamadan
 * router.resolveRoute yalnızca /sozlesme ekranını açar; onay accept_agreement() fonksiyonuyla kaydedilir
 * (tarih + aşağıdaki sürüm de saklanır).
 *
 * ⚠ METİN TASLAKTIR: yayına almadan önce hukuk danışmanınızın onayladığı metinle değiştirin. Metni değiştirdiğinizde
 *   AGREEMENT_VERSION'ı da artırın; herkesin yeniden onaylaması gerekiyorsa 009 dosyasının sonundaki sıfırlama
 *   satırını çalıştırın.
 */

export const AGREEMENT_VERSION = "2026-10-13";
export const AGREEMENT_TITLE = "Gizlilik ve Rekabet Sözleşmesi";

export const AGREEMENT_SECTIONS = [
  {
    heading: "1. Taraflar ve Kapsam",
    body: "Bu sözleşme, AgencyOS paneline erişim verilen kullanıcı (\"Kullanıcı\") ile Atlas Ajans (\"Ajans\") arasında; panel üzerinden erişilen tüm marka, müşteri, içerik, görev, dosya ve iş bilgilerinin korunmasına ilişkin kuralları belirler.",
  },
  {
    heading: "2. Gizli Bilgi",
    body: "Panelde yer alan ve kamuya açık olmayan her türlü bilgi gizli bilgidir: müşteri ve marka bilgileri, içerik planları, yayımlanmamış tasarım ve videolar, kampanya ve reklam verileri, fiyat ve teklif bilgileri, kullanıcı ve iletişim bilgileri, giriş bilgileri.",
  },
  {
    heading: "3. Gizlilik Yükümlülüğü",
    body: "Kullanıcı gizli bilgileri yalnızca kendisine verilen işin yürütülmesi amacıyla kullanır; Ajansın yazılı izni olmadan üçüncü kişilerle paylaşmaz, kopyalamaz, panel dışına aktarmaz veya kişisel hesaplarında saklamaz. Hesap bilgilerini kimseyle paylaşmaz ve hesabının yetkisiz kullanıldığını fark ederse Ajansa derhâl bildirir.",
  },
  {
    heading: "4. Rekabet Yasağı ve Müşteri İlişkileri",
    body: "Kullanıcı, panel aracılığıyla öğrendiği müşterilere, Ajans ile çalışma ilişkisi sürdüğü müddetçe ve sona ermesinden itibaren 12 ay boyunca Ajansın yazılı izni olmadan doğrudan veya dolaylı olarak aynı veya benzer hizmeti sunmaz, bu müşterileri Ajanstan ayrılmaya yönlendirmez.",
  },
  {
    heading: "5. Fikrî Haklar",
    body: "Panel üzerinden üretilen veya paylaşılan içerikler, ilgili müşteri sözleşmelerinde aksi belirtilmedikçe Ajansa ve/veya müşteriye aittir. Kullanıcı bu içerikleri kendi portföyünde veya başka bir mecrada izinsiz kullanmaz.",
  },
  {
    heading: "6. Kişisel Veriler",
    body: "Panelde işlenen kişisel veriler 6698 sayılı KVKK kapsamında yalnızca iş amacıyla ve gerektiği ölçüde kullanılır. Kullanıcının panel kullanımı (giriş zamanı, yaptığı işlemler, bu sözleşmeyi onay tarihi) güvenlik ve denetim amacıyla kayıt altına alınır.",
  },
  {
    heading: "7. Süre ve Yaptırım",
    body: "Gizlilik yükümlülüğü, panel erişiminin sona ermesinden sonra da süresiz olarak devam eder. Bu sözleşmeye aykırılık hâlinde Ajans erişimi derhâl kapatabilir ve doğan zararların tazminini talep edebilir.",
  },
];

export const AGREEMENT_CONSENT = "Gizlilik ve Rekabet Sözleşmesi'ni okudum, anladım ve kabul ediyorum.";
