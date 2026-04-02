'use client'
//app/login/page.js
import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter, useSearchParams } from 'next/navigation'

export default function LoginPage() {
  //const [email, setEmail] = useState('')
  const [full_name, setFullName] = useState('') //이름추가
  const [student_id , setStudent_id] = useState('')// 학번추가
  const [error_messege , setErrorMessege] = useState('')
  
  const router = useRouter()
  const searchParams = useSearchParams()

  /**
   * next 파라미터가 내부 경로인지 검증
   * - 외부 URL 리다이렉트 방지
   */
  const getSafeRedirectPath = (next) => {
    if (!next) return '/'
    if (!next.startsWith('/')) return '/'
    if (next.startsWith('//')) return '/'
    return next
  }


  const handleLogin = async () => {
    setErrorMessege('')

    if (!full_name.trim() || !student_id.trim()) {
      setErrorMessege('이름과 학번을 모두 입력해주세요.')
      return
    }
    const { data:user, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('full_name', full_name)
    .eq('student_id', student_id )
    .single();


    setErrorMessege('')
    
    if (error || !user) {
    
  
      setErrorMessege('사용자 정보를 찾을 수 없습니다. 다시 확인해주세요.')
      return;
    }
    // 2. 자동 로그인을 위해 로컬 스토리지에 유저 정보 저장
    // (보안을 위해 실제 서비스에선 암호화하거나 서버 세션을 사용하지만, 
    // 구현 편의상 정보를 저장합니다.)
    /**
     * 로그인 정보 저장
     * scan 페이지의 getStoredUser()와 키 이름이 반드시 같아야 함
     */
    localStorage.setItem('attendance_user', JSON.stringify(user))
    
    /**
     * 로그인 전 들어오려던 페이지 복원
     * 예: /attendance/scan?token=...
     */
    const next = searchParams.get('next')
    const redirectPath = getSafeRedirectPath(next)

    //alert(`${user.full_name}님, 환영합니다!`)
    
console.log('next =', next)
console.log('redirectPath =', redirectPath)

    router.replace(redirectPath)
    //router.push('/') // 메인 페이지로 이동
  
  }
  const fullName_handleChange = (e) => {
    // 문자만 남기고 나머지 제거
    const onlyText = e.target.value.replace(/[^ㄱ-ㅎㅏ-ㅣ가-힣a-zA-Z]/g, '');
    setFullName(onlyText);
    
    if (error_messege) setErrorMessege(''); // 다시 타이핑하면 에러 숨기기
  };
  const handleChange = (e) => {
    // 숫자만 남기고 나머지 제거
    const result = e.target.value.replace(/[^0-9]/g, '');
    setStudent_id(result);
    if (error_messege) setErrorMessege(''); // 다시 타이핑하면 에러 숨기기
  };


  return (
    <div style={{ padding: 20 }}>
      <h2>출석 로그인</h2>
      <input 
      style={{margin:'10px'}}
      placeholder="이름" type='text' value={full_name} onChange={fullName_handleChange} />
      <input placeholder="학번" type='text' value={student_id} onChange={handleChange}/>
      <button 
        onClick={handleLogin}
        style={{ padding: '10px',margin:'10px', borderRadius: '5px', backgroundColor: '#0070f3', color: 'white', border: 'none', cursor: 'pointer' }}
      >
        로그인
      </button>


      {/* 🚀 에러 메시지 표시 영역 */}
      {error_messege && (
        <p style={{ 
          color: '#ff4d4f', 
          fontSize: '13px', 
          margin: '0', 
          fontWeight: '500' 
        }}>
          ⚠️ {error_messege}
        </p>
      )}
    </div>
  )
}