'use client'
//./components/absence-reason-manager
import React, { useState } from 'react'
import AbsenceReasonForm from './absence-reason-form'
import AbsenceReasonList, { AbsenceType, AbsenceItem } from './absence-reason-list'

type Props = {
  absenceTypes: AbsenceType[]
}

export default function AbsenceReasonManager({ absenceTypes }: Props) {
  const [editingItem, setEditingItem] = useState<AbsenceItem | null>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const handleEditClick = (item: AbsenceItem) => {
    setEditingItem(item)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSuccess = () => {
    setEditingItem(null)
    setRefreshTrigger((prev) => prev + 1)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <AbsenceReasonForm
        absenceTypes={absenceTypes}
        editingItem={editingItem}
        onSuccess={handleSuccess}
        onCancelEdit={() => setEditingItem(null)}
      />
      <AbsenceReasonList
        absenceTypes={absenceTypes}
        onEditClick={handleEditClick}
        onRefreshTrigger={refreshTrigger}
      />
    </div>
  )
}