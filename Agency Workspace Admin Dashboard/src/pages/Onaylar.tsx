import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { Icon, ICONS, Avatar, StatusBadge, Card, Btn, PageHeader, Modal } from '../components/shared'
import { approvalTasks, customerApprovals, type Task, type StatusKey } from '../data/store'

function ApprovalCard({ task, onApprove, onRevise, onReject }: {
  task: Task
  onApprove: () => void
  onRevise: () => void
  onReject: () => void
}) {
  const done = task.durum === 'Onaylandı' || task.durum === 'Reddedildi'
  return (
    <Card style={{ padding: '16px 18px', opacity: done ? 0.6 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        {/* Thumbnail */}
        <div style={{ width: 52, height: 52, borderRadius: 10, background: 'linear-gradient(135deg, #e0e7ff, #c7d2fe)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6d28d9', flexShrink: 0 }}>
          <Icon d={ICONS.image} size={22} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{task.marka}</div>
              <div style={{ fontSize: 13, color: '#4b5563', marginTop: 1 }}>{task.adi}</div>
            </div>
            <StatusBadge label={task.durum} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
            {task.sorumlu && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#6b7280' }}>
                <Avatar name={task.sorumlu} size={18} />
                {task.sorumlu}
              </span>
            )}
            {task.tur && (
              <span style={{ fontSize: 12, color: '#9ca3af', background: '#f3f4f6', padding: '2px 8px', borderRadius: 6 }}>{task.tur}</span>
            )}
          </div>

          {task.aciklama && (
            <p style={{ fontSize: 12, color: '#6b7280', margin: '8px 0 0', lineHeight: 1.5 }}>{task.aciklama}</p>
          )}

          {!done && (
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <Btn size="sm" variant="success" onClick={onApprove}>
                <Icon d={ICONS.check} size={13} /> Onayla
              </Btn>
              <Btn size="sm" variant="danger" onClick={onRevise}>
                <Icon d={ICONS.edit} size={13} /> Revizyon İste
              </Btn>
              <Btn size="sm" variant="ghost" onClick={onReject}>Reddet</Btn>
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}

function CustomerCard({ task, onSendReminder }: { task: Task; onSendReminder: () => void }) {
  const [sent, setSent] = useState(false)
  return (
    <Card style={{ padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{task.marka}</div>
          <div style={{ fontSize: 13, color: '#4b5563', marginTop: 1 }}>{task.adi}</div>
          {task.tarih && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>{task.tarih}</div>}
          {task.aciklama && <p style={{ fontSize: 12, color: '#6b7280', margin: '6px 0 0', lineHeight: 1.5 }}>{task.aciklama}</p>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
          <StatusBadge label={task.durum} />
          <Btn size="sm" variant="secondary" disabled={sent} onClick={() => { setSent(true); onSendReminder() }}>
            <Icon d={ICONS.send} size={13} /> {sent ? 'Gönderildi' : 'Hatırlat'}
          </Btn>
        </div>
      </div>
    </Card>
  )
}

export default function Onaylar() {
  const [params, setParams] = useSearchParams()
  const activeTab = params.get('sekme') === 'musteri' ? 'musteri' : 'yonetici'

  const [yoneticiOnaylar, setYoneticiOnaylar] = useState<Task[]>(approvalTasks)
  const [musteriOnaylar] = useState<Task[]>(customerApprovals)
  const [toast, setToast] = useState('')

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  function handleApprove(id: string) {
    setYoneticiOnaylar(arr => arr.map(a => a.id === id ? { ...a, durum: 'Onaylandı' as StatusKey } : a))
    showToast('İçerik onaylandı ve yayına hazır olarak işaretlendi.')
  }
  function handleRevise(id: string) {
    setYoneticiOnaylar(arr => arr.map(a => a.id === id ? { ...a, durum: 'Revizyon' as StatusKey } : a))
    showToast('Revizyon talebi sorumluya iletildi.')
  }
  function handleReject(id: string) {
    setYoneticiOnaylar(arr => arr.map(a => a.id === id ? { ...a, durum: 'Reddedildi' as StatusKey } : a))
    showToast('İçerik reddedildi.')
  }

  const bekleyen = yoneticiOnaylar.filter(a => a.durum === 'Yönetici Onayı' || a.durum === 'Revizyon').length

  return (
    <div style={{ maxWidth: 860 }}>
      <PageHeader
        title="Onaylar"
        sub="Yönetici ve müşteri onaylarını buradan yönet."
        action={
          <div style={{ display: 'flex', gap: 8 }}>
            {bekleyen > 0 && (
              <span style={{ fontSize: 12, color: '#6d28d9', background: '#f5f3ff', padding: '6px 12px', borderRadius: 8, fontWeight: 600 }}>
                {bekleyen} onay bekliyor
              </span>
            )}
          </div>
        }
      />

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, background: '#f3f4f6', borderRadius: 10, padding: 4, width: 'fit-content' }}>
        {[
          { key: 'yonetici', label: 'Yönetici Onayı' },
          { key: 'musteri',  label: 'Müşteri Onayı' },
        ].map(tab => (
          <button key={tab.key}
            onClick={() => setParams(tab.key === 'musteri' ? { sekme: 'musteri' } : {})}
            style={{
              padding: '7px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
              background: activeTab === tab.key ? '#fff' : 'transparent',
              color: activeTab === tab.key ? '#111827' : '#6b7280',
              boxShadow: activeTab === tab.key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.15s',
            }}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'yonetici' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {yoneticiOnaylar.map(task => (
            <ApprovalCard key={task.id} task={task}
              onApprove={() => handleApprove(task.id)}
              onRevise={() => handleRevise(task.id)}
              onReject={() => handleReject(task.id)} />
          ))}
        </div>
      )}

      {activeTab === 'musteri' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {musteriOnaylar.map(task => (
            <CustomerCard key={task.id} task={task}
              onSendReminder={() => showToast(`${task.marka} müşterisine hatırlatma gönderildi.`)} />
          ))}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: '#111827', color: '#fff', padding: '11px 20px', borderRadius: 10,
          fontSize: 13, fontWeight: 500, boxShadow: '0 4px 20px rgba(0,0,0,0.2)', zIndex: 500,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <Icon d={ICONS.check} size={14} />
          {toast}
        </div>
      )}
    </div>
  )
}
