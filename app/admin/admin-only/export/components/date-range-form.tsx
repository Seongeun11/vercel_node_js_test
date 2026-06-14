//app\admin\admin-only\export\components\date-range-form.tsx
'use client'

type DateRangeFormProps = {
  dateFrom: string
  dateTo: string
  onDateFromChange: (date: string) => void
  onDateToChange: (date: string) => void
}

export default function DateRangeForm({
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
}: DateRangeFormProps) {
  return (
    <>
      <div>
        <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold' }}>
          시작일 
        </label>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => onDateFromChange(e.target.value)}
          style={{
            width: '100%', 
            padding: '10px',
            boxSizing: 'border-box',
          }}
        />
      </div>

      <div>
        <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold' }}>
          종료일
        </label>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => onDateToChange(e.target.value)}
          style={{
            width: '100%',
            padding: '10px', 
            boxSizing: 'border-box',
          }}
        />
      </div>
    </>
  )
}