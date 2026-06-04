// app/admin/admin-only/attendance/monthly/components/stat-dashboard.tsx
'use client'

interface SummaryData {
  trainee_count: number
  occurrence_count: number
  present_count?: number
  late_count?: number
  absent_count?: number
  unmarked_count?: number
}

export default function StatDashboard({ summary }: { summary: SummaryData }) {
  return (
    <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '16px', marginBottom: '24px' }}>
      <SummaryCard title="총 수련생" value={summary?.trainee_count} />
      <SummaryCard title="총 회차" value={summary?.occurrence_count} />
      <SummaryCard title="출석 수" value={summary?.present_count} />
      <SummaryCard title="지각 수" value={summary?.late_count} />
      <SummaryCard title="결석 수" value={summary?.absent_count} />
      <SummaryCard title="미체크 수" value={summary?.unmarked_count} />
    </section>
  )
}

function SummaryCard({ title, value }: { title: string; value: number | undefined }) {
  return (
    <div style={{ padding: '16px', border: '1px solid #e5e7eb', borderRadius: '12px', background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
      <div style={{ fontSize: '13px', color: '#6b7280', fontWeight: 500 }}>{title}</div>
      <div style={{ marginTop: '6px', fontSize: '24px', fontWeight: 800, color: '#111827' }}>
        {(value ?? 0).toLocaleString()}
      </div>
    </div>
  )
}