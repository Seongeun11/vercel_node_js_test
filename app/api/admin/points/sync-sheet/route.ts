// app/api/admin/points/sync-sheet/route.ts
import { NextRequest } from 'next/server'
import { requireRole } from '@/lib/serverAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { assertSameOrigin } from '@/lib/security/csrf'
import { jsonNoStore } from '@/lib/security/api-response'

/**
 * 다양한 형태의 구글 시트 전체 URL을 안정적인 CSV 직접 다운로드 URL로 변환합니다.
 */
function getCsvUrl(sheetUrl: string): string {
  const trimmed = sheetUrl.trim()

  // 1. 이미 CSV 출력 형태인 경우
  if (trimmed.includes('output=csv') || trimmed.includes('format=csv')) {
    return trimmed
  }

  // 2. '웹에 게시(pubhtml 또는 pub)'된 링크 처리
  if (trimmed.includes('/pubhtml')) {
    return trimmed.replace('/pubhtml', '/pub?output=csv')
  }
  if (trimmed.includes('/pub?')) {
    return trimmed.includes('output=csv') ? trimmed : `${trimmed}&output=csv`
  }

  // 3. 일반 편집/보기 공유 링크 (https://docs.google.com/spreadsheets/d/{ID}/edit...)
  const spreadsheetIdMatch = trimmed.match(/\/d\/([a-zA-Z0-9-_]+)/)
  if (spreadsheetIdMatch && spreadsheetIdMatch[1]) {
    const spreadsheetId = spreadsheetIdMatch[1]
    
    // gid 추출 (없으면 기본 0)
    const gidMatch = trimmed.match(/[#&?]gid=([0-9]+)/)
    const gid = gidMatch ? gidMatch[1] : '0'

    // export 대신 pub?output=csv 형식이 구글 봇 차단 우회에 더 안정적입니다.
    return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/pub?output=csv&gid=${gid}`
  }

  return trimmed
}

/**
 * RFC 4180 준수 표준 CSV 파서 (셀 내부 쉼표 및 큰따옴표 처리)
 */
function parseCSV(text: string): string[][] {
  const lines: string[][] = []
  let currentRow: string[] = []
  let currentEntry = ''
  let insideQuotes = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    const nextChar = text[i + 1]

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentEntry += '"'
        i++ // 이중 따옴표 이스케이프
      } else {
        insideQuotes = !insideQuotes
      }
    } else if (char === ',' && !insideQuotes) {
      currentRow.push(currentEntry.trim())
      currentEntry = ''
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++
      }
      currentRow.push(currentEntry.trim())
      if (currentRow.some(cell => cell.length > 0)) {
        lines.push(currentRow)
      }
      currentRow = []
      currentEntry = ''
    } else {
      currentEntry += char
    }
  }

  if (currentEntry.length > 0 || currentRow.length > 0) {
    currentRow.push(currentEntry.trim())
    if (currentRow.some(cell => cell.length > 0)) {
      lines.push(currentRow)
    }
  }

  return lines
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request)
    const authResult = await requireRole(['admin'])
    if (!authResult.ok) return jsonNoStore({ error: authResult.error }, { status: authResult.status })

    const body = await request.json().catch(() => ({}))
    const { sheetUrl } = body

    if (!sheetUrl || typeof sheetUrl !== 'string') {
      return jsonNoStore({ error: '올바른 구글 시트 URL을 입력해주세요.' }, { status: 400 })
    }

    // 1. 시트 URL을 안정적인 CSV 주소로 변환
    const targetCsvUrl = getCsvUrl(sheetUrl)

    // 2. 캐시 무력화 타임스탬프 추가
    const cacheBustedUrl = targetCsvUrl.includes('?') 
      ? `${targetCsvUrl}&_t=${Date.now()}` 
      : `${targetCsvUrl}?_t=${Date.now()}`

    // 3. 구글 서버 요청 (AbortController를 이용한 8초 타임아웃 설정으로 무한 대기 방지)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 8000)

    let csvRes: Response
    try {
      csvRes = await fetch(cacheBustedUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
        cache: 'no-store',
        redirect: 'follow',
        signal: controller.signal,
      })
    } catch (fetchErr) {
      clearTimeout(timeoutId)
      return jsonNoStore({ 
        error: '구글 시트 응답 시간이 초과되었거나 연결할 수 없습니다. 링크 권한을 확인해주세요.' 
      }, { status: 400 })
    } finally {
      clearTimeout(timeoutId)
    }

    if (!csvRes.ok) {
      return jsonNoStore({ 
        error: '시트를 불러올 수 없습니다. 링크 공유 권한이 "링크가 있는 모든 사용자(보기 가능)"로 설정되어 있는지 확인해주세요.' 
      }, { status: 400 })
    }

    const csvText = await csvRes.text()

    // 4. 구글 로그인 페이지 등 HTML이 반환된 경우 차단
    if (csvText.trim().startsWith('<!DOCTYPE html>') || csvText.includes('<html')) {
      return jsonNoStore({ 
        error: '구글 시트가 올바르게 공개되지 않았거나 로그인이 필요합니다. 시트의 [파일] > [공유] > [웹에 게시] 링크를 사용해주세요.' 
      }, { status: 400 })
    }

    const rows = parseCSV(csvText)

    if (rows.length === 0) {
      return jsonNoStore({ error: '시트에 데이터가 없거나 읽을 수 없습니다.' }, { status: 400 })
    }

    // 5. 헤더 탐색 ('기수', '학번', '이름', '포인트')
    let headerRowIdx = -1
    let studentIdIdx = -1
    let nameIdx = -1
    let cohortIdx = -1
    let pointIdx = -1

    for (let r = 0; r < rows.length; r++) {
      const rowHeaders = rows[r].map(h => h.replace(/\s+/g, ''))

      const sIdx = rowHeaders.findIndex(h => h.includes('학번'))
      const nIdx = rowHeaders.findIndex(h => h.includes('이름') || h.includes('성명'))
      const cIdx = rowHeaders.findIndex(h => h.includes('기수') || h.includes('기'))
      const pIdx = rowHeaders.findIndex(h => h.includes('포인트') || h.includes('점수'))

      if (sIdx !== -1 && nIdx !== -1 && pIdx !== -1) {
        headerRowIdx = r
        studentIdIdx = sIdx
        nameIdx = nIdx
        cohortIdx = cIdx
        pointIdx = pIdx
        break
      }
    }

    if (headerRowIdx === -1) {
      return jsonNoStore({ 
        error: '필수 헤더(기수, 학번, 이름, 포인트)를 시트에서 찾지 못했습니다. 4행 근처의 열 제목을 확인해주세요.' 
      }, { status: 400 })
    }

    // DB profiles 가져오기
    const { data: profiles, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, student_id, full_name, cohort_no')

    if (profileError || !profiles) {
      return jsonNoStore({ error: '회원 프로필 목록을 조회하지 못했습니다.' }, { status: 500 })
    }

    let successCount = 0
    const errors: string[] = []
    const adminActorId = authResult.user?.id || null

    // 6. 데이터 행 순회 정산
    for (let i = headerRowIdx + 1; i < rows.length; i++) {
      const row = rows[i]
      const rawStudentId = row[studentIdIdx]?.trim()
      const rawFullName = row[nameIdx]?.trim()
      const rawCohort = cohortIdx !== -1 ? row[cohortIdx] : ''
      const rawPoint = row[pointIdx]

      if (!rawStudentId || rawPoint === undefined || rawPoint === '') continue

      const targetPoint = parseInt(rawPoint.replace(/[^0-9-]/g, ''), 10)
      if (isNaN(targetPoint)) {
        errors.push(`${i + 1}행: 포인트 숫자 형식 오류 (${rawPoint})`)
        continue
      }

      // 1차: 학번 매칭
      let user = profiles.find(p => p.student_id === rawStudentId)

      // 2차: 이름 + 기수 보완 매칭
      if (!user && rawFullName && rawCohort) {
        const cohortNo = parseInt(rawCohort.replace(/[^0-9]/g, ''), 10)
        if (!isNaN(cohortNo)) {
          user = profiles.find(p => p.full_name === rawFullName && p.cohort_no === cohortNo)
        }
      }

      if (!user) {
        errors.push(`${i + 1}행: 학번 [${rawStudentId}] 회원을 DB에서 찾을 수 없습니다.`)
        continue
      }

      // 현재 포인트 조회
      const { data: userPoint } = await supabaseAdmin
        .from('user_points')
        .select('current_points')
        .eq('user_id', user.id)
        .maybeSingle()

      const currentPoint = userPoint?.current_points ?? 0
      const diff = targetPoint - currentPoint

      if (diff === 0) {
        successCount++
        continue
      }

      // user_points 갱신
      const { error: updateError } = await supabaseAdmin
        .from('user_points')
        .upsert({
          user_id: user.id,
          current_points: targetPoint,
          updated_at: new Date().toISOString()
        })

      if (updateError) {
        errors.push(`${i + 1}행: ${user.full_name}(${rawStudentId}) DB 업데이트 실패`)
        continue
      }

      // point_logs 저장
      await supabaseAdmin.from('point_logs').insert({
        user_id: user.id,
        amount: Math.abs(diff),
        action: diff > 0 ? 'admin_adjust' : 'cancel',
        actor_id: adminActorId,
        reason: `구글 시트 일괄 동기화 (${currentPoint}P -> ${targetPoint}P)`,
        balance_after_action: targetPoint
      })

      successCount++
    }

    return jsonNoStore({
      success: true,
      message: `동기화 완료: 성공 ${successCount}건 / 실패 ${errors.length}건`,
      details: { errors }
    })
  } catch (err: any) {
    return jsonNoStore({ error: err.message || '서버 내부 오류가 발생했습니다.' }, { status: 500 })
  }
}