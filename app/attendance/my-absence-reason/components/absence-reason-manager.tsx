'use client'

import React, { useState } from 'react'
import AbsenceReasonForm, { EventOption } from './absence-reason-form'
import AbsenceReasonList, { AbsenceType, AbsenceItem } from './absence-reason-list'

type Props = {
  absenceTypes: AbsenceType[]
  events?: EventOption[] // ✨ events 타입 추가
}

export default function AbsenceReasonManager({ absenceTypes, events = [] }: Props) {
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
        events={events} // ✨ Form으로 전달 추가
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