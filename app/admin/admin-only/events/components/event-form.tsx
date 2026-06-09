'use client'

import React from 'react'
import { EventFormState, WeekdayCode, AffiliationItem } from '../types'
import { WEEKDAY_OPTIONS } from '../constants'
import {
  panelStyle,
  formLayoutStyle,
  fieldLabelStyle,
  inputStyle,
  checkboxLabelStyle,
  weekdayBadgeStyle,
  primaryButtonStyle,
  secondaryButtonStyle,
} from '../styles'
import { formatRecurrenceDays } from '../utils'

interface Props {
  form: EventFormState
  affiliations: AffiliationItem[]
  isEditing: boolean
  submitting: boolean
  onChange: <K extends keyof EventFormState>(key: K, value: EventFormState[K]) => void
  onToggleDay: (day: WeekdayCode) => void
  onSubmit: () => Promise<void>
  onCancel: () => void
  onRefresh: () => Promise<void>
}

function EventForm({
  form,
  affiliations,
  isEditing,
  submitting,
  onChange,
  onToggleDay,
  onSubmit,
  onCancel,
  onRefresh,
}: Props) {
  return (
    <section style={panelStyle}>
      <h3 style={{ marginTop: 0 }}>
        {isEditing ? '행사 수정' : '행사 생성'}
      </h3>

      <div style={formLayoutStyle}>
        <label style={fieldLabelStyle}>
          <span>행사 이름</span>
          <input
            value={form.name}
            onChange={(e) => onChange('name', e.target.value)}
            placeholder="예: 집중기도회"
            style={inputStyle}
            disabled={submitting}
          />
        </label>

        <label style={fieldLabelStyle}>
          <span>주관 소속</span>
          <select
            value={form.affiliations_id ?? ''}
            onChange={(e) => onChange('affiliations_id', e.target.value)}
            style={inputStyle}
            disabled={submitting}
          >
            <option value="">소속 없음 (전체 노출)</option>
            {affiliations.map((aff) => (
              <option key={aff.id} value={String(aff.id)}>
                {aff.name}
              </option>
            ))}
          </select>
        </label>

        <label style={fieldLabelStyle}>
          <span>기본 시작 시간</span>
          <input
            type="datetime-local"
            value={form.start_time}
            onChange={(e) => onChange('start_time', e.target.value)}
            style={inputStyle}
            disabled={submitting}
          />
        </label>

        <label style={fieldLabelStyle}>
          <span>지각 기준(분)</span>
          <input
            type="number"
            min={0}
            max={180}
            step={1}
            value={form.late_threshold_min}
            onChange={(e) => onChange('late_threshold_min', e.target.value)}
            style={inputStyle}
            disabled={submitting}
          />
        </label>

        <div style={fieldLabelStyle}>
          <span>반복 요일</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {WEEKDAY_OPTIONS.map((option) => {
              const checked = form.recurrence_days.includes(option.value)
              return (
                <label
                  key={option.value}
                  style={{
                    ...weekdayBadgeStyle,
                    background: checked ? '#eff6ff' : '#fff',
                    cursor: submitting ? 'not-allowed' : 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggleDay(option.value)}
                    disabled={submitting}
                  />
                  <span>{option.label}</span>
                </label>
              )
            })}
          </div>
          <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>
            {form.recurrence_days.length > 0
              ? `선택된 요일: ${formatRecurrenceDays(form.recurrence_days)}`
              : '반복 없음'}
          </div>
        </div>

        <label style={checkboxLabelStyle}>
          <input
            type="checkbox"
            checked={form.allow_duplicate_check}
            onChange={(e) => onChange('allow_duplicate_check', e.target.checked)}
            disabled={submitting}
          />
          <span>중복 출석 허용</span>
        </label>

        <label style={checkboxLabelStyle}>
          <input
            type="checkbox"
            checked={form.is_special_event}
            onChange={(e) => onChange('is_special_event', e.target.checked)}
            disabled={submitting}
          />
          <span>아카데미 포인트 지급</span>
        </label>

        <label style={checkboxLabelStyle}>
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => onChange('is_active', e.target.checked)}
            disabled={submitting}
          />
          <span>활성화</span>
        </label>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          <button
            onClick={() => void onSubmit()}
            disabled={submitting}
            style={primaryButtonStyle}
          >
            {submitting ? '처리중...' : isEditing ? '행사 수정' : '행사 생성'}
          </button>

          {isEditing && (
            <button
              onClick={onCancel}
              disabled={submitting}
              style={secondaryButtonStyle}
            >
              수정 취소
            </button>
          )}

          <button
            onClick={() => void onRefresh()}
            disabled={submitting}
            style={secondaryButtonStyle}
          >
            새로고침
          </button>
        </div>
      </div>
    </section>
  )
}

export default React.memo(EventForm)