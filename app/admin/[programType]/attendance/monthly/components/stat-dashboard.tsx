//app\admin\[programType]\attendance\monthly\components\stat-dashboard.tsx
'use client'

interface StatDashboardProps {
  summary: { trainee_count: number; occurrence_count: number; present_count: number; late_count: number; absent_count: number; unmarked_count: number }
}

export default function StatDashboard({ summary }: StatDashboardProps) {
  return (
    <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '20px' }}>
      <SummaryCard title="수련생" value={summary.trainee_count} />
      <SummaryCard title="회차" value={summary.occurrence_count} />
      <SummaryCard title="출석" value={summary.present_count} />
      <SummaryCard title="지각" value={summary.late_count} />
      <SummaryCard title="결석" value={summary.absent_count} />
      <SummaryCard title="미처리" value={summary.unmarked_count} />
    </section>
  )
}

function SummaryCard({ title, value }: { title: string; value: number }) {
  return (
    <div style={{ padding: '16px', border: '1px solid #e5e7eb', borderRadius: '12px', background: '#fff' }}>
      <div style={{ fontSize: '13px', color: '#6b7280' }}>{title}</div>
      <div style={{ marginTop: '6px', fontSize: '24px', fontWeight: 800 }}>{value.toLocaleString()}</div>
    </div>
  )
}