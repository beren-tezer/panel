import { useEffect, useMemo, useRef, useState } from "react";
import { Avatar, Button, Icon, Modal, Toast } from "./components";
import { photoUrls } from "./demoData";
import { FORMATS, STATUSES, uid, weekOf, type Attachment, type Brand, type Content, type Filters, type Format, type Status } from "./models";
import { useWorkspace } from "./useWorkspace";

const monthNames = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
const dayNames = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];
const tabs = ["İçerik Planı", "Takvim Görünümü", "Liste Görünümü", "Analizler", "Dosyalar", "Ayarlar"] as const;
type Tab = typeof tabs[number];
type Overlay = "content" | "brand" | "import" | "files" | "comments" | "delete" | "move" | "mobileFilters" | "contentDetail" | null;

function monthLabel(month: string) {
  const [year, index] = month.split("-").map(Number);
  return `${monthNames[index - 1]} ${year}`;
}

function dateLabel(date: string) {
  const parsed = new Date(`${date}T12:00:00`);
  return { date: `${parsed.getDate()} ${monthNames[parsed.getMonth()].slice(0, 3)}`, day: dayNames[parsed.getDay()] };
}

function statusClass(status: Status) {
  return status.replaceAll(" ", "-").toLocaleLowerCase("tr-TR");
}

function getProgress(contents: Content[]) {
  const done = contents.filter((item) => item.status === "Tamamlandı").length;
  return { done, total: contents.length, percent: contents.length ? Math.round(done / contents.length * 100) : 0 };
}

type ToastState = { text: string; tone: "success" | "error" } | null;

export default function App() {
  const store = useWorkspace();
  const { data } = store;
  const [activeBrandId, setActiveBrandId] = useState("tepe-emlak");
  const [activeMonth, setActiveMonth] = useState("2026-09");
  const [activeTab, setActiveTab] = useState<Tab>("İçerik Planı");
  const [brandQuery, setBrandQuery] = useState("");
  const [query, setQuery] = useState("");
  const [globalQuery, setGlobalQuery] = useState("");
  const [filters, setFilters] = useState<Filters>({ format: "Tümü", status: "Tümü", assigneeId: "Tümü" });
  const [draftFilters, setDraftFilters] = useState<Filters>(filters);
  const [collapsedWeeks, setCollapsedWeeks] = useState<number[]>([]);
  const [selectedContentId, setSelectedContentId] = useState<string | null>(null);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [editing, setEditing] = useState<Content | null>(null);
  const [statusMenu, setStatusMenu] = useState<string | null>(null);
  const [assigneeMenu, setAssigneeMenu] = useState<string | null>(null);
  const [rowMenu, setRowMenu] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mobileActions, setMobileActions] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  const activeBrand = data.brands.find((brand) => brand.id === activeBrandId) ?? data.brands[0];
  const monthContents = useMemo(() => data.contents
    .filter((item) => item.brandId === activeBrandId && item.date.startsWith(activeMonth))
    .sort((a, b) => a.date.localeCompare(b.date)), [data.contents, activeBrandId, activeMonth]);
  const filteredContents = useMemo(() => monthContents.filter((item) => {
    const text = `${item.title} ${item.brief}`.toLocaleLowerCase("tr-TR");
    return text.includes(query.toLocaleLowerCase("tr-TR"))
      && (filters.format === "Tümü" || item.format === filters.format)
      && (filters.status === "Tümü" || item.status === filters.status)
      && (filters.assigneeId === "Tümü" || item.assigneeId === filters.assigneeId);
  }), [monthContents, query, filters]);
  const progress = getProgress(monthContents);
  const hasFilters = filters.format !== "Tümü" || filters.status !== "Tümü" || filters.assigneeId !== "Tümü";
  const selectedContent = data.contents.find((item) => item.id === selectedContentId) ?? null;

  const globalResults = useMemo(() => {
    if (globalQuery.trim().length < 2) return [];
    const normalized = globalQuery.toLocaleLowerCase("tr-TR");
    const brandResults = data.brands.filter((brand) => brand.name.toLocaleLowerCase("tr-TR").includes(normalized)).slice(0, 4).map((brand) => ({ id: brand.id, type: "Marka", title: brand.name, brandId: brand.id }));
    const contentResults = data.contents.filter((item) => `${item.title} ${item.brief}`.toLocaleLowerCase("tr-TR").includes(normalized)).slice(0, 5).map((item) => ({ id: item.id, type: "İçerik", title: item.title, brandId: item.brandId }));
    return [...brandResults, ...contentResults];
  }, [globalQuery, data]);

  function notify(text: string, tone: "success" | "error" = "success") {
    setToast({ text, tone });
    window.setTimeout(() => setToast(null), 2800);
  }

  function closeTransient() {
    setStatusMenu(null);
    setAssigneeMenu(null);
    setRowMenu(null);
    setNotificationsOpen(false);
    setAccountOpen(false);
    setMobileActions(false);
  }

  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOverlay(null);
        setSidebarOpen(false);
        closeTransient();
      }
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, []);

  function changeMonth(amount: number) {
    const [year, month] = activeMonth.split("-").map(Number);
    const next = new Date(year, month - 1 + amount, 1);
    setActiveMonth(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`);
    setSelectedContentId(null);
  }

  function chooseBrand(id: string) {
    setActiveBrandId(id);
    setSidebarOpen(false);
    setSelectedContentId(null);
    setQuery("");
  }

  function openNewContent() {
    setEditing(null);
    setOverlay("content");
  }

  function openEdit(content: Content) {
    setEditing(content);
    setOverlay("content");
    setRowMenu(null);
  }

  function duplicateContent(content: Content) {
    const copy = { ...content, id: uid("icerik"), title: `${content.title} (Kopya)`, comments: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    store.saveContent(copy);
    setRowMenu(null);
    notify("İçerik çoğaltıldı.");
  }

  async function copyApprovalLink(contentId?: string) {
    const link = `${window.location.origin}/onay/${activeBrandId}${contentId ? `/${contentId}` : ""}`;
    try {
      await navigator.clipboard.writeText(link);
      notify(contentId ? "İçerik bağlantısı kopyalandı." : "Müşteri onay bağlantısı kopyalandı.");
    } catch {
      notify("Bağlantı kopyalanamadı. Tekrar deneyin.", "error");
    }
    setRowMenu(null);
  }

  function selectGlobalResult(result: { id: string; type: string; brandId: string }) {
    chooseBrand(result.brandId);
    const content = data.contents.find((item) => item.id === result.id);
    if (content) {
      setActiveMonth(content.date.slice(0, 7));
      setSelectedContentId(content.id);
      setOverlay("contentDetail");
    }
    setGlobalQuery("");
  }

  if (store.loading) return <LoadingScreen />;

  return (
    <div className="app-shell" onClick={closeTransient}>
      <header className="topbar">
        <div className="brand-lockup">
          <button className="mobile-menu-button" aria-label="Marka menüsünü aç" onClick={(event) => { event.stopPropagation(); setSidebarOpen(true); }}><Icon name="menu" size={19} /></button>
          <div className="logo-mark"><span /><span /><span /></div>
          <span className="brand-name">Atlas Ajans <strong>Workspace</strong></span>
        </div>
        <div className={`global-search ${mobileSearchOpen ? "mobile-search-open" : ""}`} onClick={(event) => event.stopPropagation()}>
          <Icon name="ara" />
          <input value={globalQuery} onChange={(event) => setGlobalQuery(event.target.value)} placeholder="İçeriklerde, dosyalarda veya markalarda ara…" aria-label="Genel arama" />
          {globalQuery && <button onClick={() => setGlobalQuery("")} aria-label="Aramayı temizle"><Icon name="kapat" size={14} /></button>}
          {globalQuery.length >= 2 && <div className="search-results">
            <span className="popover-label">Arama Sonuçları</span>
            {globalResults.length ? globalResults.map((result) => <button key={`${result.type}-${result.id}`} onClick={() => selectGlobalResult(result)}><span className="result-icon">{result.type === "Marka" ? "M" : "İ"}</span><span><strong>{result.title}</strong><small>{result.type}</small></span></button>) : <div className="mini-empty">Aramanızla eşleşen sonuç bulunamadı.</div>}
          </div>}
        </div>
        <div className="account-area">
          <button className="icon-button mobile-search-toggle" aria-label="Aramayı aç" onClick={(event) => { event.stopPropagation(); setMobileSearchOpen(!mobileSearchOpen); }}><Icon name="ara" /></button>
          <div className="popover-wrap" onClick={(event) => event.stopPropagation()}>
            <button className="icon-button notification" aria-label="Bildirimler" onClick={() => { setNotificationsOpen(!notificationsOpen); setAccountOpen(false); }}><Icon name="bildirim" /><i /></button>
            {notificationsOpen && <div className="header-popover notifications-popover"><div className="popover-head"><strong>Bildirimler</strong><button onClick={store.markNotificationsRead}>Tümünü okundu işaretle</button></div>{data.notifications.map((item) => <div className={`notification-item ${item.read ? "" : "unread"}`} key={item.id}><i /><span>{item.text}</span></div>)}</div>}
          </div>
          <div className="account-copy"><strong>Atlas Medya</strong><span>Ajans Hesabı</span></div>
          <div className="user-avatar">CM</div>
          <div className="popover-wrap" onClick={(event) => event.stopPropagation()}>
            <button className="icon-button account-toggle" aria-label="Hesap menüsünü aç" onClick={() => { setAccountOpen(!accountOpen); setNotificationsOpen(false); }}><Icon name="asagi" /></button>
            {accountOpen && <div className="header-popover account-popover"><button onClick={() => { setActiveTab("Ayarlar"); setAccountOpen(false); }}>Hesap Ayarları</button><button onClick={() => notify("Oturumunuz bu demo ortamında açık kalır.")}>Oturumu Kapat</button></div>}
          </div>
        </div>
      </header>

      <div className="body-shell">
        {sidebarOpen && <button className="drawer-scrim" aria-label="Menüyü kapat" onClick={() => setSidebarOpen(false)} />}
        <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`} onClick={(event) => event.stopPropagation()}>
          <div className="mobile-drawer-head"><strong>Markalarım</strong><button className="icon-button" aria-label="Menüyü kapat" onClick={() => setSidebarOpen(false)}><Icon name="kapat" /></button></div>
          <div className="side-heading"><span>Markalarım</span><span className="brand-count">{data.brands.length}</span></div>
          <label className="input-shell"><Icon name="ara" /><input value={brandQuery} onChange={(event) => setBrandQuery(event.target.value)} placeholder="Marka ara…" aria-label="Marka ara" /></label>
          <Button icon="arti" onClick={() => setOverlay("brand")}>Yeni Marka</Button>
          <div className="brand-list">
            {data.brands.filter((brand) => brand.name.toLocaleLowerCase("tr-TR").includes(brandQuery.toLocaleLowerCase("tr-TR"))).map((brand, index) => {
              const brandProgress = getProgress(data.contents.filter((item) => item.brandId === brand.id && item.date.startsWith(activeMonth)));
              return <button className={`brand-row ${brand.id === activeBrandId ? "brand-selected" : ""}`} key={brand.id} onClick={() => chooseBrand(brand.id)}>
                {brand.logo ? <img className="brand-avatar brand-logo" src={brand.logo} alt={`${brand.name} logosu`} /> : <div className={`brand-avatar brand-${index % 6}`}>{brand.initials}</div>}
                <div className="brand-meta"><div><strong>{brand.name}</strong><span>{brandProgress.done}/{brand.target} Tamamlandı</span></div><div className="mini-progress"><i style={{ width: `${Math.min(100, brand.target ? brandProgress.done / brand.target * 100 : 0)}%` }} /></div></div>
              </button>;
            })}
          </div>
          <div className="sidebar-foot"><div className="storage"><span>Depolama Alanı</span><strong>8,4 / 20 GB</strong></div><div className="mini-progress"><i style={{ width: "42%" }} /></div></div>
        </aside>

        <main className="workspace">
          {store.error && <div className="error-banner"><span>Bir sorun oluştu. {store.error}</span><Button onClick={store.reset}>Tekrar Dene</Button></div>}
          <section className="page-head">
            <div className="title-line">
              <div className="title-copy"><div className="eyebrow"><span className="tiny-brand">{activeBrand?.initials}</span> {activeBrand?.name.toLocaleUpperCase("tr-TR")} <span>/</span> SOSYAL MEDYA</div><h1><span className="desktop-title">{activeBrand?.name} — {monthLabel(activeMonth).split(" ").reverse().join(" ")} Sosyal Medya Planı</span><span className="mobile-title">{activeBrand?.name}<small>{monthLabel(activeMonth)} Sosyal Medya Planı</small></span></h1></div>
              <div className="head-actions">
                <Button icon="yukle" onClick={() => setOverlay("import")}>Toplu İçe Aktar</Button>
                <Button icon="baglanti" onClick={() => copyApprovalLink()}>Müşteri Onay Linkini Kopyala</Button>
                <Button variant="primary" icon="arti" onClick={openNewContent}><span className="desktop-action-text">Yeni İçerik Satırı Ekle</span><span className="mobile-action-text">İçerik Ekle</span></Button>
                <div className="mobile-actions-wrap" onClick={(event) => event.stopPropagation()}><button className="icon-button mobile-actions-button" aria-label="Diğer işlemler" onClick={() => setMobileActions(!mobileActions)}><Icon name="nokta" /></button>{mobileActions && <div className="header-popover mobile-actions-menu"><button onClick={() => { setOverlay("import"); setMobileActions(false); }}>Toplu İçe Aktar</button><button onClick={() => { copyApprovalLink(); setMobileActions(false); }}>Onay Linkini Kopyala</button></div>}</div>
              </div>
            </div>
            <nav className="tabs" aria-label="Çalışma alanı bölümleri">
              {tabs.map((tab) => <button className={tab === activeTab ? "active" : ""} key={tab} onClick={() => setActiveTab(tab)}>{tab}</button>)}
            </nav>
          </section>

          <section className="plan-bar">
            <div className="month-switcher"><button aria-label="Önceki ay" onClick={() => changeMonth(-1)}><Icon name="sol" /></button><label><strong>{monthLabel(activeMonth)}</strong><input type="month" value={activeMonth} onChange={(event) => setActiveMonth(event.target.value)} aria-label="Ay ve yıl seç" /></label><button aria-label="Sonraki ay" onClick={() => changeMonth(1)}><Icon name="sag" /></button></div>
            <div className="month-progress"><div><strong>%{progress.percent} Tamamlandı</strong><span>{progress.done}/{progress.total} İçerik Hazır</span></div><div className="progress-track"><i style={{ width: `${progress.percent}%` }} /></div></div>
            <div className="summary-tags"><span><i className="dot done" />{progress.done} Tamamlanan</span><span><i className="dot pending" />{progress.total - progress.done} Bekleyen</span></div>
          </section>

          {activeTab === "İçerik Planı" && <PlannerView contents={filteredContents} allCount={monthContents.length} users={data.users} query={query} setQuery={setQuery} filters={filters} setFilters={setFilters} draftFilters={draftFilters} setDraftFilters={setDraftFilters} hasFilters={hasFilters} clearFilters={() => { const clean: Filters = { format: "Tümü", status: "Tümü", assigneeId: "Tümü" }; setFilters(clean); setDraftFilters(clean); }} collapsedWeeks={collapsedWeeks} setCollapsedWeeks={setCollapsedWeeks} selectedContentId={selectedContentId} setSelectedContentId={setSelectedContentId} statusMenu={statusMenu} setStatusMenu={setStatusMenu} assigneeMenu={assigneeMenu} setAssigneeMenu={setAssigneeMenu} rowMenu={rowMenu} setRowMenu={setRowMenu} onStatus={(id, status) => { store.setStatus(id, status); setStatusMenu(null); notify("Durum güncellendi."); }} onAssignee={(id, userId) => { store.setAssignee(id, userId); setAssigneeMenu(null); notify("Sorumlu güncellendi."); }} onEdit={openEdit} onDuplicate={duplicateContent} onMove={(content) => { setSelectedContentId(content.id); setOverlay("move"); setRowMenu(null); }} onCopy={(id) => copyApprovalLink(id)} onDelete={(content) => { setSelectedContentId(content.id); setOverlay("delete"); setRowMenu(null); }} onFiles={(content) => { setSelectedContentId(content.id); setOverlay("files"); }} onComments={(content) => { setSelectedContentId(content.id); setOverlay("comments"); }} onEmptyAction={openNewContent} onMobileFilters={() => setOverlay("mobileFilters")} onDetail={(content) => { setSelectedContentId(content.id); setOverlay("contentDetail"); }} />}
          {activeTab === "Takvim Görünümü" && <CalendarView contents={monthContents} month={activeMonth} onSelect={(content) => { setSelectedContentId(content.id); setOverlay("contentDetail"); }} />}
          {activeTab === "Liste Görünümü" && <ListView contents={filteredContents} users={data.users} onSelect={(content) => { setSelectedContentId(content.id); setOverlay("contentDetail"); }} />}
          {activeTab === "Analizler" && <AnalyticsView contents={monthContents} />}
          {activeTab === "Dosyalar" && <AllFilesView contents={monthContents} onSelect={(content) => { setSelectedContentId(content.id); setOverlay("files"); }} />}
          {activeTab === "Ayarlar" && <SettingsView brand={activeBrand} target={activeBrand?.target ?? 15} onSave={(name, target) => { if (activeBrand) store.saveBrand({ ...activeBrand, name, target }); notify("Marka ayarları kaydedildi."); }} />}
        </main>
      </div>

      {overlay === "content" && <ContentFormModal content={editing} activeBrandId={activeBrandId} activeMonth={activeMonth} users={data.users} onClose={() => setOverlay(null)} onSave={(content) => { store.saveContent(content); setOverlay(null); notify(editing ? "Değişiklikler kaydedildi." : "İçerik başarıyla eklendi."); }} />}
      {overlay === "brand" && <BrandModal onClose={() => setOverlay(null)} onSave={(brand) => { store.addBrand(brand); setActiveBrandId(brand.id); setOverlay(null); notify("Marka başarıyla oluşturuldu."); }} />}
      {overlay === "import" && <ImportModal activeBrandId={activeBrandId} activeMonth={activeMonth} onClose={() => setOverlay(null)} onImport={(items) => { items.forEach(store.saveContent); setOverlay(null); notify(`${items.length} içerik içe aktarıldı.`); }} />}
      {overlay === "delete" && selectedContent && <ConfirmDelete title={selectedContent.title} onClose={() => setOverlay(null)} onDelete={() => { store.deleteContent(selectedContent.id); setOverlay(null); setSelectedContentId(null); notify("İçerik silindi."); }} />}
      {overlay === "move" && selectedContent && <MoveModal content={selectedContent} onClose={() => setOverlay(null)} onSave={(date) => { store.saveContent({ ...selectedContent, date, week: weekOf(date), updatedAt: new Date().toISOString() }); setOverlay(null); notify("İçerik başka haftaya taşındı."); }} />}
      {overlay === "files" && selectedContent && <FilesDrawer content={selectedContent} onClose={() => setOverlay(null)} onChange={(files) => store.setFiles(selectedContent.id, files)} notify={notify} />}
      {overlay === "comments" && selectedContent && <CommentsDrawer content={selectedContent} users={data.users} onClose={() => setOverlay(null)} onAdd={(text) => { store.addComment(selectedContent.id, { id: uid("yorum"), userId: "seda", text, createdAt: new Date().toISOString() }); notify("Yorum eklendi."); }} />}
      {overlay === "contentDetail" && selectedContent && <ContentDetail content={selectedContent} users={data.users} onClose={() => setOverlay(null)} onEdit={() => openEdit(selectedContent)} onFiles={() => setOverlay("files")} onComments={() => setOverlay("comments")} />}
      {overlay === "mobileFilters" && <MobileFilters filters={draftFilters} setFilters={setDraftFilters} users={data.users} onClose={() => setOverlay(null)} onApply={() => { setFilters(draftFilters); setOverlay(null); }} onClear={() => { const clean: Filters = { format: "Tümü", status: "Tümü", assigneeId: "Tümü" }; setDraftFilters(clean); setFilters(clean); }} />}
      {toast && <Toast text={toast.text} tone={toast.tone} onClose={() => setToast(null)} />}
    </div>
  );
}

type PlannerProps = {
  contents: Content[]; allCount: number; users: { id: string; name: string; color: string }[]; query: string; setQuery: (value: string) => void;
  filters: Filters; setFilters: (value: Filters) => void; draftFilters: Filters; setDraftFilters: (value: Filters) => void; hasFilters: boolean; clearFilters: () => void;
  collapsedWeeks: number[]; setCollapsedWeeks: (value: number[]) => void; selectedContentId: string | null; setSelectedContentId: (value: string | null) => void;
  statusMenu: string | null; setStatusMenu: (value: string | null) => void; assigneeMenu: string | null; setAssigneeMenu: (value: string | null) => void; rowMenu: string | null; setRowMenu: (value: string | null) => void;
  onStatus: (id: string, status: Status) => void; onAssignee: (id: string, userId: string) => void; onEdit: (content: Content) => void; onDuplicate: (content: Content) => void;
  onMove: (content: Content) => void; onCopy: (id: string) => void; onDelete: (content: Content) => void; onFiles: (content: Content) => void; onComments: (content: Content) => void;
  onEmptyAction: () => void; onMobileFilters: () => void; onDetail: (content: Content) => void;
};

function PlannerView(props: PlannerProps) {
  const groups = [1, 2, 3, 4].map((week) => ({ week, rows: props.contents.filter((item) => item.week === week) }));
  const noSearch = props.query && props.allCount > 0;
  return <section className="table-panel">
    <div className="toolbar">
      <label className="table-search"><Icon name="ara" /><input value={props.query} onChange={(event) => props.setQuery(event.target.value)} placeholder="İçeriklerde ara…" aria-label="İçeriklerde ara" /></label>
      <select value={props.filters.format} onChange={(event) => { const value = { ...props.filters, format: event.target.value as Filters["format"] }; props.setFilters(value); props.setDraftFilters(value); }} aria-label="Format filtresi"><option value="Tümü">Tüm Formatlar</option>{FORMATS.map((item) => <option key={item}>{item}</option>)}</select>
      <select value={props.filters.status} onChange={(event) => { const value = { ...props.filters, status: event.target.value as Filters["status"] }; props.setFilters(value); props.setDraftFilters(value); }} aria-label="Durum filtresi"><option value="Tümü">Tüm Durumlar</option>{STATUSES.map((item) => <option key={item}>{item}</option>)}</select>
      <select value={props.filters.assigneeId} onChange={(event) => { const value = { ...props.filters, assigneeId: event.target.value }; props.setFilters(value); props.setDraftFilters(value); }} aria-label="Sorumlu filtresi"><option value="Tümü">Tüm Sorumlular</option>{props.users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select>
      <Button icon="filtre" className="mobile-filter-button" onClick={props.onMobileFilters}>Filtrele</Button>
      {props.hasFilters && <button className="clear-filters" onClick={props.clearFilters}>Filtreleri Temizle <Icon name="kapat" size={12} /></button>}
      <span className="result-count">{props.contents.length} içerik</span>
    </div>
    {props.contents.length === 0 ? <EmptyState title={noSearch ? "Aramanızla eşleşen içerik bulunamadı." : props.hasFilters ? "Seçili filtrelere uygun içerik bulunamadı." : "Bu ay için henüz içerik bulunmuyor."} action={!noSearch && !props.hasFilters ? props.onEmptyAction : props.hasFilters ? props.clearFilters : undefined} actionText={props.hasFilters ? "Filtreleri Temizle" : "İlk İçeriği Ekle"} /> :
    <div className="table-wrap">
      <div className="table-header grid-row"><div>Tarih</div><div>Format</div><div>İçerik Başlığı ve Brief</div><div>Dosyalar</div><div>Yorumlar</div><div>Sorumlu</div><div>Durum</div><div /></div>
      {groups.map((group) => {
        if (!group.rows.length) return null;
        const collapsed = props.collapsedWeeks.includes(group.week);
        const completed = group.rows.filter((item) => item.status === "Tamamlandı").length;
        const lastDay = group.week === 4 ? 31 : group.week * 7;
        const firstDay = group.week === 1 ? 1 : (group.week - 1) * 7 + 1;
        return <div className="week" key={group.week}>
          <button className="week-header" onClick={() => props.setCollapsedWeeks(collapsed ? props.collapsedWeeks.filter((item) => item !== group.week) : [...props.collapsedWeeks, group.week])}><span className={`week-chevron ${collapsed ? "closed" : ""}`}><Icon name="asagi" /></span><strong>{group.week}. HAFTA</strong><span>{firstDay} – {lastDay} {monthNames[new Date(`${group.rows[0].date}T12:00:00`).getMonth()]}</span><span className="week-line" /><span>{completed}/{group.rows.length} Tamamlandı</span><span className="week-progress"><i style={{ width: `${group.rows.length ? completed / group.rows.length * 100 : 0}%` }} /></span></button>
          {!collapsed && group.rows.map((content) => <ContentRow key={content.id} content={content} {...props} />)}
        </div>;
      })}
    </div>}
    <div className="mobile-content-list">{groups.map((group) => {
      if (!group.rows.length) return null;
      const collapsed = props.collapsedWeeks.includes(group.week);
      return <div className="mobile-week" key={group.week}><button className="mobile-week-head" onClick={() => props.setCollapsedWeeks(collapsed ? props.collapsedWeeks.filter((item) => item !== group.week) : [...props.collapsedWeeks, group.week])}><strong>{group.week}. HAFTA</strong><span>{group.rows.length} içerik</span><span className={`week-chevron ${collapsed ? "closed" : ""}`}><Icon name="asagi" /></span></button>{!collapsed && group.rows.map((content) => <MobileCard key={content.id} content={content} users={props.users} onDetail={props.onDetail} onFiles={props.onFiles} onComments={props.onComments} rowMenu={props.rowMenu} setRowMenu={props.setRowMenu} onEdit={props.onEdit} onDuplicate={props.onDuplicate} onMove={props.onMove} onCopy={props.onCopy} onDelete={props.onDelete} />)}</div>;
    })}</div>
  </section>;
}

function ContentRow({ content, users, selectedContentId, setSelectedContentId, statusMenu, setStatusMenu, assigneeMenu, setAssigneeMenu, rowMenu, setRowMenu, onStatus, onAssignee, onEdit, onDuplicate, onMove, onCopy, onDelete, onFiles, onComments }: PlannerProps & { content: Content }) {
  const user = users.find((item) => item.id === content.assigneeId) ?? users[0];
  const labels = dateLabel(content.date);
  return <div className={`content-row grid-row ${selectedContentId === content.id ? "row-selected" : ""}`} onClick={() => setSelectedContentId(selectedContentId === content.id ? null : content.id)}>
    <div className="date-cell"><strong>{labels.date}</strong><span>{labels.day}</span></div>
    <div><span className={`format format-${content.format.toLocaleLowerCase("tr-TR")}`}>{content.format}</span></div>
    <div className="title-cell"><strong>{content.title}</strong><span>{content.brief}</span></div>
    <button className="files-cell cell-button" onClick={(event) => { event.stopPropagation(); onFiles(content); }}><div className="thumb-stack">{content.files.slice(0, 2).map((file, index) => file.preview ? <img key={file.id} src={file.preview} alt="Dosya önizlemesi" /> : <span className="file-mini" key={file.id}>{index + 1}</span>)}</div><span>{content.files.length} Dosya</span></button>
    <button className={`comments cell-button ${content.comments.length ? "" : "muted"}`} onClick={(event) => { event.stopPropagation(); onComments(content); }}><Icon name="yorum" size={15} /><span>{content.comments.length ? `${content.comments.length} Yorum` : "Yorum yok"}</span></button>
    <div className="assignee popover-wrap" onClick={(event) => event.stopPropagation()}><button className="assignee-button" onClick={() => setAssigneeMenu(assigneeMenu === content.id ? null : content.id)}><Avatar name={user.name} color={user.color} /><strong>{user.name}</strong></button>{assigneeMenu === content.id && <div className="assignee-menu">{users.map((item) => <button key={item.id} onClick={() => onAssignee(content.id, item.id)}><Avatar name={item.name} color={item.color} />{item.name}{item.id === content.assigneeId && <b>✓</b>}</button>)}</div>}</div>
    <div className="status-cell" onClick={(event) => event.stopPropagation()}><button className={`status status-${statusClass(content.status)}`} onClick={() => setStatusMenu(statusMenu === content.id ? null : content.id)}><span />{content.status}<Icon name="asagi" size={13} /></button>{statusMenu === content.id && <div className="status-menu"><span>Durumu değiştir</span>{STATUSES.map((status) => <button key={status} onClick={() => onStatus(content.id, status)}><i className={`status-dot dot-${statusClass(status)}`} />{status}{status === content.status && <b>✓</b>}</button>)}</div>}</div>
    <div className="menu-cell" onClick={(event) => event.stopPropagation()}><button className="icon-button" aria-label="Satır işlemleri" onClick={() => setRowMenu(rowMenu === content.id ? null : content.id)}><Icon name="nokta" /></button>{rowMenu === content.id && <RowMenu content={content} onEdit={onEdit} onDuplicate={onDuplicate} onMove={onMove} onCopy={onCopy} onDelete={onDelete} />}</div>
  </div>;
}

function RowMenu({ content, onEdit, onDuplicate, onMove, onCopy, onDelete }: { content: Content; onEdit: (content: Content) => void; onDuplicate: (content: Content) => void; onMove: (content: Content) => void; onCopy: (id: string) => void; onDelete: (content: Content) => void }) {
  return <div className="row-menu"><button onClick={() => onEdit(content)}>İçeriği Düzenle</button><button onClick={() => onDuplicate(content)}>Satırı Çoğalt</button><button onClick={() => onMove(content)}>Başka Haftaya Taşı</button><button onClick={() => onCopy(content.id)}>Bağlantıyı Kopyala</button><button className="danger" onClick={() => onDelete(content)}>İçeriği Sil</button></div>;
}

function MobileCard({ content, users, onDetail, onFiles, onComments, rowMenu, setRowMenu, onEdit, onDuplicate, onMove, onCopy, onDelete }: { content: Content; users: { id: string; name: string; color: string }[]; onDetail: (content: Content) => void; onFiles: (content: Content) => void; onComments: (content: Content) => void; rowMenu: string | null; setRowMenu: (id: string | null) => void; onEdit: (content: Content) => void; onDuplicate: (content: Content) => void; onMove: (content: Content) => void; onCopy: (id: string) => void; onDelete: (content: Content) => void }) {
  const user = users.find((item) => item.id === content.assigneeId) ?? users[0];
  const labels = dateLabel(content.date);
  return <article className="content-card" role="button" tabIndex={0} onClick={() => onDetail(content)} onKeyDown={(event) => { if (event.key === "Enter") onDetail(content); }}>
    <div className="card-top"><span>{labels.date} · {labels.day}</span><span className={`format format-${content.format.toLocaleLowerCase("tr-TR")}`}>{content.format}</span></div>
    <strong className="card-title">{content.title}</strong><p>{content.brief}</p>
    <div className="card-meta"><span className="card-assignee"><Avatar name={user.name} color={user.color} />{user.name}</span><span className={`status status-${statusClass(content.status)}`}><span />{content.status}</span></div>
    <div className="card-foot"><button onClick={(event) => { event.stopPropagation(); onFiles(content); }}><Icon name="dosya" size={14} />{content.files.length} Dosya</button><button onClick={(event) => { event.stopPropagation(); onComments(content); }}><Icon name="yorum" size={14} />{content.comments.length ? `${content.comments.length} Yorum` : "Yorum yok"}</button><div className="popover-wrap" onClick={(event) => event.stopPropagation()}><button aria-label="İçerik işlemleri" onClick={() => setRowMenu(rowMenu === content.id ? null : content.id)}><Icon name="nokta" /></button>{rowMenu === content.id && <RowMenu content={content} onEdit={onEdit} onDuplicate={onDuplicate} onMove={onMove} onCopy={onCopy} onDelete={onDelete} />}</div></div>
  </article>;
}

function ContentFormModal({ content, activeBrandId, activeMonth, users, onClose, onSave }: { content: Content | null; activeBrandId: string; activeMonth: string; users: { id: string; name: string }[]; onClose: () => void; onSave: (content: Content) => void }) {
  const [form, setForm] = useState({ date: content?.date ?? `${activeMonth}-01`, format: content?.format ?? "Gönderi" as Format, title: content?.title ?? "", brief: content?.brief ?? "", assigneeId: content?.assigneeId ?? "", status: content?.status ?? "Başlanmamış" as Status });
  const [files, setFiles] = useState<Attachment[]>(content?.files ?? []);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  function submit(event: React.FormEvent) {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!form.date || Number.isNaN(new Date(`${form.date}T12:00:00`).getTime())) nextErrors.date = "Geçerli bir tarih seçin.";
    if (!form.title.trim()) nextErrors.title = "İçerik başlığı zorunludur.";
    if (!form.brief.trim()) nextErrors.brief = "Brief alanı zorunludur.";
    if (!form.assigneeId) nextErrors.assigneeId = "Bir sorumlu seçin.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setSaving(true);
    const now = new Date().toISOString();
    onSave({ id: content?.id ?? uid("icerik"), brandId: content?.brandId ?? activeBrandId, date: form.date, format: form.format, title: form.title.trim(), brief: form.brief.trim(), files, comments: content?.comments ?? [], assigneeId: form.assigneeId, status: form.status, week: weekOf(form.date), createdAt: content?.createdAt ?? now, updatedAt: now });
  }
  function addFiles(list: FileList | null) {
    if (!list) return;
    Array.from(list).forEach((file) => {
      const type: Attachment["type"] = file.type.startsWith("image") ? "Görsel" : file.type.startsWith("video") ? "Video" : file.type.includes("pdf") ? "PDF" : "Doküman";
      if (type === "Görsel") {
        const reader = new FileReader();
        reader.onload = () => setFiles((current) => [...current, { id: uid("dosya"), name: file.name, type, preview: String(reader.result), size: `${Math.max(.1, file.size / 1024 / 1024).toFixed(1)} MB` }]);
        reader.readAsDataURL(file);
      } else setFiles((current) => [...current, { id: uid("dosya"), name: file.name, type, size: `${Math.max(.1, file.size / 1024 / 1024).toFixed(1)} MB` }]);
    });
  }
  return <Modal onClose={onClose}><form onSubmit={submit}><div className="modal-head"><div><h2>{content ? "İçeriği Düzenle" : "Yeni İçerik Ekle"}</h2><p>İçerik planı bilgilerini eksiksiz doldurun.</p></div><button type="button" className="icon-button" aria-label="Pencereyi kapat" onClick={onClose}><Icon name="kapat" /></button></div>
    <div className="form-grid">
      <Field label="Tarih" error={errors.date}><input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></Field>
      <Field label="Format"><select value={form.format} onChange={(event) => setForm({ ...form, format: event.target.value as Format })}>{FORMATS.map((item) => <option key={item}>{item}</option>)}</select></Field>
      <Field label="İçerik Başlığı" error={errors.title} full><input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="İçerik başlığını yazın" /></Field>
      <Field label="Brief" error={errors.brief} full><textarea value={form.brief} onChange={(event) => setForm({ ...form, brief: event.target.value })} placeholder="İçerik detaylarını ve yaratıcı yönlendirmeyi yazın" /></Field>
      <Field label="Sorumlu" error={errors.assigneeId}><select value={form.assigneeId} onChange={(event) => setForm({ ...form, assigneeId: event.target.value })}><option value="">Sorumlu seçin</option>{users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></Field>
      <Field label="Durum"><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as Status })}>{STATUSES.map((item) => <option key={item}>{item}</option>)}</select></Field>
      <Field label="Dosyalar" full><label className="upload-zone"><Icon name="yukle" /><span>Dosya eklemek için seçin veya buraya sürükleyin</span><input type="file" multiple onChange={(event) => addFiles(event.target.files)} /></label>{files.length > 0 && <div className="form-file-list">{files.map((file) => <span key={file.id}>{file.name}<button type="button" aria-label={`${file.name} dosyasını kaldır`} onClick={() => setFiles(files.filter((item) => item.id !== file.id))}><Icon name="kapat" size={12} /></button></span>)}</div>}</Field>
    </div><div className="modal-actions"><Button onClick={onClose}>İptal</Button><Button variant="primary" type="submit" disabled={saving}>{saving ? "Kaydediliyor…" : "İçeriği Kaydet"}</Button></div>
  </form></Modal>;
}

function Field({ label, error, full, children }: { label: string; error?: string; full?: boolean; children: React.ReactNode }) {
  return <label className={full ? "full" : ""}><span>{label}</span>{children}{error && <small className="field-error">{error}</small>}</label>;
}

function BrandModal({ onClose, onSave }: { onClose: () => void; onSave: (brand: Brand) => void }) {
  const [name, setName] = useState(""); const [target, setTarget] = useState(15); const [logo, setLogo] = useState(""); const [error, setError] = useState("");
  function readLogo(file?: File) { if (!file) return; const reader = new FileReader(); reader.onload = () => setLogo(String(reader.result)); reader.readAsDataURL(file); }
  return <Modal onClose={onClose} className="small-modal"><form onSubmit={(event) => { event.preventDefault(); if (!name.trim()) { setError("Marka adı zorunludur."); return; } const initials = name.trim().split(" ").slice(0, 2).map((item) => item[0]).join("").toLocaleUpperCase("tr-TR"); onSave({ id: uid("marka"), name: name.trim(), initials, target, logo }); }}><div className="modal-head"><div><h2>Yeni Marka Ekle</h2><p>Çalışma alanınıza yeni bir marka oluşturun.</p></div><button type="button" className="icon-button" onClick={onClose} aria-label="Pencereyi kapat"><Icon name="kapat" /></button></div><div className="form-grid single"><Field label="Marka Adı" error={error}><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Marka adını yazın" /></Field><Field label="Logo"><input type="file" accept="image/*" onChange={(event) => readLogo(event.target.files?.[0])} /></Field><Field label="Aylık İçerik Hedefi"><input type="number" min="1" max="100" value={target} onChange={(event) => setTarget(Number(event.target.value))} /></Field></div><div className="modal-actions"><Button onClick={onClose}>İptal</Button><Button variant="primary" type="submit">Markayı Oluştur</Button></div></form></Modal>;
}

function ImportModal({ activeBrandId, activeMonth, onClose, onImport }: { activeBrandId: string; activeMonth: string; onClose: () => void; onImport: (items: Content[]) => void }) {
  const [file, setFile] = useState<File | null>(null); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  function importFile() {
    if (!file) return;
    if (!file.name.toLocaleLowerCase("tr-TR").endsWith(".csv")) { setError("Excel dosyaları bu ortamda işlenemiyor. Lütfen CSV biçiminde yükleyin."); return; }
    setBusy(true);
    const reader = new FileReader();
    reader.onerror = () => { setBusy(false); setError("Dosya okunamadı. Lütfen tekrar deneyin."); };
    reader.onload = () => {
      try {
        const lines = String(reader.result).split(/\r?\n/).filter(Boolean);
        const rows = lines.slice(1).map((line) => line.split(",").map((cell) => cell.trim()));
        const now = new Date().toISOString();
        const items = rows.filter((row) => row.length >= 4).map((row) => {
          const date = /^\d{4}-\d{2}-\d{2}$/.test(row[0]) ? row[0] : `${activeMonth}-01`;
          const format = FORMATS.includes(row[1] as Format) ? row[1] as Format : "Gönderi";
          return { id: uid("icerik"), brandId: activeBrandId, date, format, title: row[2], brief: row[3], files: [], comments: [], assigneeId: "seda", status: "Başlanmamış" as Status, week: weekOf(date), createdAt: now, updatedAt: now };
        });
        if (!items.length) throw new Error();
        onImport(items);
      } catch { setBusy(false); setError("CSV içeriği okunamadı. Sütunları Tarih, Format, Başlık ve Brief sırasıyla hazırlayın."); }
    };
    reader.readAsText(file);
  }
  return <Modal onClose={onClose} className="small-modal"><div className="modal-head"><div><h2>Toplu İçerik İçe Aktar</h2><p>Desteklenen biçimler: Excel ve CSV</p></div><button className="icon-button" onClick={onClose} aria-label="Pencereyi kapat"><Icon name="kapat" /></button></div><div className="import-body"><label className="large-upload"><Icon name="yukle" size={22} /><strong>{file ? file.name : "Dosya seç veya buraya sürükle"}</strong><span>CSV önerilir · En fazla 10 MB</span><input type="file" accept=".csv,.xlsx,.xls" onChange={(event) => { setFile(event.target.files?.[0] ?? null); setError(""); }} /></label>{error && <p className="inline-error">{error}</p>}</div><div className="modal-actions"><Button onClick={onClose}>İptal</Button><Button variant="primary" disabled={!file || busy} onClick={importFile}>{busy ? "İşleniyor…" : "İçe Aktar"}</Button></div></Modal>;
}

function ConfirmDelete({ title, onClose, onDelete }: { title: string; onClose: () => void; onDelete: () => void }) {
  return <Modal onClose={onClose} className="confirm-modal"><div className="modal-head"><div><h2>İçeriği Sil</h2><p>“{title}” içeriğini silmek istediğinize emin misiniz?</p></div></div><div className="confirm-copy">Bu işlem geri alınamaz ve içerikle ilişkili yorumlar da silinir.</div><div className="modal-actions"><Button onClick={onClose}>Vazgeç</Button><Button variant="danger" onClick={onDelete}>İçeriği Sil</Button></div></Modal>;
}

function MoveModal({ content, onClose, onSave }: { content: Content; onClose: () => void; onSave: (date: string) => void }) {
  const [date, setDate] = useState(content.date);
  return <Modal onClose={onClose} className="small-modal"><div className="modal-head"><div><h2>Başka Haftaya Taşı</h2><p>Yeni tarih seçildiğinde hafta otomatik hesaplanır.</p></div><button className="icon-button" onClick={onClose} aria-label="Pencereyi kapat"><Icon name="kapat" /></button></div><div className="simple-body"><Field label="Yeni Tarih"><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></Field></div><div className="modal-actions"><Button onClick={onClose}>İptal</Button><Button variant="primary" disabled={!date} onClick={() => onSave(date)}>İçeriği Taşı</Button></div></Modal>;
}

function FilesDrawer({ content, onClose, onChange, notify }: { content: Content; onClose: () => void; onChange: (files: Attachment[]) => void; notify: (text: string, tone?: "success" | "error") => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  async function addFiles(list: FileList | null) {
    if (!list) return;
    const additions = await Promise.all(Array.from(list).map(async (file) => {
      const type: Attachment["type"] = file.type.startsWith("image") ? "Görsel" : file.type.startsWith("video") ? "Video" : file.type.includes("pdf") ? "PDF" : "Doküman";
      let preview: string | undefined;
      if (type === "Görsel") preview = await new Promise<string>((resolve) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.readAsDataURL(file); });
      return { id: uid("dosya"), name: file.name, type, size: `${Math.max(.1, file.size / 1024 / 1024).toFixed(1)} MB`, preview } as Attachment;
    }));
    onChange([...content.files, ...additions]);
    notify(`${additions.length} dosya eklendi.`);
  }
  return <div className="drawer-backdrop" onMouseDown={onClose}><aside className="detail-drawer" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}><div className="drawer-head"><div><h2>İçerik Dosyaları</h2><p>{content.title}</p></div><button className="icon-button" onClick={onClose} aria-label="Paneli kapat"><Icon name="kapat" /></button></div><div className="drawer-body"><button className="drawer-upload" onClick={() => inputRef.current?.click()}><Icon name="yukle" /><span><strong>Dosya Ekle</strong><small>Görsel, Video, PDF veya Doküman</small></span></button><input ref={inputRef} hidden type="file" multiple onChange={(event) => addFiles(event.target.files)} />{content.files.length ? <div className="file-grid">{content.files.map((file) => <div className="file-item" key={file.id}>{file.preview ? <img src={file.preview} alt={`${file.name} önizlemesi`} /> : <div className={`file-type file-${file.type.toLocaleLowerCase("tr-TR")}`}>{file.type.slice(0, 3).toLocaleUpperCase("tr-TR")}</div>}<div><strong>{file.name}</strong><span>{file.type} · {file.size}</span></div><button aria-label={`${file.name} dosyasını sil`} onClick={() => { onChange(content.files.filter((item) => item.id !== file.id)); notify("Dosya silindi."); }}><Icon name="kapat" size={14} /></button></div>)}</div> : <EmptyState title="Bu içerikte henüz dosya bulunmuyor." />}</div></aside></div>;
}

function CommentsDrawer({ content, users, onClose, onAdd }: { content: Content; users: { id: string; name: string; color: string }[]; onClose: () => void; onAdd: (text: string) => void }) {
  const [text, setText] = useState("");
  return <div className="drawer-backdrop" onMouseDown={onClose}><aside className="detail-drawer" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}><div className="drawer-head"><div><h2>Yorumlar</h2><p>{content.title}</p></div><button className="icon-button" onClick={onClose} aria-label="Paneli kapat"><Icon name="kapat" /></button></div><div className="comments-body">{content.comments.length ? content.comments.map((comment) => { const user = users.find((item) => item.id === comment.userId) ?? users[0]; return <div className="comment-item" key={comment.id}><Avatar name={user.name} color={user.color} /><div><div><strong>{user.name}</strong><time>{new Date(comment.createdAt).toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</time></div><p>{comment.text}</p></div></div>; }) : <EmptyState title="Henüz yorum eklenmemiş." />}</div><form className="comment-compose" onSubmit={(event) => { event.preventDefault(); if (!text.trim()) return; onAdd(text.trim()); setText(""); }}><textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="Yorum yaz…" aria-label="Yorum yaz" /><Button variant="primary" type="submit" disabled={!text.trim()}>Gönder</Button></form></aside></div>;
}

function ContentDetail({ content, users, onClose, onEdit, onFiles, onComments }: { content: Content; users: { id: string; name: string; color: string }[]; onClose: () => void; onEdit: () => void; onFiles: () => void; onComments: () => void }) {
  const user = users.find((item) => item.id === content.assigneeId) ?? users[0]; const labels = dateLabel(content.date);
  return <Modal onClose={onClose} className="detail-modal"><div className="modal-head"><div><span className={`format format-${content.format.toLocaleLowerCase("tr-TR")}`}>{content.format}</span><h2>{content.title}</h2><p>{labels.date} · {labels.day}</p></div><button className="icon-button" onClick={onClose} aria-label="Pencereyi kapat"><Icon name="kapat" /></button></div><div className="content-detail-body"><p>{content.brief}</p><dl><div><dt>Sorumlu</dt><dd><Avatar name={user.name} color={user.color} />{user.name}</dd></div><div><dt>Durum</dt><dd><span className={`status status-${statusClass(content.status)}`}><span />{content.status}</span></dd></div></dl><div className="detail-actions"><Button icon="dosya" onClick={onFiles}>{content.files.length} Dosya</Button><Button icon="yorum" onClick={onComments}>{content.comments.length} Yorum</Button></div></div><div className="modal-actions"><Button onClick={onClose}>Kapat</Button><Button variant="primary" onClick={onEdit}>İçeriği Düzenle</Button></div></Modal>;
}

function MobileFilters({ filters, setFilters, users, onClose, onApply, onClear }: { filters: Filters; setFilters: (filters: Filters) => void; users: { id: string; name: string }[]; onClose: () => void; onApply: () => void; onClear: () => void }) {
  return <Modal onClose={onClose} className="filter-sheet"><div className="modal-head"><div><h2>Filtreler</h2><p>İçerik listesini daraltın.</p></div><button className="icon-button" onClick={onClose} aria-label="Pencereyi kapat"><Icon name="kapat" /></button></div><div className="form-grid single"><Field label="Format"><select value={filters.format} onChange={(event) => setFilters({ ...filters, format: event.target.value as Filters["format"] })}><option value="Tümü">Tüm Formatlar</option>{FORMATS.map((item) => <option key={item}>{item}</option>)}</select></Field><Field label="Durum"><select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value as Filters["status"] })}><option value="Tümü">Tüm Durumlar</option>{STATUSES.map((item) => <option key={item}>{item}</option>)}</select></Field><Field label="Sorumlu"><select value={filters.assigneeId} onChange={(event) => setFilters({ ...filters, assigneeId: event.target.value })}><option value="Tümü">Tüm Sorumlular</option>{users.map((user) => <option value={user.id} key={user.id}>{user.name}</option>)}</select></Field></div><div className="modal-actions split"><Button onClick={onClear}>Temizle</Button><Button variant="primary" onClick={onApply}>Filtreleri Uygula</Button></div></Modal>;
}

function CalendarView({ contents, month, onSelect }: { contents: Content[]; month: string; onSelect: (content: Content) => void }) {
  const [year, monthIndex] = month.split("-").map(Number); const count = new Date(year, monthIndex, 0).getDate(); const offset = (new Date(year, monthIndex - 1, 1).getDay() + 6) % 7;
  return <section className="alternate-view"><div className="view-heading"><div><h2>Takvim Görünümü</h2><p>İçerikleri yayın tarihlerine göre yönetin.</p></div><strong>{monthLabel(month)}</strong></div><div className="calendar"><div className="calendar-days">{["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"].map((day) => <span key={day}>{day}</span>)}</div><div className="calendar-grid">{Array.from({ length: offset }, (_, index) => <div className="calendar-cell muted-cell" key={`bos-${index}`} />)}{Array.from({ length: count }, (_, index) => index + 1).map((day) => { const dayContents = contents.filter((item) => Number(item.date.slice(8, 10)) === day); return <div className="calendar-cell" key={day}><span>{day}</span>{dayContents.slice(0, 3).map((item) => <button key={item.id} onClick={() => onSelect(item)} className={`calendar-item format-${item.format.toLocaleLowerCase("tr-TR")}`}>{item.title}</button>)}{dayContents.length > 3 && <small>+{dayContents.length - 3} içerik</small>}</div>; })}</div></div></section>;
}

function ListView({ contents, users, onSelect }: { contents: Content[]; users: { id: string; name: string; color: string }[]; onSelect: (content: Content) => void }) {
  return <section className="alternate-view"><div className="view-heading"><div><h2>Liste Görünümü</h2><p>Tüm içerikler tek bir sıralı listede.</p></div><strong>{contents.length} içerik</strong></div>{contents.length ? <div className="simple-list">{contents.map((content) => { const user = users.find((item) => item.id === content.assigneeId) ?? users[0]; return <button key={content.id} onClick={() => onSelect(content)}><span className="list-date">{dateLabel(content.date).date}</span><span className={`format format-${content.format.toLocaleLowerCase("tr-TR")}`}>{content.format}</span><span className="list-title"><strong>{content.title}</strong><small>{content.brief}</small></span><span className="list-user"><Avatar name={user.name} color={user.color} />{user.name}</span><span className={`status status-${statusClass(content.status)}`}><span />{content.status}</span></button>; })}</div> : <EmptyState title="Bu ay için henüz içerik bulunmuyor." />}</section>;
}

function AnalyticsView({ contents }: { contents: Content[] }) {
  const progress = getProgress(contents);
  return <section className="alternate-view"><div className="view-heading"><div><h2>İçerik Analizleri</h2><p>Plan performansının gerçek zamanlı özeti.</p></div></div><div className="analytics-grid"><article><span>Toplam İçerik</span><strong>{contents.length}</strong><small>Bu ay planlanan</small></article><article><span>Tamamlanan</span><strong>{progress.done}</strong><small>%{progress.percent} tamamlanma</small></article><article><span>Onay Bekleyen</span><strong>{contents.filter((item) => item.status.includes("Onayında")).length}</strong><small>Yönetici veya müşteri</small></article><article><span>Toplam Etkileşim</span><strong>{contents.reduce((sum, item) => sum + item.comments.length, 0)}</strong><small>Plan içi yorum</small></article></div><div className="analysis-panel"><h3>Format Dağılımı</h3>{FORMATS.map((format) => { const count = contents.filter((item) => item.format === format).length; return <div className="analysis-row" key={format}><span>{format}</span><div><i style={{ width: `${contents.length ? count / contents.length * 100 : 0}%` }} /></div><strong>{count}</strong></div>; })}</div></section>;
}

function AllFilesView({ contents, onSelect }: { contents: Content[]; onSelect: (content: Content) => void }) {
  const items = contents.flatMap((content) => content.files.map((file) => ({ content, file })));
  return <section className="alternate-view"><div className="view-heading"><div><h2>Dosyalar</h2><p>Bu ayın içerik dosyalarını tek yerde görüntüleyin.</p></div><strong>{items.length} dosya</strong></div>{items.length ? <div className="all-files-grid">{items.map(({ content, file }) => <button key={`${content.id}-${file.id}`} onClick={() => onSelect(content)}>{file.preview ? <img src={file.preview} alt={`${file.name} önizlemesi`} /> : <div className={`big-file-type file-${file.type.toLocaleLowerCase("tr-TR")}`}>{file.type}</div>}<span><strong>{file.name}</strong><small>{content.title}</small></span></button>)}</div> : <EmptyState title="Bu ay için henüz dosya bulunmuyor." />}</section>;
}

function SettingsView({ brand, target, onSave }: { brand?: Brand; target: number; onSave: (name: string, target: number) => void }) {
  const [name, setName] = useState(brand?.name ?? ""); const [monthlyTarget, setMonthlyTarget] = useState(target);
  useEffect(() => { setName(brand?.name ?? ""); setMonthlyTarget(brand?.target ?? 15); }, [brand]);
  return <section className="alternate-view settings-view"><div className="view-heading"><div><h2>Marka ve Plan Ayarları</h2><p>Planlama tercihlerini ve marka bilgilerini yönetin.</p></div></div><div className="settings-panel"><h3>Genel Bilgiler</h3><Field label="Marka Adı"><input value={name} onChange={(event) => setName(event.target.value)} /></Field><Field label="Aylık İçerik Hedefi"><input type="number" min="1" value={monthlyTarget} onChange={(event) => setMonthlyTarget(Number(event.target.value))} /></Field><Field label="Varsayılan Plan Dili"><select defaultValue="Türkçe"><option>Türkçe</option></select></Field><Button variant="primary" disabled={!name.trim() || monthlyTarget < 1} onClick={() => onSave(name.trim(), monthlyTarget)}>Değişiklikleri Kaydet</Button></div></section>;
}

function EmptyState({ title, action, actionText }: { title: string; action?: () => void; actionText?: string }) {
  return <div className="empty-state"><div><Icon name="takvim" size={24} /></div><strong>{title}</strong><span>Görünümü değiştirebilir veya yeni bir içerik ekleyebilirsiniz.</span>{action && <Button variant="primary" icon="arti" onClick={action}>{actionText}</Button>}</div>;
}

function LoadingScreen() {
  return <div className="loading-screen"><div className="loading-top" /><div className="loading-layout"><div className="loading-side">{Array.from({ length: 8 }, (_, index) => <i key={index} />)}</div><div className="loading-main"><i className="wide" /><i className="medium" />{Array.from({ length: 9 }, (_, index) => <i key={index} />)}</div></div><span>Çalışma alanı hazırlanıyor…</span></div>;
}
