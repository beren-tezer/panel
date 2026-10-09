import { useState } from 'react'
import { Icon, ICONS, Avatar, Card, Btn, PageHeader, Modal } from '../components/shared'
import { team as initTeam, type TeamMember } from '../data/store'

function MemberCard({ member, onClick }: { member: TeamMember; onClick: () => void }) {
  const oran = Math.round((member.tamamlanan / (member.tamamlanan + member.aktifIs + 1)) * 100)
  return (
    <Card style={{ padding: 20, cursor: 'pointer', transition: 'box-shadow 0.15s' }}
      onMouseEnter={(e: any) => e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'}
      onMouseLeave={(e: any) => e.currentTarget.style.boxShadow = 'none'}
      onClick={onClick}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <Avatar name={member.ad} size={42} color={member.renk} />
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{member.ad}</div>
          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{member.rol}</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 20, marginBottom: 14 }}>
        <div><div style={{ fontSize: 20, fontWeight: 700, color: '#111827' }}>{member.aktifIs}</div><div style={{ fontSize: 11, color: '#9ca3af' }}>Aktif İş</div></div>
        <div><div style={{ fontSize: 20, fontWeight: 700, color: '#16a34a' }}>{member.tamamlanan}</div><div style={{ fontSize: 11, color: '#9ca3af' }}>Tamamlanan</div></div>
      </div>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
          <span style={{ fontSize: 11, color: '#9ca3af' }}>Verimlilik</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#111827' }}>%{oran}</span>
        </div>
        <div style={{ height: 4, background: '#e9eaf0', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ width: `${oran}%`, background: member.renk, height: '100%', borderRadius: 2 }} />
        </div>
      </div>
    </Card>
  )
}

export default function Ekip() {
  const [team] = useState<TeamMember[]>(initTeam)
  const [selected, setSelected] = useState<TeamMember | null>(null)

  return (
    <div>
      <PageHeader title="Ekip" sub={`${team.length} ekip üyesi · Toplam ${team.reduce((a, m) => a + m.aktifIs, 0)} aktif iş`}
        action={<Btn><Icon d={ICONS.plus} size={14} /> Üye Davet Et</Btn>} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
        {team.map(m => <MemberCard key={m.id} member={m} onClick={() => setSelected(m)} />)}
      </div>

      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.ad ?? ''}>
        {selected && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <Avatar name={selected.ad} size={56} color={selected.renk} />
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>{selected.ad}</div>
                <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 2 }}>{selected.rol}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 24 }}>
              {[
                { label: 'Aktif İş', val: selected.aktifIs },
                { label: 'Tamamlanan', val: selected.tamamlanan },
              ].map(({ label, val }) => (
                <div key={label}>
                  <div style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#111827' }}>{val}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, paddingTop: 8, borderTop: '1px solid #f3f4f6' }}>
              <Btn variant="secondary" onClick={() => setSelected(null)}>Kapat</Btn>
              <Btn variant="ghost">Mesaj Gönder</Btn>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
