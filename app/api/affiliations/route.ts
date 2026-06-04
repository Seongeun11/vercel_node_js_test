//app\api\affiliations\route.ts

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin'; // 프로젝트 구조에 맞는 supabase 클라이언트 경로

//소속 목록 전체를 가져오는 API와, 특정 소속 ID(affiliation_id)를 조건으로 넘겨받아 해당 소속을 필터링하여 오늘 회차(또는 이벤트 현황) 리스트를 필터 조회하는 API 라우트를 개설 또는 수정합니다.


export async function GET() {
  try {
    // affiliations 테이블에서 id와 소속명(name)을 조회
    const { data, error } = await supabaseAdmin
      .from('affiliations')
      .select('id, name')
      .order('name', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('소속 목록 조회 오류:', error);
    return NextResponse.json({ success: false, error: '소속 목록을 불러오지 못했습니다.' }, { status: 500 });
  }
}