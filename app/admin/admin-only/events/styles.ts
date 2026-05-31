// app/admin/admin-only/events/styles.ts

import React from 'react'

export const containerStyle: React.CSSProperties = {
  padding: 20,
  display: 'grid',
  gap: 24,
}

export const formLayoutStyle: React.CSSProperties = {
  display: 'grid',
  gap: 12,
  maxWidth: 560,
}

export const fieldLabelStyle: React.CSSProperties = {
  display: 'grid',
  gap: 6,
}

export const weekdayBadgeStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '8px 10px',
  border: '1px solid #d1d5db',
  borderRadius: 8,
}

export const panelStyle: React.CSSProperties = {
  border: '1px solid #ddd',
  borderRadius: 12,
  padding: 16,
  background: '#fff',
}

export const inputStyle: React.CSSProperties = {
  height: 40,
  padding: '0 12px',
  borderRadius: 8,
  border: '1px solid #ccc',
  fontSize: 14,
}

export const checkboxLabelStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 14,
}

export const primaryButtonStyle: React.CSSProperties = {
  height: 40,
  padding: '0 14px',
  borderRadius: 8,
  border: 'none',
  background: '#111827',
  color: '#fff',
  cursor: 'pointer',
  fontWeight: 600,
}

export const secondaryButtonStyle: React.CSSProperties = {
  height: 40,
  padding: '0 14px',
  borderRadius: 8,
  border: '1px solid #d1d5db',
  background: '#fff',
  color: '#111827',
  cursor: 'pointer',
  fontWeight: 600,
}

export const dangerButtonStyle: React.CSSProperties = {
  height: 40,
  padding: '0 14px',
  borderRadius: 8,
  border: 'none',
  background: '#b91c1c',
  color: '#fff',
  cursor: 'pointer',
  fontWeight: 600,
}

export const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  background: '#fff',
  border: '1px solid #ddd',
}

export const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '12px 14px',
  borderBottom: '1px solid #ddd',
  fontSize: 14,
}

export const tdStyle: React.CSSProperties = {
  padding: '12px 14px',
  borderBottom: '1px solid #eee',
  fontSize: 14,
  verticalAlign: 'top',
}

export const emptyBoxStyle: React.CSSProperties = {
  padding: '16px',
  borderRadius: 10,
  background: '#f9fafb',
  border: '1px solid #e5e7eb',
  color: '#6b7280',
}

export const errorBoxStyle: React.CSSProperties = {
  padding: 12,
  borderRadius: 10,
  background: '#fff1f2',
  border: '1px solid #fecdd3',
  color: '#be123c',
}

export const successBoxStyle: React.CSSProperties = {
  padding: 12,
  borderRadius: 10,
  background: '#f0fdf4',
  border: '1px solid #bbf7d0',
  color: '#166534',
}