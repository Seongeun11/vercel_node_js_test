export const styles = {
  containerStyle: { padding: '24px', maxWidth: '1200px', margin: '0 auto', fontFamily: 'sans-serif', color: '#1e293b' },
  panelStyle: { background: '#ffffff', padding: '24px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05), 0 2px 4px -1px rgb(0 0 0 / 0.03)', marginBottom: '24px', border: '1px solid #e2e8f0' },
  dangerButtonStyle: { padding: '8px 16px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' },
  tableStyle: { width: '100%', borderCollapse: 'collapse' as const, marginTop: '12px', fontSize: '14px' },
  thStyle: { padding: '12px', textAlign: 'left' as const, borderBottom: '2px solid #e2e8f0', background: '#f8fafc', fontWeight: 600 },
  tdStyle: { padding: '12px', borderBottom: '1px solid #e2e8f0' },
  emptyBoxStyle: { padding: '40px', textAlign: 'center' as const, color: '#94a3b8', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1' },
  badgeScheduled: { padding: '2px 8px', background: '#fef3c7', color: '#d97706', borderRadius: '4px', fontSize: '12px', fontWeight: 500 },
  badgeOpen: { padding: '2px 8px', background: '#dcfce7', color: '#16a34a', borderRadius: '4px', fontSize: '12px', fontWeight: 500 },
  qrPreviewBox: { padding: '12px', background: '#f1f5f9', borderRadius: '6px', border: '1px solid #cbd5e1', marginTop: '8px', display: 'inline-block', textAlign: 'center' as const },
  modalBackdrop: { position: 'fixed' as const, top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0, 0, 0, 0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  modalContent: { background: '#fff', padding: '32px', borderRadius: '16px', textAlign: 'center' as const, boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', maxWidth: '400px', width: '90%' }
};