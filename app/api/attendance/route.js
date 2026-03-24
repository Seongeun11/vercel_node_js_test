// app/api/attendance/route.js
import { supabase } from '@/lib/supabaseClient'
import { NextResponse } from 'next/server'

export async function POST(request) {
  const { name, number } = await request.json()
  // 2. 값이 제대로 들어왔는지 로그로 확인 (VS Code 터미널에 찍힘)
  console.log("받은 데이터:", name, user_id_number);
  const Table_Name ='test_table_1'
  // Supabase에 데이터 삽입
  const { data, error } = await supabase
    .from('test_table_1') // 생성하신 테이블 이름
    .insert([
      { user_name: name, // Supa SQL 컬럼 user_name
         user_id_number: number // Supa SQL 컬럼 user_id_number
        }
    ])

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ message: '출석 기록 완료!', data }, { status: 200 })
}