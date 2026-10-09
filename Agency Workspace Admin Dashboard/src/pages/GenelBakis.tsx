import { useState } from 'react'
import { useNavigate } from 'react-router'
import {
  Icon, ICONS, Avatar, AVATAR_COLORS, StatusBadge, ProgressBar,
  TaskRow, Card, Btn, Modal,
} from '../components/shared'
import {
  tasks, approvalTasks, customerApprovals,
  type Task, type StatusKey,
} from '../data/store'

// ── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ title, value, sub, accent, urgent, onClick }: {
  title: string; value: number; sub: string
  accent?: boolean; urgent?: boolean; onClick?: () => void
}) {
  return (
    <div onClick={onClick} style={{
      background: '#fff', border: '1px solid #e4e6eb', borderRadius: 12,
      padding: '18px 20px', flex: 1, minWidth: 0, cursor: onClick ? 'pointer' : 'default',
      borderTop: urgent ? '3px solid #ef4444' : accent ? '3px solid #4f46e5' : '3px solid transparent',
      transition: 'box-shadow 0.15s',
    }}
      onMouseEnter={e => onClick && ((e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)')}
      onMouseLeave={e => onClick && ((e.currentTarget as HTMLDivElement).style.boxShadow = 'none')}
    >
      <div style={{ fontSize: 11.5, color: '#9ca3af', fontWeight: 500, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{title}</div>
      <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1, marginBottom: 6, color: urgent ? '#dc2626' : accent ? '#4f46e5' : '#111827' }}>
        {value}
      </div>
      <div style={{ fontSize: 12, color: urgent ? '#dc2626' : '#9ca3af', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
        {urgent && <Icon d={ICONS.alert} size={12} />}
        {accent && <Icon d={ICONS.trendUp} size={12} />}
        {sub}
      </div>
    </div>
  )
}

// ── Ops Card wrapper ──────────────────────────────────────────────────────────
function OpsCard({ title, count, children, accent, urgent, actionLabel, onAction }: {
  title: string; count: number; children: React.ReactNode
  accent?: string; urgent?: boolean; actionLabel?: string; onAction?: () => void
}) {
  return (
    <Card style={{
      display: 'flex', flexDirection: 'column',
      borderTop: urgent ? '3px solid #ef4444' : accent ? `3px solid ${accent}` : '3px solid transparent',
      boxShadow: urgent ? '0 1px 8px rgba(239,68,68,0.08)' : '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      <div style={{ padding: '14px 16px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{title}</span>
          <span style={{
            fontSize: 11, fontWeight: 600, padding: '1px 7px', borderRadius: 10,
            background: urgent ? '#fef2f2' : accent ? '#eef2ff' : '#f3f4f6',
            color: urgent ? '#dc2626' : accent ? '#4f46e5' : '#6b7280',
          }}>{count}</span>
        </div>
        {actionLabel && (
          <button onClick={onAction} style={{ fontSize: 11, color: '#4f46e5', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit' }}>
            {actionLabel} →
          </button>
        )}
      </div>
      <div style={{ padding: '6px 16px 14px', flex: 1 }}>{children}</div>
    </Card>
  )
}

// ── Approval thumbnail row ────────────────────────────────────────────────────
function ApprovalRow({ task, onApprove, onRevise }: { task: Task; onApprove: () => void; onRevise: () => void }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid #f3f4f6' }}
    >
      <div style={{ width: 38, height: 38, borderRadius: 8, background: 'linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6d28d9' }}>
        <Icon d={ICONS.image} size={16} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>{task.marka} · <span style={{ fontWeight: 400, color: '#4b5563' }}>{task.adi}</span></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
          <Avatar name={task.sorumlu ?? ''} size={14} />
          <span style={{ fontSize: 11, color: '#9ca3af' }}>{task.sorumlu} · {task.tur}</span>
        </div>
      </div>
      {hovered ? (
        <div style={{ display: 'flex', gap: 6 }}>
          <Btn size="sm" variant="success" onClick={onApprove}>Onayla</Btn>
          <Btn size="sm" variant="danger" onClick={onRevise}>Revizyon</Btn>
        </div>
      ) : (
        <StatusBadge label={task.durum} />
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function GenelBakis() {
  const navigate = useNavigate()
  const [approvals, setApprovals] = useState<Task[]>(approvalTasks)
  const [custApprovals, setCustApprovals] = useState<Task[]>(customerApprovals)
  const [activeTasks] = useState<Task[]>(tasks)
  const [detailTask, setDetailTask] = useState<Task | null>(null)

  const geciken = activeTasks.filter(t => t.durum === 'Gecikti' || t.durum === 'Acil')
  const aktif = activeTasks.filter(t => t.durum === 'Aktif' || t.durum === 'Geliştiriliyor')
  const tamamlandi = activeTasks.filter(t => t.durum === 'Tamamlandı' || t.durum === 'Yayına Hazır')
  const webTeknik = activeTasks.filter(t => t.tur === 'Web' || t.tur === 'Teknik')
  const ajansIci = activeTasks.filter(t => t.tur === 'İç İş' || t.tur === 'Rapor' || t.tur === 'Toplantı')

  function handleApprove(id: string) {
    setApprovals(arr => arr.map(a => a.id === id ? { ...a, durum: 'Onaylandı' as StatusKey } : a))
  }
  function handleRevise(id: string) {
    setApprovals(arr => arr.map(a => a.id === id ? { ...a, durum: 'Revizyon' as StatusKey } : a))
  }

  return (
    <>
      {/* KPIs */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 24 }}>
        <KpiCard title="Bugünkü Teslimatlar" value={24} sub="Dünden 6 fazla" accent onClick={() => navigate('/gorevler')} />
        <KpiCard title="Geciken İşler" value={geciken.length} sub={`${geciken.filter(t=>t.oncelik==='kritik').length} kritik iş`} urgent onClick={() => navigate('/gorevler?filtre=gecikti')} />
        <KpiCard title="Yönetici Onayı" value={approvals.filter(a => a.durum === 'Yönetici Onayı').length} sub="İncelenmeyi bekliyor" onClick={() => navigate('/onaylar')} />
        <KpiCard title="Müşteri Onayı" value={custApprovals.filter(c => c.durum === 'Müşteri Onayı').length} sub="Yanıt bekliyor" onClick={() => navigate('/onaylar?sekme=musteri')} />
      </div>

      {/* Ops Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>

        {/* 1 Geciken & Acil */}
        <OpsCard title="Geciken & Acil İşler" count={geciken.length} urgent>
          {geciken.slice(0, 4).map(t => (
            <TaskRow key={t.id} marka={t.marka} adi={t.adi} sorumlu={t.sorumlu} tarih={t.tarih} durum={t.durum}
              onClick={() => setDetailTask(t)} />
          ))}
          <button onClick={() => navigate('/gorevler?filtre=gecikti')}
            style={{ marginTop: 8, fontSize: 12, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit', padding: 0 }}>
            Tümünü görüntüle →
          </button>
        </OpsCard>

        {/* 5 Yönetici Onayı */}
        <OpsCard title="Yönetici Onayı" count={approvals.filter(a=>a.durum==='Yönetici Onayı').length}
          accent="#7c3aed" actionLabel="Tümünü Gör" onAction={() => navigate('/onaylar')}>
          {approvals.filter(a => a.durum !== 'Onaylandı').slice(0, 3).map(t => (
            <ApprovalRow key={t.id} task={t}
              onApprove={() => handleApprove(t.id)}
              onRevise={() => handleRevise(t.id)} />
          ))}
        </OpsCard>

        {/* 6 Müşteri Onayı */}
        <OpsCard title="Müşteri Onayı" count={custApprovals.filter(c=>c.durum==='Müşteri Onayı').length} accent="#d97706">
          {custApprovals.map(t => (
            <TaskRow key={t.id} marka={t.marka} adi={t.adi} tarih={t.tarih} durum={t.durum}
              onClick={() => navigate('/onaylar?sekme=musteri')} />
          ))}
        </OpsCard>

        {/* 2 Aktif */}
        <OpsCard title="Aktif Çalışılanlar" count={aktif.length} actionLabel="Tümü" onAction={() => navigate('/gorevler?filtre=aktif')}>
          {aktif.slice(0, 3).map(t => (
            <TaskRow key={t.id} marka={t.marka} adi={t.adi} sorumlu={t.sorumlu} tarih={t.tur}
              durum={t.durum} progress={t.progress} onClick={() => setDetailTask(t)} />
          ))}
        </OpsCard>

        {/* 3 Tamamlanan */}
        <OpsCard title="Tamamlanan & Yayına Hazır" count={tamamlandi.length} accent="#16a34a">
          {tamamlandi.map(t => (
            <TaskRow key={t.id} marka={t.marka} adi={t.adi} durum={t.durum}
              onClick={() => setDetailTask(t)} />
          ))}
        </OpsCard>

        {/* 4 Web & Teknik */}
        <OpsCard title="Web & Teknik" count={webTeknik.length} accent="#4f46e5">
          {webTeknik.map(t => (
            <TaskRow key={t.id} marka={t.marka} adi={t.adi} sorumlu={t.sorumlu} durum={t.durum}
              onClick={() => setDetailTask(t)} />
          ))}
          <button onClick={() => navigate('/gorevler?filtre=web')}
            style={{ marginTop: 8, fontSize: 12, color: '#4f46e5', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit', padding: 0 }}>
            Teknik işleri gör →
          </button>
        </OpsCard>

        {/* 7 Ajans İçi */}
        <OpsCard title="Ajans İçi İşler" count={ajansIci.length}>
          {ajansIci.map(t => (
            <TaskRow key={t.id} marka={t.tur ?? ''} adi={t.adi} sorumlu={t.sorumlu} tarih={t.tarih} durum={t.durum}
              onClick={() => setDetailTask(t)} />
          ))}
        </OpsCard>

        {/* 8 Reklam */}
        <OpsCard title="Reklam & Kampanya" count={5} accent="#4f46e5" actionLabel="Tümü" onAction={() => navigate('/reklamlar')}>
          <TaskRow marka="Sofra Pide" adi="Meta Reklamları" durum="Aktif" onClick={() => navigate('/reklamlar')} />
          <TaskRow marka="Edva" adi="Google Reklamları" durum="Optimizasyon" onClick={() => navigate('/reklamlar')} />
          <TaskRow marka="Tepe Emlak" adi="Yeni Kampanya" durum="Yönetici Onayı" onClick={() => navigate('/reklamlar')} />
        </OpsCard>
      </div>

      {/* Task Detail Modal */}
      <Modal open={!!detailTask} onClose={() => setDetailTask(null)}
        title={detailTask ? `${detailTask.marka} · ${detailTask.adi}` : ''}>
        {detailTask && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <StatusBadge label={detailTask.durum} />
              {detailTask.tur && <span style={{ fontSize: 12, color: '#9ca3af', background: '#f3f4f6', padding: '2px 8px', borderRadius: 6 }}>{detailTask.tur}</span>}
              {detailTask.oncelik === 'kritik' && <span style={{ fontSize: 12, color: '#dc2626', background: '#fef2f2', padding: '2px 8px', borderRadius: 6, fontWeight: 600 }}>Kritik Öncelik</span>}
            </div>

            {detailTask.aciklama && (
              <p style={{ fontSize: 13, color: '#4b5563', lineHeight: 1.6, margin: 0, padding: '12px 14px', background: '#f9fafb', borderRadius: 8 }}>
                {detailTask.aciklama}
              </p>
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
              {detailTask.sorumlu && (
                <div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Sorumlu</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Avatar name={detailTask.sorumlu} size={22} />
                    <span style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>{detailTask.sorumlu}</span>
                  </div>
                </div>
              )}
              {detailTask.tarih && (
                <div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Teslim Tarihi</div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>{detailTask.tarih}</div>
                </div>
              )}
              {detailTask.marka && (
                <div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Marka</div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>{detailTask.marka}</div>
                </div>
              )}
            </div>

            {detailTask.progress !== undefined && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: '#6b7280' }}>İlerleme</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>%{detailTask.progress}</span>
                </div>
                <ProgressBar value={detailTask.progress} />
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, paddingTop: 8, borderTop: '1px solid #f3f4f6' }}>
              <Btn onClick={() => { navigate('/gorevler'); setDetailTask(null) }}>Göreve Git</Btn>
              <Btn variant="secondary" onClick={() => setDetailTask(null)}>Kapat</Btn>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
