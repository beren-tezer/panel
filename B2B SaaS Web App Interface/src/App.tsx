import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  Building2,
  CalendarDays,
  CalendarRange,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  CircleDashed,
  CirclePlus,
  Clock3,
  Command,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  MoreHorizontal,
  PanelLeft,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Trash2,
  User,
  Users,
  X,
} from "lucide-react";
import {
  FormEvent,
  ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type Status =
  | "Planlandı"
  | "Üzerinde Çalışılıyor"
  | "Yönetici Onayında"
  | "Müşteri Onayında"
  | "Tamamlandı"
  | "Gecikmede";
type ContentType = "GÖNDERİ" | "REELS" | "HİKÂYE" | "WEB" | "REKLAM";
type Task = {
  id: string;
  brand: string;
  type: ContentType;
  title: string;
  assignee: string;
  status: Status;
  date: string;
  notes: string;
  time?: string;
};
type Filter = "Tümü" | "Yönetici Onayında" | "Müşteri Onayında" | "Gecikmede" | "Tamamlandı";

const statuses: Status[] = [
  "Planlandı",
  "Üzerinde Çalışılıyor",
  "Yönetici Onayında",
  "Müşteri Onayında",
  "Tamamlandı",
  "Gecikmede",
];
const brands = [
  "Tepe Emlak",
  "Sofra Pide",
  "3 Kartal Perde",
  "Edva",
  "Gürel Altyapı",
  "Velia Clinic",
  "Şahin Yalı",
  "AEK",
];
const brandInitials: Record<string, string> = {
  "Tepe Emlak": "TE",
  Sofra Pide: "SP",
  "3 Kartal Perde": "3K",
  Edva: "ED",
  "Gürel Altyapı": "GA",
  "Velia Clinic": "VC",
  Şahin Yalı: "Ş",
  AEK: "AE",
};
const assignees = ["Seda Y.", "Mert A.", "Elif D.", "Can K.", "Ahmet K.", "Berke T."];
const seedTasks: Task[] = [
  { id: "te-1", brand: "Tepe Emlak", type: "REELS", title: "Kira Artış Oranı ve Yasal Haklar", assignee: "Seda Y.", status: "Müşteri Onayında", date: "2 Ekim 2026", time: "14:30", notes: "Müşteri geri bildirimi bekleniyor." },
  { id: "te-2", brand: "Tepe Emlak", type: "HİKÂYE", title: "Haftalık Portföy Paylaşımı", assignee: "Mert A.", status: "Tamamlandı", date: "2 Ekim 2026", time: "10:00", notes: "Yayın planına alındı." },
  { id: "te-3", brand: "Tepe Emlak", type: "GÖNDERİ", title: "Lüks Villa Tanıtımı", assignee: "Elif D.", status: "Üzerinde Çalışılıyor", date: "2 Ekim 2026", time: "17:00", notes: "Görsel düzenleme devam ediyor." },
  { id: "sp-1", brand: "Sofra Pide", type: "REELS", title: "Yeni Menü Çekimi Kurgusu", assignee: "Can K.", status: "Yönetici Onayında", date: "2 Ekim 2026", time: "13:00", notes: "Son kurgu onaya hazır." },
  { id: "sp-2", brand: "Sofra Pide", type: "HİKÂYE", title: "Cuma Akşamı Rezervasyon Çağrısı", assignee: "Seda Y.", status: "Tamamlandı", date: "2 Ekim 2026", time: "11:30", notes: "Yayınlandı." },
  { id: "kp-1", brand: "3 Kartal Perde", type: "GÖNDERİ", title: "Motorlu Perde Sistemleri Tasarımı", assignee: "Ahmet K.", status: "Gecikmede", date: "2 Ekim 2026", time: "09:30", notes: "Ürün görselleri bekleniyor." },
  { id: "kp-2", brand: "3 Kartal Perde", type: "WEB", title: "Katalog PDF İndirme Butonu Testi", assignee: "Berke T.", status: "Üzerinde Çalışılıyor", date: "2 Ekim 2026", time: "15:00", notes: "Mobil tarayıcı kontrolleri yapılıyor." },
  { id: "ed-1", brand: "Edva", type: "GÖNDERİ", title: "Sonbahar Tablo Koleksiyonu", assignee: "Elif D.", status: "Müşteri Onayında", date: "2 Ekim 2026", time: "16:00", notes: "Metin revizyonu gönderildi." },
  { id: "ga-1", brand: "Gürel Altyapı", type: "REELS", title: "Şantiye İlerleme Videosu", assignee: "Can K.", status: "Yönetici Onayında", date: "2 Ekim 2026", time: "14:00", notes: "Altyazı kontrolü gerekiyor." },
  { id: "ga-2", brand: "Gürel Altyapı", type: "HİKÂYE", title: "Satış Ofisi Canlı Yayını", assignee: "Mert A.", status: "Tamamlandı", date: "2 Ekim 2026", time: "12:00", notes: "Yayın tamamlandı." },
  { id: "vc-1", brand: "Velia Clinic", type: "REELS", title: "Medikal Cilt Bakımı", assignee: "Seda Y.", status: "Tamamlandı", date: "2 Ekim 2026", time: "10:30", notes: "Müşteri onayı alındı." },
  { id: "si-1", brand: "Şahin Yalı", type: "GÖNDERİ", title: "Haftasonu Menüsü", assignee: "Elif D.", status: "Müşteri Onayında", date: "2 Ekim 2026", time: "18:00", notes: "Fiyat kontrolü bekleniyor." },
  { id: "aek-1", brand: "AEK", type: "REKLAM", title: "Meta Ads Haftalık ROAS Kontrolü", assignee: "Berke T.", status: "Üzerinde Çalışılıyor", date: "2 Ekim 2026", time: "16:30", notes: "Kampanya kırılımı hazırlanıyor." },
];
const seedTimes = Object.fromEntries(seedTasks.map((t) => [t.id, t.time]));

const tomorrow = [
  ["Tepe Emlak", "Yeni ilan portföyü", "REELS"],
  ["Sofra Pide", "Hafta sonu menüsü", "GÖNDERİ"],
  ["Gürel Altyapı", "Proje teslim röportajı", "REELS"],
  ["Velia Clinic", "Uzman görüşü videosu", "REELS"],
  ["Şahin Yalı", "Pazar kahvaltısı", "HİKÂYE"],
  ["AEK", "Aylık reklam özeti", "REKLAM"],
];

const statusMeta: Record<Status, { cls: string; Icon: typeof Check }> = {
  Planlandı: { cls: "st-slate", Icon: CircleDashed },
  "Üzerinde Çalışılıyor": { cls: "st-sky", Icon: Activity },
  "Yönetici Onayında": { cls: "st-orange", Icon: Clock3 },
  "Müşteri Onayında": { cls: "st-amber", Icon: MessageSquare },
  Tamamlandı: { cls: "st-emerald", Icon: Check },
  Gecikmede: { cls: "st-red", Icon: AlertTriangle },
};

const brandColors = ["coral", "violet", "sky", "emerald", "amber", "rose", "cyan", "indigo"];
const initialsOf = (name: string) => brandInitials[name] || name.split(" ").map((p) => p[0]).join("").slice(0, 2).toLocaleUpperCase("tr-TR");
const personInitials = (name: string) => name.replace(".", "").split(" ").map((p) => p[0]).join("").toLocaleUpperCase("tr-TR");

function useOutside<T extends HTMLElement>(onOutside: () => void) {
  const ref = useRef<T>(null);
  const cb = useRef(onOutside);
  cb.current = onOutside;
  useEffect(() => {
    const handler = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) cb.current();
    };
    const esc = (e: globalThis.KeyboardEvent) => e.key === "Escape" && cb.current();
    document.addEventListener("pointerdown", handler);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", handler); document.removeEventListener("keydown", esc); };
  }, []);
  return ref;
}

function useMedia(query: string) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const handler = () => setMatches(mq.matches);
    handler();
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [query]);
  return matches;
}

function IconButton({ label, children, onClick, className = "", tip = true }: { label: string; children: ReactNode; onClick?: () => void; className?: string; tip?: boolean }) {
  return <button type="button" className={`icon-button ${className}`} aria-label={label} title={tip ? label : undefined} onClick={onClick}>{children}</button>;
}

function ModalShell({ title, onClose, children, narrow = false }: { title: string; onClose: () => void; children: ReactNode; narrow?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const focusables = ref.current?.querySelectorAll<HTMLElement>("button, input, select, textarea, [tabindex]:not([tabindex='-1'])");
    (focusables?.[1] || focusables?.[0])?.focus();
    const trap = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key !== "Tab" || !focusables?.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", trap);
    return () => { document.removeEventListener("keydown", trap); previous?.focus(); };
  }, [onClose]);
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className={`modal ${narrow ? "modal-narrow" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head"><h2>{title}</h2><IconButton label="Kapat" onClick={onClose}><X size={17} /></IconButton></div>
        {children}
      </div>
    </div>
  );
}

function LogoMark() {
  return <span className="logo-mark" aria-hidden="true"><span /><span /><span /></span>;
}

const navSections = [
  { title: "ÇALIŞMA ALANI", items: [["Operasyon Kontrol Masası", LayoutDashboard], ["Marka İçerik Planlayıcısı", CalendarRange], ["Günlük Ajans Akışı", Activity], ["Ekip Mesai Logları", Users]] },
  { title: "RAPORLAMA", items: [["Performans Raporları", BarChart3]] },
  { title: "YÖNETİM", items: [["Ajans Ayarları", Settings]] },
] as const;

function Sidebar({ collapsed, canCollapse, mobileOpen, activeNav, workspaces, selectedWorkspace, counts, onSelectWorkspace, onCollapse, onMobileClose, onNavigate, onProfile, onCreateWorkspace, onSignOut }: {
  collapsed: boolean; canCollapse: boolean; mobileOpen: boolean; activeNav: string; workspaces: string[]; selectedWorkspace: string; counts: Record<string, number>; onSelectWorkspace: (workspace: string) => void; onCollapse: () => void; onMobileClose: () => void; onNavigate: (label: string) => void; onProfile: () => void; onCreateWorkspace: () => void; onSignOut: () => void;
}) {
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const workspaceRef = useOutside<HTMLDivElement>(() => setWorkspaceOpen(false));
  const userRef = useOutside<HTMLDivElement>(() => setUserOpen(false));
  const wsInitials = selectedWorkspace.split(" ").map((part) => part[0]).join("").slice(0, 2).toLocaleUpperCase("tr-TR");
  return (
    <>
      {mobileOpen && <button className="mobile-scrim" aria-label="Menüyü kapat" onClick={onMobileClose} />}
      <aside className={`sidebar ${collapsed ? "collapsed" : ""} ${mobileOpen ? "mobile-open" : ""}`}>
        <div className="sb-head">
          {collapsed ? (
            <button type="button" className="logo-toggle" data-tip="Kenar çubuğunu genişlet" aria-label="Kenar çubuğunu genişlet" onClick={canCollapse ? onCollapse : undefined}>
              <LogoMark />{canCollapse && <PanelLeft size={17} className="logo-toggle-icon" />}
            </button>
          ) : (
            <>
              <LogoMark />
              <div className="sb-product"><strong>AgencyOS</strong><small>Ajans İşletim Sistemi</small></div>
              {canCollapse && <IconButton label="Kenar çubuğunu daralt" className="sb-collapse" onClick={onCollapse}><PanelLeft size={17} /></IconButton>}
              <IconButton label="Menüyü kapat" className="mobile-close" onClick={onMobileClose}><X size={17} /></IconButton>
            </>
          )}
        </div>

        <div className="ws-wrap" ref={workspaceRef}>
          <button className="ws-button" data-tip={collapsed ? selectedWorkspace : undefined} onClick={() => setWorkspaceOpen((v) => !v)} aria-expanded={workspaceOpen} aria-haspopup="menu">
            <span className="ws-avatar">{wsInitials}</span>
            {!collapsed && <>
              <span className="ws-copy"><strong>{selectedWorkspace}</strong><small>Çalışma Alanı</small></span>
              <span className="pro">PRO</span>
              <ChevronsUpDown size={14} className="ws-chevron" />
            </>}
          </button>
          {workspaceOpen && <div className="menu-popover ws-menu" role="menu">
            <div className="menu-label">Çalışma alanları</div>
            {workspaces.map((workspace) => <button key={workspace} role="menuitem" className={workspace === selectedWorkspace ? "selected" : ""} onClick={() => { onSelectWorkspace(workspace); setWorkspaceOpen(false); }}>
              <span className="menu-ws-avatar">{workspace.split(" ").map((p) => p[0]).join("").slice(0, 2).toLocaleUpperCase("tr-TR")}</span>
              <span className="menu-text">{workspace}</span>
              {workspace === selectedWorkspace && <Check size={14} className="menu-check" />}
            </button>)}
            <div className="menu-sep" />
            <button role="menuitem" onClick={() => { setWorkspaceOpen(false); onCreateWorkspace(); }}><Plus size={15} /> Yeni Çalışma Alanı Ekle</button>
            <button role="menuitem" onClick={() => { setWorkspaceOpen(false); onNavigate("Ajans Ayarları"); }}><Settings size={15} /> Çalışma Alanı Ayarları</button>
          </div>}
        </div>

        <nav className="sb-nav" aria-label="Ana menü">
          {navSections.map((section) => (
            <div className="sb-section" key={section.title}>
              <span className="sb-label">{section.title}</span>
              {section.items.map(([label, Icon]) => (
                <button key={label} data-tip={collapsed ? label : undefined} aria-current={activeNav === label ? "page" : undefined} className={`sb-item ${activeNav === label ? "active" : ""}`} onClick={() => { onNavigate(label); onMobileClose(); }}>
                  <Icon size={18} strokeWidth={1.85} />
                  <span className="sb-item-label">{label}</span>
                  {counts[label] ? <span className="sb-count">{counts[label]}</span> : null}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="sb-bottom" ref={userRef}>
          {collapsed && canCollapse && <button type="button" className="sb-expand" data-tip="Kenar çubuğunu genişlet" aria-label="Kenar çubuğunu genişlet" onClick={onCollapse}><ChevronRight size={16} /></button>}
          <button className="profile-button" data-tip={collapsed ? "Ahmet Yıldız" : undefined} onClick={() => setUserOpen((v) => !v)} aria-expanded={userOpen} aria-haspopup="menu">
            <span className="avatar-user">MK<i /></span>
            {!collapsed && <><span className="profile-copy"><strong>Ahmet Yıldız</strong><small>Ajans Yöneticisi</small></span><MoreHorizontal size={16} className="profile-more" /></>}
          </button>
          {userOpen && <div className="menu-popover user-menu" role="menu">
            <div className="menu-user"><span className="avatar-user">MK</span><span><strong>Ahmet Yıldız</strong><small>yonetici@example.com</small></span></div>
            <div className="menu-sep" />
            <button role="menuitem" onClick={() => { setUserOpen(false); onProfile(); }}><User size={15} /> Profilim</button>
            <button role="menuitem" onClick={() => { setUserOpen(false); onNavigate("Ajans Ayarları"); }}><Settings size={15} /> Hesap Ayarları</button>
            <button role="menuitem" onClick={() => { setUserOpen(false); onNavigate("Ajans Ayarları"); }}><Building2 size={15} /> Çalışma Alanı Ayarları</button>
            <div className="menu-sep" />
            <button role="menuitem" className="danger" onClick={() => { setUserOpen(false); onSignOut(); }}><LogOut size={15} /> Çıkış Yap</button>
          </div>}
        </div>
      </aside>
    </>
  );
}

function TopHeader({ dateOffset, setDateOffset, view, setView, search, setSearch, notificationsRead, setNotificationsRead, onAdd, onMobileMenu }: {
  dateOffset: number; setDateOffset: (n: number) => void; view: string; setView: (v: string) => void; search: string; setSearch: (v: string) => void; notificationsRead: boolean; setNotificationsRead: (v: boolean) => void; onAdd: () => void; onMobileMenu: () => void;
}) {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const notificationRef = useOutside<HTMLDivElement>(() => setNotificationsOpen(false));
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const shortcut = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setSearchOpen(true); requestAnimationFrame(() => searchRef.current?.focus()); }
    };
    document.addEventListener("keydown", shortcut);
    return () => document.removeEventListener("keydown", shortcut);
  }, []);
  const dates = ["1 Ekim 2026 Perşembe", "2 Ekim 2026 Cuma", "3 Ekim 2026 Cumartesi"];
  const openSearch = () => { setSearchOpen(true); requestAnimationFrame(() => searchRef.current?.focus()); };
  return (
    <header className={`top-header ${searchOpen ? "search-open" : ""}`}>
      <div className="header-left">
        <IconButton label="Menüyü aç" className="mobile-menu-button" onClick={onMobileMenu}><Menu size={19} /></IconButton>
        <div className="header-title"><span className="eyebrow">GÜNLÜK OPERASYON</span><h1>{dates[dateOffset + 1]}</h1></div>
        <div className="date-nav" aria-label="Tarih gezintisi">
          <button disabled={dateOffset === -1} className={dateOffset === -1 ? "current" : ""} onClick={() => setDateOffset(-1)}><ChevronLeft size={14} /> Dün</button>
          <button className={dateOffset === 0 ? "current" : ""} onClick={() => setDateOffset(0)}>Bugün</button>
          <button disabled={dateOffset === 1} className={dateOffset === 1 ? "current" : ""} onClick={() => setDateOffset(1)}>Yarın <ChevronRight size={14} /></button>
        </div>
      </div>
      <div className="view-switcher" role="tablist" aria-label="Görünüm seçimi">
        {["Günlük Akış", "Haftalık Genel Bakış", "Aylık Matris"].map((item) => <button key={item} role="tab" aria-selected={view === item} className={view === item ? "active" : ""} onClick={() => setView(item)}>{item}</button>)}
      </div>
      <div className="header-actions">
        <label className="search-box">
          <Search size={15} />
          <input ref={searchRef} value={search} onChange={(e) => setSearch(e.target.value)} onBlur={() => !search && setSearchOpen(false)} placeholder="İş veya marka ara..." aria-label="İş veya marka ara" />
          {search ? <button type="button" aria-label="Aramayı temizle" onClick={() => { setSearch(""); searchRef.current?.focus(); }}><X size={13} /></button> : <kbd><Command size={10} />K</kbd>}
          <button type="button" className="search-close" aria-label="Aramayı kapat" onMouseDown={(e) => e.preventDefault()} onClick={() => { setSearchOpen(false); searchRef.current?.blur(); }}><X size={15} /></button>
        </label>
        <IconButton label="Ara" className="search-toggle header-icon" onClick={openSearch}><Search size={17} /></IconButton>
        <div className="notification-wrap" ref={notificationRef}>
          <IconButton label="Bildirimler" onClick={() => setNotificationsOpen((v) => !v)} className={`header-icon ${notificationsOpen ? "pressed" : ""}`}><Bell size={17} />{!notificationsRead && <span className="unread-dot" />}</IconButton>
          {notificationsOpen && <div className="menu-popover notifications">
            <div className="notifications-head"><strong>Bildirimler</strong><button disabled={notificationsRead} onClick={() => setNotificationsRead(true)}>{notificationsRead ? "Tümü okundu" : "Tümünü okundu işaretle"}</button></div>
            {[["Tepe Emlak içeriği müşteri tarafından yorumlandı.", MessageSquare], ["3 Kartal Perde görevi gecikmeye düştü.", AlertTriangle], ["Sofra Pide içeriği yönetici onayına gönderildi.", Clock3]].map(([item, Icon], index) => {
              const I = Icon as typeof Check;
              return <button className={`notification-item ${notificationsRead ? "" : "unread"}`} key={item as string} onClick={() => { setNotificationsRead(true); setNotificationsOpen(false); }}><span className={`notice-icon n${index}`}><I size={14} /></span><span className="notice-copy">{item as string}<small>{index + 1} saat önce</small></span></button>;
            })}
          </div>}
        </div>
        <button className="primary-button add-button" aria-label="Görev Ekle" onClick={onAdd}><Plus size={16} strokeWidth={2.25} /><span>Görev Ekle</span></button>
      </div>
    </header>
  );
}

function FilterBar({ active, onChange, tasks }: { active: Filter; onChange: (f: Filter) => void; tasks: Task[] }) {
  const completed = tasks.filter((t) => t.status === "Tamamlandı").length;
  const percentage = tasks.length ? Math.round(completed / tasks.length * 100) : 0;
  const filters: [Filter, string, number][] = [
    ["Tümü", "Tüm Markalar", tasks.length],
    ["Yönetici Onayında", "Yönetici Onayında", tasks.filter((t) => t.status === "Yönetici Onayında").length],
    ["Müşteri Onayında", "Müşteri Onayında", tasks.filter((t) => t.status === "Müşteri Onayında").length],
    ["Gecikmede", "Gecikenler", tasks.filter((t) => t.status === "Gecikmede").length],
    ["Tamamlandı", "Tamamlananlar", completed],
  ];
  return (
    <div className="filter-bar">
      <div className="filters" role="tablist" aria-label="Görev filtreleri">{filters.map(([key, label, count]) => <button role="tab" aria-selected={active === key} key={key} className={`${active === key ? "active" : ""} ${key === "Gecikmede" && count ? "has-alert" : ""}`} onClick={() => onChange(key)}>{label}<span>{count}</span></button>)}</div>
      <div className="progress-wrap" aria-label={`Bugünün ilerlemesi: ${tasks.length} görevden ${completed} tamamlandı`}>
        <span className="progress-label">Bugünün İlerlemesi</span>
        <span className="progress-value"><strong>{completed}</strong> / {tasks.length}</span>
        <span className="progress-pct">%{percentage}</span>
        <div className="progress-track"><span style={{ width: `${percentage}%` }} /></div>
      </div>
    </div>
  );
}

function SummaryStrip({ tasks }: { tasks: Task[] }) {
  const count = (fn: (t: Task) => boolean) => tasks.filter(fn).length;
  const items: [string, number, string][] = [
    ["Görev", tasks.length, "dot-slate"],
    ["Tamamlandı", count((t) => t.status === "Tamamlandı"), "dot-emerald"],
    ["Onay Bekliyor", count((t) => t.status === "Yönetici Onayında" || t.status === "Müşteri Onayında"), "dot-amber"],
    ["Çalışılıyor", count((t) => t.status === "Üzerinde Çalışılıyor"), "dot-sky"],
    ["Gecikmiş", count((t) => t.status === "Gecikmede"), "dot-red"],
  ];
  return (
    <div className="summary-strip">
      <span className="summary-label">BUGÜN</span>
      {items.map(([label, value, dot]) => <span className="summary-item" key={label}><i className={dot} /><strong>{value}</strong> {label}</span>)}
      <span className="summary-brands">{new Set(tasks.map((t) => t.brand)).size} markada aktif operasyon</span>
    </div>
  );
}

function StatusPill({ status, small = false }: { status: Status; small?: boolean }) {
  const { cls, Icon } = statusMeta[status];
  return <span className={`status-pill ${cls} ${small ? "sm" : ""}`}><Icon size={12} strokeWidth={2.25} />{status}</span>;
}

function StatusSelect({ value, onChange, align = "left" }: { value: Status; onChange: (s: Status) => void; align?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  const ref = useOutside<HTMLDivElement>(() => setOpen(false));
  const { cls, Icon } = statusMeta[value];
  return (
    <div className="status-wrap" ref={ref}>
      <button type="button" className={`status-pill status-trigger ${cls}`} aria-haspopup="listbox" aria-expanded={open} aria-label={`Görev durumu: ${value}`} onClick={() => setOpen((v) => !v)}>
        <Icon size={12} strokeWidth={2.25} /><span>{value}</span><ChevronDown size={12} className="status-chev" />
      </button>
      {open && <div className={`menu-popover status-menu ${align}`} role="listbox">
        <div className="menu-label">Durumu değiştir</div>
        {statuses.map((status) => {
          const meta = statusMeta[status];
          return <button key={status} role="option" aria-selected={status === value} className={status === value ? "selected" : ""} onClick={() => { if (status !== value) onChange(status); setOpen(false); }}>
            <span className={`status-icon ${meta.cls}`}><meta.Icon size={12} strokeWidth={2.25} /></span>
            <span className="menu-text">{status}</span>
            {status === value && <Check size={14} className="menu-check" />}
          </button>;
        })}
      </div>}
    </div>
  );
}

function TaskRow({ task, onStatus, onOpen }: { task: Task; onStatus: (id: string, status: Status) => void; onOpen: (task: Task) => void }) {
  return (
    <div className={`task-row ${task.status === "Tamamlandı" ? "done" : ""}`}>
      <div className="task-top">
        <span className="type-badge">{task.type}</span>
        <StatusSelect value={task.status} onChange={(status) => onStatus(task.id, status)} />
        <button type="button" className="task-more" aria-label={`${task.title} detayını aç`} title="Detayı aç" onClick={() => onOpen(task)}><MoreHorizontal size={15} /></button>
      </div>
      <button className="task-title" onClick={() => onOpen(task)}>{task.title}</button>
      <div className="task-meta">
        <span className="assignee"><span className="avatar-sm">{personInitials(task.assignee)}</span>{task.assignee}</span>
        <span className={`task-time ${task.status === "Gecikmede" ? "late" : ""}`}><Clock3 size={11} />{task.time || seedTimes[task.id] || "18:00"}</span>
      </div>
    </div>
  );
}

function BrandCard({ brand, tasks, index, onStatus, onOpen, onAdd, onShowBrand }: { brand: string; tasks: Task[]; index: number; onStatus: (id: string, status: Status) => void; onOpen: (task: Task) => void; onAdd: (brand: string) => void; onShowBrand: (brand: string) => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const ref = useOutside<HTMLDivElement>(() => setMenuOpen(false));
  const done = tasks.filter((t) => t.status === "Tamamlandı").length;
  return (
    <article className={`brand-card ${menuOpen ? "raised" : ""}`}>
      <div className="card-head">
        <span className={`brand-avatar ${brandColors[index % brandColors.length]}`}>{initialsOf(brand)}</span>
        <div className="brand-title"><h3>{brand}</h3><span>Bugünkü operasyonlar · {done}/{tasks.length}</span></div>
        <span className="task-count">{tasks.length} Görev</span>
        <div className="card-menu-wrap" ref={ref}>
          <IconButton label={`${brand} seçenekleri`} className={`card-menu-btn ${menuOpen ? "pressed" : ""}`} onClick={() => setMenuOpen((v) => !v)}><MoreHorizontal size={16} /></IconButton>
          {menuOpen && <div className="menu-popover card-menu" role="menu">
            <button role="menuitem" onClick={() => { setMenuOpen(false); onOpen(tasks[0]); }}><Building2 size={15} /> Markayı Aç</button>
            <button role="menuitem" onClick={() => { setMenuOpen(false); onAdd(brand); }}><Plus size={15} /> Yeni Görev Ekle</button>
            <button role="menuitem" onClick={() => { setMenuOpen(false); onShowBrand(brand); }}><Search size={15} /> Bugünkü Görevleri Gör</button>
          </div>}
        </div>
      </div>
      <div className="brand-progress" aria-hidden="true"><span style={{ width: `${tasks.length ? done / tasks.length * 100 : 0}%` }} /></div>
      <div className="task-list">{tasks.map((task) => <TaskRow key={task.id} task={task} onStatus={onStatus} onOpen={onOpen} />)}</div>
      <button type="button" className="card-add" onClick={() => onAdd(brand)}><Plus size={13} /> Görev ekle</button>
    </article>
  );
}

function AddTaskModal({ presetBrand, onClose, onSubmit }: { presetBrand?: string; onClose: () => void; onSubmit: (task: Task) => void }) {
  const [form, setForm] = useState({ brand: presetBrand || "", type: "", title: "", assignee: "", status: "", time: "17:00" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const nextErrors: Record<string, string> = {};
    Object.entries(form).forEach(([key, value]) => { if (!value.trim()) nextErrors[key] = "Bu alan zorunludur."; });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    onSubmit({ id: `gorev-${Date.now()}`, brand: form.brand, type: form.type as ContentType, title: form.title.trim(), assignee: form.assignee, status: form.status as Status, date: "2 Ekim 2026", time: form.time, notes: "Yeni eklenen günlük görev." });
  };
  const field = (key: keyof typeof form, value: string) => { setForm((old) => ({ ...old, [key]: value })); setErrors((old) => ({ ...old, [key]: "" })); };
  const err = (key: string) => errors[key] && <small className="field-error">{errors[key]}</small>;
  return <ModalShell title="Yeni Görev" onClose={onClose}>
    <form onSubmit={submit} noValidate>
      <div className="form-grid">
        <label className="full"><span>Görev Başlığı</span><input className={errors.title ? "invalid" : ""} value={form.title} onChange={(e) => field("title", e.target.value)} placeholder="Görevin kısa ve açıklayıcı adı" />{err("title")}</label>
        <label><span>Marka</span><select className={errors.brand ? "invalid" : ""} value={form.brand} onChange={(e) => field("brand", e.target.value)}><option value="">Marka seçin</option>{brands.map((brand) => <option key={brand}>{brand}</option>)}</select>{err("brand")}</label>
        <label><span>İçerik Türü</span><select className={errors.type ? "invalid" : ""} value={form.type} onChange={(e) => field("type", e.target.value)}><option value="">İçerik türü seçin</option>{["GÖNDERİ", "REELS", "HİKÂYE", "WEB", "REKLAM"].map((type) => <option value={type} key={type}>{type.charAt(0) + type.slice(1).toLocaleLowerCase("tr-TR")}</option>)}</select>{err("type")}</label>
        <label><span>Sorumlu</span><select className={errors.assignee ? "invalid" : ""} value={form.assignee} onChange={(e) => field("assignee", e.target.value)}><option value="">Sorumlu seçin</option>{assignees.map((person) => <option key={person}>{person}</option>)}</select>{err("assignee")}</label>
        <label><span>Durum</span><select className={errors.status ? "invalid" : ""} value={form.status} onChange={(e) => field("status", e.target.value)}><option value="">Durum seçin</option>{statuses.map((status) => <option key={status}>{status}</option>)}</select>{err("status")}</label>
        <label><span>Teslim Saati</span><input type="time" className={errors.time ? "invalid" : ""} value={form.time} onChange={(e) => field("time", e.target.value)} />{err("time")}</label>
        <label><span>Tarih</span><input value="2 Ekim 2026 Cuma" readOnly tabIndex={-1} className="readonly" /></label>
      </div>
      <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>İptal</button><button className="primary-button" type="submit"><CirclePlus size={15} /> Görevi Ekle</button></div>
    </form>
  </ModalShell>;
}

function WorkspaceModal({ onClose, onCreate }: { onClose: () => void; onCreate: (name: string) => void }) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) { setError("Çalışma alanı adı zorunludur."); return; }
    onCreate(name.trim());
  };
  return <ModalShell title="Yeni Çalışma Alanı" onClose={onClose} narrow>
    <form onSubmit={submit}>
      <div className="workspace-form">
        <span className="workspace-form-icon"><Building2 size={20} /></span>
        <label><span>Çalışma Alanı Adı</span><input className={error ? "invalid" : ""} autoComplete="off" value={name} onChange={(event) => { setName(event.target.value); setError(""); }} placeholder="Örneğin: Yeni Ajans Ekibi" />{error && <small className="field-error">{error}</small>}</label>
        <p>Yeni çalışma alanı ayrı marka, ekip ve görev ayarlarıyla oluşturulur.</p>
      </div>
      <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Vazgeç</button><button type="submit" className="primary-button"><Plus size={15} /> Çalışma Alanı Oluştur</button></div>
    </form>
  </ModalShell>;
}

function ProfileModal({ onClose, workspace }: { onClose: () => void; workspace: string }) {
  return <ModalShell title="Profilim" onClose={onClose} narrow>
    <div className="profile-modal">
      <div className="profile-hero"><span className="profile-modal-avatar">MK</span><div><strong>Ahmet Yıldız</strong><span>Ajans Yöneticisi</span></div><span className="profile-state"><span /> Aktif</span></div>
      <dl>
        <div><dt>E-posta</dt><dd>yonetici@example.com</dd></div>
        <div><dt>Yetki</dt><dd><ShieldCheck size={14} /> Ajans Yöneticisi</dd></div>
        <div><dt>Çalışma Alanı</dt><dd>{workspace}</dd></div>
      </dl>
    </div>
    <div className="modal-actions"><button type="button" className="primary-button" onClick={onClose}>Tamam</button></div>
  </ModalShell>;
}

function DetailDrawer({ task, onClose, onStatus, onDelete, onEdit }: { task: Task; onClose: () => void; onStatus: (id: string, s: Status) => void; onDelete: () => void; onEdit: (task: Task) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task);
  const [titleError, setTitleError] = useState(false);
  useEffect(() => { setDraft(task); setEditing(false); setTitleError(false); }, [task.id]);
  useEffect(() => {
    const close = (e: globalThis.KeyboardEvent) => { if (e.key === "Escape" && !document.querySelector(".modal-backdrop, .status-menu")) onClose(); };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [onClose]);
  const save = () => {
    if (!draft.title.trim()) { setTitleError(true); return; }
    onEdit({ ...draft, title: draft.title.trim() }); setEditing(false);
  };
  return <div className="drawer-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
    <aside className="detail-drawer" role="dialog" aria-modal="true" aria-label="Görev Detayı">
      <div className="drawer-head">
        <div className="drawer-crumb"><span className={`brand-avatar xs ${brandColors[Math.max(0, brands.indexOf(task.brand)) % brandColors.length]}`}>{initialsOf(task.brand)}</span>{task.brand}<ChevronRight size={13} /><strong>Görev Detayı</strong></div>
        <IconButton label="Görev detayını kapat" onClick={onClose}><X size={17} /></IconButton>
      </div>
      <div className="drawer-body">
        {editing ? <div className="edit-form">
          <label><span>Görev Başlığı</span><input className={titleError ? "invalid" : ""} value={draft.title} onChange={(e) => { setDraft({ ...draft, title: e.target.value }); setTitleError(false); }} />{titleError && <small className="field-error">Bu alan zorunludur.</small>}</label>
          <div className="edit-row">
            <label><span>İçerik Türü</span><select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as ContentType })}>{["GÖNDERİ", "REELS", "HİKÂYE", "WEB", "REKLAM"].map((x) => <option key={x}>{x}</option>)}</select></label>
            <label><span>Sorumlu</span><select value={draft.assignee} onChange={(e) => setDraft({ ...draft, assignee: e.target.value })}>{assignees.map((x) => <option key={x}>{x}</option>)}</select></label>
          </div>
          <label><span>Teslim Saati</span><input type="time" value={draft.time || seedTimes[draft.id] || "18:00"} onChange={(e) => setDraft({ ...draft, time: e.target.value })} /></label>
          <label><span>Notlar</span><textarea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} rows={5} /></label>
        </div> : <>
          <h3 className="drawer-title">{task.title}</h3>
          <dl className="detail-list">
            <div><dt>Marka</dt><dd>{task.brand}</dd></div>
            <div><dt>İçerik Türü</dt><dd><span className="type-badge">{task.type}</span></dd></div>
            <div><dt>Sorumlu</dt><dd><span className="assignee strong"><span className="avatar-sm">{personInitials(task.assignee)}</span>{task.assignee}</span></dd></div>
            <div><dt>Durum</dt><dd><StatusSelect value={task.status} onChange={(s) => onStatus(task.id, s)} /></dd></div>
            <div><dt>Tarih</dt><dd><CalendarDays size={14} className="muted-icon" /> {task.date} · {task.time || seedTimes[task.id] || "18:00"}</dd></div>
          </dl>
          <section className="detail-notes"><h4>Notlar</h4><p>{task.notes || "Not eklenmemiş."}</p></section>
        </>}
      </div>
      <div className="drawer-actions">
        {editing ? <>
          <button className="secondary-button" onClick={() => { setDraft(task); setEditing(false); setTitleError(false); }}>Vazgeç</button>
          <button className="primary-button grow" onClick={save}>Değişiklikleri Kaydet</button>
        </> : <>
          <button className="complete-button" disabled={task.status === "Tamamlandı"} onClick={() => onStatus(task.id, "Tamamlandı")}><CheckCircle2 size={15} /> {task.status === "Tamamlandı" ? "Tamamlandı" : "Tamamlandı Olarak İşaretle"}</button>
          <button className="secondary-button" onClick={() => setEditing(true)}>Düzenle</button>
          <IconButton label="Görevi sil" className="danger-icon" onClick={onDelete}><Trash2 size={15} /></IconButton>
        </>}
      </div>
    </aside>
  </div>;
}

function TomorrowPreview({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return <section className={`tomorrow-preview ${open ? "open" : ""}`}>
    <button className="tomorrow-toggle" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
      <ChevronRight size={16} className="tomorrow-chev" />
      <span className="tomorrow-copy"><strong>3 Ekim 2026 Cumartesi</strong><small>Yarına planlanan {tomorrow.length} içerik</small></span>
      <span className="tomorrow-cta">{open ? "Gizle" : "Önizle"}</span>
    </button>
    <div className="tomorrow-body"><div className="tomorrow-inner"><div className="tomorrow-content">{tomorrow.map(([brand, title, type]) => <div key={brand} className="tomorrow-item">
      <span className={`brand-avatar xs ${brandColors[brands.indexOf(brand) % brandColors.length]}`}>{initialsOf(brand)}</span>
      <span className="tomorrow-text"><strong>{title}</strong><small>{brand}</small></span>
      <span className="type-badge">{type}</span>
      <StatusPill status="Planlandı" small />
    </div>)}</div></div></div>
  </section>;
}

function EmptyState({ onClear, search }: { onClear: () => void; search: string }) {
  return <div className="empty-state"><span className="empty-icon"><Search size={20} /></span><h2>Bu kriterlere uygun görev bulunamadı</h2><p>{search ? <>“{search}” aramasıyla eşleşen görev yok. </> : null}Filtreleri değiştirerek veya arama ifadenizi temizleyerek tekrar deneyebilirsiniz.</p><button className="secondary-button" onClick={onClear}>Filtreleri Temizle</button></div>;
}

function AlternativeView({ view, onDaily }: { view: string; onDaily: () => void }) {
  const copy: Record<string, string> = {
    "Haftalık Genel Bakış": "Markaların haftalık iş yükünü, onay durumlarını ve ekip dağılımını tek görünümde inceleyin.",
    "Aylık Matris": "Ay boyunca planlanan içerikleri marka ve yayın gününe göre karşılaştırın.",
  };
  return <div className="empty-state"><span className="empty-icon">{view === "Aylık Matris" ? <CalendarDays size={20} /> : <CalendarRange size={20} />}</span><span className="eyebrow">AJANS PLANLAMA</span><h2>{view}</h2><p>{copy[view] || "Bu modül çalışma alanınız için hazırlanıyor. Günlük operasyonları akış ekranından takip edebilirsiniz."}</p><button className="primary-button" onClick={onDaily}>Günlük Akışa Dön</button></div>;
}

function SignedOut({ onSignIn }: { onSignIn: () => void }) {
  return <div className="signed-out"><div className="signed-card"><LogoMark /><h1>Oturum kapatıldı</h1><p>AgencyOS oturumunuz güvenli şekilde sonlandırıldı.</p><button className="primary-button" onClick={onSignIn}>Ahmet Yıldız olarak tekrar giriş yap</button></div></div>;
}

export default function App() {
  const [tasks, setTasks] = useState<Task[]>(() => {
    try { const stored = localStorage.getItem("agencyos-tasks-v1"); return stored ? JSON.parse(stored) : seedTasks; } catch { return seedTasks; }
  });
  const isMobile = useMedia("(max-width: 768px)");
  const [collapsed, setCollapsed] = useState(() => {
    const saved = localStorage.getItem("agencyos-sidebar-collapsed-v2");
    return saved ? saved === "1" : window.innerWidth < 1280;
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeNav, setActiveNav] = useState("Günlük Ajans Akışı");
  const [dateOffset, setDateOffset] = useState(0);
  const [view, setView] = useState("Günlük Akış");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("Tümü");
  const [notificationsRead, setNotificationsRead] = useState(() => localStorage.getItem("agencyos-notifications-read-v1") === "1");
  const [addModal, setAddModal] = useState<{ open: boolean; brand?: string }>({ open: false });
  const [detailId, setDetailId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [signedOut, setSignedOut] = useState(false);
  const [workspaceModalOpen, setWorkspaceModalOpen] = useState(false);
  const [workspaces, setWorkspaces] = useState<string[]>(() => {
    try { const stored = localStorage.getItem("agency-workspaces-v1"); return stored ? JSON.parse(stored) : ["Atlas Ajans"]; } catch { return ["Atlas Ajans"]; }
  });
  const [selectedWorkspace, setSelectedWorkspace] = useState(() => localStorage.getItem("agencyos-selected-workspace-v1") || "Atlas Ajans");
  const [toast, setToast] = useState("");
  useEffect(() => localStorage.setItem("agencyos-tasks-v1", JSON.stringify(tasks)), [tasks]);
  useEffect(() => localStorage.setItem("agency-workspaces-v1", JSON.stringify(workspaces)), [workspaces]);
  useEffect(() => localStorage.setItem("agencyos-selected-workspace-v1", selectedWorkspace), [selectedWorkspace]);
  useEffect(() => localStorage.setItem("agencyos-sidebar-collapsed-v2", collapsed ? "1" : "0"), [collapsed]);
  useEffect(() => localStorage.setItem("agencyos-notifications-read-v1", notificationsRead ? "1" : "0"), [notificationsRead]);
  useEffect(() => { if (!isMobile) setMobileOpen(false); }, [isMobile]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    const close = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") { setAddModal({ open: false }); setConfirmDelete(false); setMobileOpen(false); }
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, []);
  const detailTask = tasks.find((t) => t.id === detailId) || null;
  const filtered = useMemo(() => {
    const query = search.toLocaleLowerCase("tr-TR").trim();
    return tasks.filter((task) => {
      const matchesFilter = filter === "Tümü" || task.status === filter;
      const haystack = `${task.brand} ${task.title} ${task.assignee} ${task.type}`.toLocaleLowerCase("tr-TR");
      return matchesFilter && (!query || haystack.includes(query));
    });
  }, [tasks, search, filter]);
  const grouped = useMemo(() => brands.map((brand) => ({ brand, tasks: filtered.filter((task) => task.brand === brand) })).filter((group) => group.tasks.length), [filtered]);
  const updateStatus = (id: string, status: Status) => {
    setTasks((current) => current.map((task) => task.id === id ? { ...task, status } : task));
    setToast(`Görev durumu “${status}” olarak güncellendi.`);
  };
  const navigate = (label: string) => {
    setActiveNav(label);
    if (label === "Günlük Ajans Akışı") setView("Günlük Akış");
  };
  const clearFilters = () => { setFilter("Tümü"); setSearch(""); };
  const addTask = (task: Task) => { setTasks((current) => [...current, task]); setAddModal({ open: false }); setFilter("Tümü"); setSearch(""); setToast("Görev başarıyla eklendi."); };
  const deleteTask = () => {
    if (!detailId) return;
    setTasks((current) => current.filter((task) => task.id !== detailId));
    setDetailId(null); setConfirmDelete(false); setToast("Görev başarıyla silindi.");
  };
  const showFeed = activeNav === "Günlük Ajans Akışı";
  const effectiveCollapsed = !isMobile && collapsed;
  const openCount = tasks.filter((t) => t.status !== "Tamamlandı").length;
  if (signedOut) return <SignedOut onSignIn={() => { setSignedOut(false); setToast("Tekrar hoş geldiniz, Ahmet."); }} />;
  return (
    <div className={`app ${effectiveCollapsed ? "sidebar-collapsed" : ""}`}>
      <Sidebar collapsed={effectiveCollapsed} canCollapse={!isMobile} mobileOpen={mobileOpen} activeNav={activeNav} workspaces={workspaces} selectedWorkspace={selectedWorkspace} counts={{ "Günlük Ajans Akışı": openCount }} onSelectWorkspace={(workspace) => { setSelectedWorkspace(workspace); setToast(`“${workspace}” çalışma alanına geçildi.`); }} onCollapse={() => setCollapsed((v) => !v)} onMobileClose={() => setMobileOpen(false)} onNavigate={navigate} onProfile={() => setProfileOpen(true)} onCreateWorkspace={() => setWorkspaceModalOpen(true)} onSignOut={() => setConfirmSignOut(true)} />
      <main className="main">
        <div className="topbar">
          <TopHeader
            dateOffset={dateOffset}
            setDateOffset={(offset) => { setDateOffset(offset); setActiveNav("Günlük Ajans Akışı"); }}
            view={view}
            setView={(nextView) => { setView(nextView); setActiveNav("Günlük Ajans Akışı"); }}
            search={search}
            setSearch={(query) => { setSearch(query); if (query) setActiveNav("Günlük Ajans Akışı"); }}
            notificationsRead={notificationsRead}
            setNotificationsRead={setNotificationsRead}
            onAdd={() => setAddModal({ open: true })}
            onMobileMenu={() => setMobileOpen(true)}
          />
          {showFeed && view === "Günlük Akış" && dateOffset === 0 && <FilterBar active={filter} onChange={setFilter} tasks={tasks} />}
        </div>
        <div className="content">
          {!showFeed ? <AlternativeView view={activeNav} onDaily={() => navigate("Günlük Ajans Akışı")} /> :
            view !== "Günlük Akış" ? <AlternativeView view={view} onDaily={() => setView("Günlük Akış")} /> :
            dateOffset !== 0 ? <div className="date-context">
              <div className="empty-state compact"><span className="empty-icon"><CalendarDays size={20} /></span><h2>{dateOffset < 0 ? "Dünün operasyon özeti" : "Yarının operasyon planı"}</h2><p>{dateOffset < 0 ? "Tamamlanan çalışmalar ve gün sonu notları bu görünümde özetlenir." : "Yarın planlanan içerikleri aşağıdaki önizleme alanından inceleyebilirsiniz."}</p><button className="primary-button" onClick={() => setDateOffset(0)}>Bugüne Dön</button></div>
              {dateOffset > 0 && <TomorrowPreview defaultOpen />}
            </div> :
            <>
              <SummaryStrip tasks={tasks} />
              {grouped.length ? <div className="brand-grid">{grouped.map((group) => <BrandCard key={group.brand} brand={group.brand} tasks={group.tasks} index={brands.indexOf(group.brand)} onStatus={updateStatus} onOpen={(task) => setDetailId(task.id)} onAdd={(brand) => setAddModal({ open: true, brand })} onShowBrand={(brand) => { setFilter("Tümü"); setSearch(brand); setToast(`${brand} markasının bugünkü görevleri listelendi.`); }} />)}</div> : <EmptyState onClear={clearFilters} search={search} />}
              <TomorrowPreview />
            </>}
        </div>
      </main>
      {isMobile && <button className="fab" aria-label="Görev Ekle" onClick={() => setAddModal({ open: true })}><Plus size={22} /></button>}
      {addModal.open && <AddTaskModal presetBrand={addModal.brand} onClose={() => setAddModal({ open: false })} onSubmit={addTask} />}
      {detailTask && <DetailDrawer task={detailTask} onClose={() => setDetailId(null)} onStatus={updateStatus} onDelete={() => setConfirmDelete(true)} onEdit={(updated) => { setTasks((current) => current.map((t) => t.id === updated.id ? updated : t)); setToast("Görev bilgileri güncellendi."); }} />}
      {confirmDelete && <ModalShell title="Görevi silmek istediğinize emin misiniz?" onClose={() => setConfirmDelete(false)} narrow><p className="confirm-copy">Bu işlem geri alınamaz. Görev günlük akıştan ve marka sayacından kaldırılacaktır.</p><div className="modal-actions"><button className="secondary-button" onClick={() => setConfirmDelete(false)}>Vazgeç</button><button className="danger-solid" onClick={deleteTask}><Trash2 size={15} /> Görevi Sil</button></div></ModalShell>}
      {confirmSignOut && <ModalShell title="Çıkış yapmak istiyor musunuz?" onClose={() => setConfirmSignOut(false)} narrow><p className="confirm-copy">Oturumunuz bu cihazda sonlandırılacak. Görevleriniz ve çalışma alanı ayarlarınız korunur.</p><div className="modal-actions"><button className="secondary-button" onClick={() => setConfirmSignOut(false)}>Vazgeç</button><button className="primary-button" onClick={() => { setConfirmSignOut(false); setDetailId(null); setSignedOut(true); }}><LogOut size={15} /> Çıkış Yap</button></div></ModalShell>}
      {profileOpen && <ProfileModal workspace={selectedWorkspace} onClose={() => setProfileOpen(false)} />}
      {workspaceModalOpen && <WorkspaceModal onClose={() => setWorkspaceModalOpen(false)} onCreate={(name) => { setWorkspaces((current) => current.includes(name) ? current : [...current, name]); setSelectedWorkspace(name); setWorkspaceModalOpen(false); setToast(`“${name}” çalışma alanı başarıyla oluşturuldu.`); }} />}
      {toast && <div className="toast" role="status"><span><Check size={13} strokeWidth={2.5} /></span>{toast}</div>}
    </div>
  );
}
