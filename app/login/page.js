//app/login/page.js

'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  //const [email, setEmail] = useState('')
  const [full_name, setFullName] = useState('') //이름추가
  const [student_id , setStudent_id] = useState('')// 학번추가
  const router = useRouter()
  const [error_messege , setErrorMessege] = useState('')


  /*
  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options:{
        //이메일 인증할때 메타데이터 [이름 , 기수 도 추가로 보냄]
        data: 
        {
          full_name: name,
          generation: parseInt(generation),
        }
      }
    })

    if (error) {
      alert('에러: ' + error.message)
    } else {
      alert('이메일 확인하세요! 📩')
    }
  }
*/


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
    
  
      setErrorMessege('입력하신 정보가 데이터베이스에 없습니다. 다시 확인해주세요.')
      return;
    }
    // 2. 자동 로그인을 위해 로컬 스토리지에 유저 정보 저장
    // (보안을 위해 실제 서비스에선 암호화하거나 서버 세션을 사용하지만, 
    // 구현 편의상 정보를 저장합니다.)
    localStorage.setItem('attendance_user', JSON.stringify(user))
    
    //alert(`${user.full_name}님, 환영합니다!`)
    router.push('/') // 메인 페이지로 이동
  
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

/*
  return (
    <div style={{ padding: 20 }}>
      <h2>회원가입</h2>
      <input placeholder='이름 입력' value={name} onChange={(e) => setName(e.target.value)}/>
      <input placeholder='기수 입력' type='number' value={generation} onChange={(e) => setGeneration(e.target.value)}/>
      <input
        placeholder="이메일 입력"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <button onClick={handleLogin}>인증 이메일 보내기</button>
    </div>
  )
    */

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