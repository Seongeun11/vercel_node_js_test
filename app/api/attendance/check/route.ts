// app/api/attendance/check/route.js
import { supabase } from '../../../../lib/supabaseClient'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { event_id ,user_id} = await request.json()
    console.log('받은 event_id:', event_id,'받은 user_id:',user_id) 
    
    /*
    // 로그인 사용자 가져오기
    // 1. 헤더에서 토큰 꺼내기
    const token = request.headers
      .get('authorization')
      ?.replace('Bearer ', '')

    // 2. 토큰으로 사용자 조회
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token)

    if (userError || !user) {
      return NextResponse.json({ error: '로그인 필요' }, { status: 401 })
    }

    const user_id = user.id
    console.log('받은 user_id:',user.id)
*/
    if (!user_id){
      return NextResponse.json({ error: 'user_id 없음' }, { status: 400 })
    }
/*
    const { 
      data: profiles} = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user_id)
      .single()

    console.log(`${profiles.generation}기 ${profiles.full_name}님 확인됨`)
*/
    // 2. 오늘 날짜
    const today = new Date().toISOString().split('T')[0]

    // 3. 이벤트 조회
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('*')
      .eq('id', event_id)
      .single()

    if (eventError || !event) {
      return NextResponse.json({ error: '이벤트 없음' }, { status: 400 })
    }

    const now = new Date()

    // 4. 지각 계산
    const startTime = new Date(event.start_time)
    const lateLimit = new Date(
      startTime.getTime() + event.late_threshold_min * 60000
    )

    const status = now > lateLimit ? 'late' : 'present'

    // 5. 출석 insert
    const { error: insertError } = await supabase
      .from('attendance')
      .insert({
        user_id,
        event_id,
        date: today,
        status,
        check_time: now.toISOString(),
        method: 'qr',
      })

    if (insertError) {
      if (insertError.code === '23505') {
        return NextResponse.json({
          error: '이미 출석하셨습니다.',
        })
      }

      return NextResponse.json(
        { error: insertError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      status,
      message: status === 'late' ? '지각입니다 ⏰' : '출석 완료 ✅',
    })
  } catch (err) {
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}