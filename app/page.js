'use client'
import { useState } from 'react'

export default function AttendancePage() {
  const [name, setName] = useState('')
  const [number, setNumber] = useState('')

  const handleSubmit = async () => {
    const response = await fetch('/api/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name, number: parseInt(number) }),
    })

    const result = await response.json()
    if (response.ok) {
      alert('성공: ' + result.message)
      setName('')   // 성공 시 입력창 초기화
      setNumber('')
    } else {
      alert('실패: ' + result.error)
    }
  }

  return (
    <div style={{ padding: '20px' }}>
      <h2>출석 체크 시스템</h2>
      <input 
        placeholder="이름" 
        value={name}
        onChange={(e) => setName(e.target.value)} 
      />
      <input 
        placeholder="학번/번호" 
        value={number}
        onChange={(e) => setNumber(e.target.value)} 
      />
      <button onClick={handleSubmit}>출석 체크</button>
    </div>
  )
}