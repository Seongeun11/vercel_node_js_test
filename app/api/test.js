 // api/test.js

module.exports = (req, res) => {

  // 현재 시간과 접속 정보를 포함한 JSON 응답

  const currentTime = new Date().toLocaleString();

 

  res.status(200).json({

    status: "success",

    message: "Vercel 서버가 정상적으로 작동 중입니다!",

    time: currentTime,

    env: process.env.NODE_ENV, // 현재 환경 (development 또는 production)

    platform: "Vercel Serverless Function"

  });

}; 