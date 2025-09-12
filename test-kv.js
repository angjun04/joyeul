// KV 연결 테스트 스크립트
import { kv } from '@vercel/kv';

async function testKVConnection() {
  console.log('🔍 Testing Vercel KV Connection...\n');
  
  // 환경 변수 확인
  console.log('📋 Environment Variables:');
  console.log('- KV_URL:', process.env.KV_URL ? '✅ Set' : '❌ Not set');
  console.log('- KV_REST_API_URL:', process.env.KV_REST_API_URL ? '✅ Set' : '❌ Not set');
  console.log('- KV_REST_API_TOKEN:', process.env.KV_REST_API_TOKEN ? '✅ Set' : '❌ Not set');
  console.log('');

  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    console.error('❌ KV environment variables are not set!');
    console.log('Please copy the environment variables from Vercel Dashboard.');
    process.exit(1);
  }

  try {
    // 테스트 데이터 쓰기
    console.log('📝 Writing test data...');
    const testKey = 'test:connection';
    const testValue = { 
      message: 'KV Connected Successfully!', 
      timestamp: new Date().toISOString() 
    };
    
    await kv.set(testKey, testValue, { ex: 60 }); // 60초 후 만료
    console.log('✅ Write successful');

    // 테스트 데이터 읽기
    console.log('\n📖 Reading test data...');
    const retrieved = await kv.get(testKey);
    console.log('✅ Read successful:', retrieved);

    // 키 존재 확인
    console.log('\n🔍 Checking key existence...');
    const exists = await kv.exists(testKey);
    console.log('✅ Key exists:', exists === 1);

    // 테스트 데이터 삭제
    console.log('\n🗑️ Deleting test data...');
    await kv.del(testKey);
    console.log('✅ Delete successful');

    console.log('\n🎉 Vercel KV is working correctly!');
    console.log('You can now use the application with Redis storage.');
    
  } catch (error) {
    console.error('\n❌ KV Connection Error:', error);
    console.log('\n💡 Troubleshooting tips:');
    console.log('1. Check if your environment variables are correct');
    console.log('2. Make sure your KV database is active in Vercel Dashboard');
    console.log('3. Verify your network connection');
    process.exit(1);
  }
}

// 실행
testKVConnection();
