import { Client } from '@notionhq/client'

// 60초간 캐시 유지
export const revalidate = 60

const notion = new Client({
  auth: process.env.NOTION_TOKEN,
})

// 💡 32자리 Pure ID 추출 정제 함수
function extractNotionDatabaseId(rawInput: string | undefined, envName: string): string {
  if (!rawInput) {
    throw new Error(`[환경변수 미설정] ${envName} 값이 존재하지 않습니다.`)
  }

  let cleaned = rawInput.split('?')[0].split('/').pop() || ''
  cleaned = cleaned.replace(/-/g, '')

  const match = cleaned.match(/[a-f0-9]{32}/i)
  if (!match) {
    throw new Error(
      `[ID 정제 실패] ${envName}에서 유효한 32자리 노션 DB ID를 추출할 수 없습니다. (입력값: "${rawInput}")`
    )
  }

  return match[0]
}

// 노션 Property 파싱 도우미 함수
function parseNotionProperty(prop: any) {
  if (!prop) return null

  switch (prop.type) {
    case 'title':
      return prop.title?.map((t: any) => t.plain_text).join('') || ''
    case 'rich_text':
      return prop.rich_text?.map((t: any) => t.plain_text).join('') || ''
    case 'number':
      return prop.number ?? null
    case 'select':
      return prop.select?.name || null
    case 'multi_select':
      return prop.multi_select?.map((s: any) => s.name) || []
    case 'date':
      return prop.date ? { start: prop.date.start, end: prop.date.end } : null
    case 'checkbox':
      return prop.checkbox
    case 'url':
      return prop.url || null
    case 'email':
      return prop.email || null
    case 'phone_number':
      return prop.phone_number || null
    case 'status':
      return prop.status?.name || null
    case 'formula':
      return prop.formula?.string || prop.formula?.number || prop.formula?.boolean || null
    case 'relation':
      return prop.relation?.map((r: any) => r.id) || []
    case 'created_time':
      return prop.created_time
    case 'last_edited_time':
      return prop.last_edited_time
    default:
      return '[Unparsed Property]'
  }
}

// 단일 DB의 모든 페이지 조회 (페이지네이션)
async function fetchSingleDatabase(rawDbId: string | undefined, envName: string) {
  try {
    const databaseId = extractNotionDatabaseId(rawDbId, envName)
    const allResults: any[] = []
    let hasMore = true
    let startCursor: string | undefined = undefined

    while (hasMore) {
      const response = (await notion.request({
        path: `databases/${databaseId}/query`,
        method: 'post',
        body: {
          start_cursor: startCursor,
          page_size: 100,
        },
      })) as {
        results: any[]
        has_more: boolean
        next_cursor: string | null
      }

      allResults.push(...response.results)
      hasMore = response.has_more
      startCursor = response.next_cursor ?? undefined
    }

    const items = allResults.map((page: any) => {
      const properties = page.properties || {}
      const parsedProperties: Record<string, any> = {}

      Object.keys(properties).forEach((key) => {
        parsedProperties[key] = parseNotionProperty(properties[key])
      })

      return {
        page_id: page.id,
        created_time: page.created_time,
        url: page.url,
        properties: parsedProperties,
      }
    })

    return {
      success: true,
      total_count: items.length,
      items,
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || '데이터를 불러오는 중 에러가 발생했습니다.',
      items: [],
      total_count: 0,
    }
  }
}

// 4개의 노션 DB 병렬 페칭
async function fetchAllNotionDatabases() {
  if (!process.env.NOTION_TOKEN) {
    throw new Error('NOTION_TOKEN 환경변수가 설정되지 않았습니다.')
  }

  // Promise.all로 3개 DB 동시 요청
  const [memberDb, attendanceDb, attendanceRawDb] = await Promise.all([
    fetchSingleDatabase(process.env.NOTION_MEMBER_DB_ID, 'NOTION_MEMBER_DB_ID'),
    fetchSingleDatabase(process.env.NOTION_ATTENDANCE_DB_ID, 'NOTION_ATTENDANCE_DB_ID'),
    fetchSingleDatabase(process.env.NOTION_ATTENDANCE_RAW_DB_ID, 'NOTION_ATTENDANCE_RAW_DB_ID'),
  ])

  return {
    member: memberDb,
    attendance: attendanceDb,
    attendance_raw: attendanceRawDb,
  }
}

export default async function NotionMultiJsonPage() {
  try {
    const data = await fetchAllNotionDatabases()

    return (
      <main className="min-h-screen bg-gray-950 text-gray-100 p-6 md:p-10 font-mono">
        <div className="max-w-6xl mx-auto space-y-8">
          <header className="border-b border-gray-800 pb-4">
            <h1 className="text-2xl font-bold text-emerald-400">⚡ Multi Notion DB JSON Viewer</h1>
            <p className="text-xs text-gray-400 mt-1">
              Member / Attendance / Attendance Raw DB 통합 조회 결과
            </p>
          </header>

          {/* 1. MEMBER DB */}
          <section className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
            <div className="flex justify-between items-center">
              <h2 className="text-base font-semibold text-blue-400">
                1. 회원 DB (NOTION_MEMBER_DB_ID)
              </h2>
              <span className="text-xs bg-blue-950 text-blue-300 px-2.5 py-1 rounded-full border border-blue-800">
                건수: {data.member.total_count}건
              </span>
            </div>
            {data.member.success ? (
              <pre className="bg-black/60 p-4 rounded-lg text-xs text-blue-200 overflow-x-auto max-h-80 border border-gray-800/80">
                {JSON.stringify(data.member.items, null, 2)}
              </pre>
            ) : (
              <p className="text-xs text-red-400 bg-red-950/40 p-3 rounded border border-red-900">
                ❌ 에러: {data.member.error}
              </p>
            )}
          </section>

          {/* 2. ATTENDANCE DB */}
          <section className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
            <div className="flex justify-between items-center">
              <h2 className="text-base font-semibold text-green-400">
                2. 출석 DB (NOTION_ATTENDANCE_DB_ID)
              </h2>
              <span className="text-xs bg-green-950 text-green-300 px-2.5 py-1 rounded-full border border-green-800">
                건수: {data.attendance.total_count}건
              </span>
            </div>
            {data.attendance.success ? (
              <pre className="bg-black/60 p-4 rounded-lg text-xs text-green-200 overflow-x-auto max-h-80 border border-gray-800/80">
                {JSON.stringify(data.attendance.items, null, 2)}
              </pre>
            ) : (
              <p className="text-xs text-red-400 bg-red-950/40 p-3 rounded border border-red-900">
                ❌ 에러: {data.attendance.error}
              </p>
            )}
          </section>

          {/* 3. ATTENDANCE RAW DB */}
          <section className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
            <div className="flex justify-between items-center">
              <h2 className="text-base font-semibold text-amber-400">
                3. 출석 Raw DB (NOTION_ATTENDANCE_RAW_DB_ID)
              </h2>
              <span className="text-xs bg-amber-950 text-amber-300 px-2.5 py-1 rounded-full border border-amber-800">
                건수: {data.attendance_raw.total_count}건
              </span>
            </div>
            {data.attendance_raw.success ? (
              <pre className="bg-black/60 p-4 rounded-lg text-xs text-amber-200 overflow-x-auto max-h-80 border border-gray-800/80">
                {JSON.stringify(data.attendance_raw.items, null, 2)}
              </pre>
            ) : (
              <p className="text-xs text-red-400 bg-red-950/40 p-3 rounded border border-red-900">
                ❌ 에러: {data.attendance_raw.error}
              </p>
            )}
          </section>
        </div>
      </main>
    )
  } catch (error: any) {
    return (
      <main className="min-h-screen bg-gray-950 text-red-400 p-10 font-mono flex items-center justify-center">
        <div className="bg-red-950/50 border border-red-800 p-6 rounded-lg max-w-xl w-full">
          <h1 className="text-lg font-bold mb-2">❌ Notion Integrated Fetch Error</h1>
          <p className="text-sm text-red-200 bg-black/40 p-3 rounded">
            {error.message || '치명적인 서버 오류가 발생했습니다.'}
          </p>
        </div>
      </main>
    )
  }
}