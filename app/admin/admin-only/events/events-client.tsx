//app\admin\admin-only\events\events-client.tsx
'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'

import EventForm from './components/event-form'
import EventList from './components/event-list'

import { useEvents } from './hooks/use-events'

import type {
  EventItem,
  EventFormState,
  WeekdayCode,
} from './types'

import {
  normalizeRecurrenceDays,
  toDateTimeLocalValue,
} from './utils'

import {
  containerStyle,
  panelStyle,
  errorBoxStyle,
  successBoxStyle,
} from './styles'

const DEFAULT_FORM: EventFormState = {
  name: '',
  start_time: toDateTimeLocalValue(
    new Date().toISOString()
  ),
  late_threshold_min: '5',
  allow_duplicate_check: false,
  is_special_event: false,
  recurrence_type: 'none',
  recurrence_days: [],
  is_active: true,
  affiliations_id: '', // 기본값 공백 처리 (null 대응)
}

export default function EventsClient() {
  const {
    events,
    affiliations, // 훅에서 가져온 소속 목록 리스트 추가
    loading,
    refresh,
  } = useEvents()

  const [form, setForm] =
    useState<EventFormState>(
      DEFAULT_FORM
    )

  const [editingId, setEditingId] =
    useState<string | null>(null)

  const [submitting, setSubmitting] =
    useState(false)

  const [error, setError] =
    useState('')

  const [success, setSuccess] =
    useState('')

  useEffect(() => {
    void refresh()
  }, [refresh])

  const isEditing = useMemo(
    () => editingId !== null,
    [editingId]
  )

  const resetForm = useCallback(() => {
    setForm({
      ...DEFAULT_FORM,
      start_time:
        toDateTimeLocalValue(
          new Date().toISOString()
        ),
    })

    setEditingId(null)
  }, [])

  const handleChange = useCallback(
    <
      K extends keyof EventFormState
    >(
      key: K,
      value: EventFormState[K]
    ) => {
      setForm((prev) => ({
        ...prev,
        [key]: value,
      }))
    },
    []
  )

  const toggleRecurrenceDay =
    useCallback(
      (day: WeekdayCode) => {
        setForm((prev) => {
          const exists =
            prev.recurrence_days.includes(
              day
            )

          const nextDays =
            exists
              ? prev.recurrence_days.filter(
                  (v) => v !== day
                )
              : [
                  ...prev.recurrence_days,
                  day,
                ]

          const sortedDays =
            normalizeRecurrenceDays(
              nextDays
            )

          return {
            ...prev,
            recurrence_days:
              sortedDays,
            recurrence_type:
              sortedDays.length > 0
                ? 'daily'
                : 'none',
          }
        })
      },
      []
    )

  const validateForm =
    useCallback((): string => {
      const name =
        form.name.trim()

      const startTime =
        form.start_time.trim()

      const lateThreshold =
        Number(
          form.late_threshold_min
        )

      if (!name) {
        return '행사 이름을 입력해주세요.'
      }

      if (!startTime) {
        return '시작 시간을 입력해주세요.'
      }

      if (
        Number.isNaN(
          new Date(
            startTime
          ).getTime()
        )
      ) {
        return '시작 시간 형식이 올바르지 않습니다.'
      }

      if (
        !Number.isInteger(
          lateThreshold
        ) ||
        lateThreshold < 0 ||
        lateThreshold > 180
      ) {
        return '지각 기준은 0~180 사이 정수여야 합니다.'
      }

      if (
        form.recurrence_type ===
          'daily' &&
        form.recurrence_days
          .length === 0
      ) {
        return '반복 요일을 1개 이상 선택해주세요.'
      }

      return ''
    }, [form])

  const startEdit =
    useCallback(
      (event: EventItem) => {
        setError('')
        setSuccess('')

        setEditingId(event.id)

        const days =
          normalizeRecurrenceDays(
            event.recurrence_days
          )

        setForm({
          name: event.name,
          start_time:
            toDateTimeLocalValue(
              event.start_time
            ),
          late_threshold_min:
            String(
              event.late_threshold_min ??
                5
            ),
          allow_duplicate_check:
            Boolean(
              event.allow_duplicate_check
            ),
          is_special_event:
            Boolean(
              event.is_special_event
            ),
          recurrence_type:
            days.length > 0
              ? 'daily'
              : 'none',
          recurrence_days:
            days,
          is_active:
            Boolean(
              event.is_active
            ),
          affiliations_id: event.affiliations_id ? String(event.affiliations_id) : '', // 도메인 매핑 바인딩
        })

        window.scrollTo({
          top: 0,
          behavior: 'smooth',
        })
      },
      []
    )

  const handleSubmit =
    useCallback(async () => {
      const validation =
        validateForm()

      if (validation) {
        setError(validation)
        setSuccess('')
        return
      }

      try {
        setSubmitting(true)
        setError('')
        setSuccess('')

        // 전송용 데이터 생성 (소속 아이디 string -> number | null 가공 파트 포함)
        const payload = {
          ...(editingId
            ? {
                id: editingId,
              }
            : {}),
          name: form.name.trim(),
          start_time:
            new Date(
              form.start_time
            ).toISOString(),
          late_threshold_min:
            Number(
              form.late_threshold_min
            ),
          allow_duplicate_check:
            form.allow_duplicate_check,
          is_special_event:
            form.is_special_event,
          recurrence_type:
            form.recurrence_type,
          recurrence_days:
            form.recurrence_type ===
            'daily'
              ? form.recurrence_days
              : [],
          is_active:
            form.is_active,
          affiliations_id: form.affiliations_id ? Number(form.affiliations_id) : null, // DB 호환 변환 처리
        }

        const endpoint =
          editingId
            ? '/api/events/update'
            : '/api/events/create'

        const res = await fetch(
          endpoint,
          {
            method: 'POST',
            credentials:
              'include',
            headers: {
              'Content-Type':
                'application/json',
            },
            body: JSON.stringify(
              payload
            ),
          }
        )

        const data =
          await res.json()

        if (!res.ok) {
          throw new Error(
            data.error ||
              (editingId
                ? '행사 수정 실패'
                : '행사 생성 실패')
          )
        }

        setSuccess(
          editingId
            ? '행사가 수정되었습니다.'
            : '행사가 생성되었습니다.'
        )

        resetForm()

        await refresh()
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : editingId
            ? '행사 수정 중 오류 발생'
            : '행사 생성 중 오류 발생'
        )
      } finally {
        setSubmitting(false)
      }
    }, [
      editingId,
      form,
      refresh,
      resetForm,
      validateForm,
    ])

  const handleDelete =
    useCallback(
      async (id: string) => {
        if (
          !window.confirm(
            '정말 이 행사를 삭제하시겠습니까?'
          )
        ) {
          return
        }

        try {
          setSubmitting(true)
          setError('')
          setSuccess('')

          const res =
            await fetch(
              '/api/events/delete',
              {
                method: 'POST',
                credentials:
                  'include',
                headers: {
                  'Content-Type':
                    'application/json',
                },
                body: JSON.stringify({
                  id,
                }),
              }
            )

          const data =
            await res.json()

          if (!res.ok) {
            throw new Error(
              data.error ??
                '행사 삭제 실패'
            )
          }

          if (
            editingId === id
          ) {
            resetForm()
          }

          setSuccess(
            '행사가 삭제되었습니다.'
          )

          await refresh()
        } catch (err) {
          setError(
            err instanceof Error
              ? err.message
              : '행사 삭제 중 오류 발생'
          )
        } finally {
          setSubmitting(false)
        }
      },
      [
        editingId,
        refresh,
        resetForm,
      ]
    )

  if (loading) {
    return (
      <div
        style={{
          padding: 20,
        }}
      >
        로딩중...
      </div>
    )
  }

  return (
    <div style={containerStyle}>
      <div>
        <h2
          style={{
            marginBottom: 8,
          }}
        >
          행사 관리
        </h2>

        <p
          style={{
            color: '#666',
            margin: 0,
          }}
        >
          관리자 전용 행사 설정
          화면입니다. 소속설정, 반복
          규칙과 기본 속성을
          관리합니다.
        </p>
      </div>

      <EventForm
        form={form}
        affiliations={affiliations}
        isEditing={isEditing}
        submitting={submitting}
        onChange={handleChange}
        onToggleDay={
          toggleRecurrenceDay
        }
        onSubmit={handleSubmit}
        onCancel={resetForm}
        onRefresh={refresh}
      />

      {error && (
        <div
          style={errorBoxStyle}
        >
          {error}
        </div>
      )}

      {success && (
        <div
          style={
            successBoxStyle
          }
        >
          {success}
        </div>
      )}

      <section
        style={{
          display: 'grid',
          gap: 16,
        }}
      >
        <h3
          style={{
            margin: 0,
          }}
        >
          행사 목록
        </h3>

        <EventList
          events={events}
          affiliations={affiliations}
          submitting={
            submitting
          }
          onEdit={startEdit}
          onDelete={
            handleDelete
          }
        />
      </section>
    </div>
  )
}