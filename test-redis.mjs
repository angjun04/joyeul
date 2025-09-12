// Redis 연결 테스트 스크립트
import { createClient } from 'redis';
import dotenv from 'dotenv';

// 환경 변수 로드
dotenv.config({ path: '.env.development.local' });
dotenv.config({ path: '.env.local' });

async function testRedisConnection() {
  console.log('🔍 Testing Redis Connection...\n');
  
  // 환경 변수 확인
  console.log('📋 Environment Variables:');
  console.log('- KV_URL:', process.env.KV_URL ? '✅ Set' : '❌ Not set');
  console.log('- KV_REST_API_URL:', process.env.KV_REST_API_URL ? '✅ Set' : '❌ Not set');
  console.log('- KV_REST_API_TOKEN:', process.env.KV_REST_API_TOKEN ? '✅ Set' : '❌ Not set');
  console.log('');

  if (!process.env.KV_URL) {
    console.error('❌ KV_URL environment variable is not set!');
    console.log('\n💡 Setup Instructions:');
    console.log('1. Run: vercel env pull .env.development.local');
    console.log('2. Or manually copy from Vercel Dashboard > Storage > KV > .env.local tab');
    process.exit(1);
  }

  let redis = null;

  try {
    // Redis 클라이언트 생성
    console.log('🔌 Connecting to Redis...');
    redis = createClient({
      url: process.env.KV_URL,
      socket: {
        connectTimeout: 5000
      }
    });

    // 에러 핸들러
    redis.on('error', (err) => console.error('Redis Client Error:', err));

    // Redis 연결
    await redis.connect();
    console.log('✅ Connected to Redis');

    // 테스트 1: Ping
    console.log('\n📝 Test 1: Ping');
    const pong = await redis.ping();
    console.log('✅ Ping response:', pong);

    // 테스트 2: 데이터 쓰기
    console.log('\n📝 Test 2: Writing test data');
    const testKey = 'test:connection';
    const testValue = { 
      message: 'Redis Connected Successfully!', 
      timestamp: new Date().toISOString(),
      nodeVersion: process.version
    };
    
    await redis.setEx(testKey, 60, JSON.stringify(testValue)); // 60초 후 만료
    console.log('✅ Write successful');

    // 테스트 3: 데이터 읽기
    console.log('\n📝 Test 3: Reading test data');
    const retrieved = await redis.get(testKey);
    if (retrieved) {
      const parsed = JSON.parse(retrieved);
      console.log('✅ Read successful:', parsed);
    }

    // 테스트 4: 키 존재 확인
    console.log('\n📝 Test 4: Checking key existence');
    const exists = await redis.exists(testKey);
    console.log('✅ Key exists:', exists === 1);

    // 테스트 5: TTL 확인
    console.log('\n📝 Test 5: Checking TTL');
    const ttl = await redis.ttl(testKey);
    console.log('✅ TTL remaining:', ttl, 'seconds');

    // 테스트 6: 방 데이터 시뮬레이션
    console.log('\n📝 Test 6: Simulating room data');
    const roomKey = 'room:DEMO1234';
    const roomData = {
      code: 'DEMO1234',
      createdAt: new Date().toISOString(),
      participants: {
        'user_1': {
          id: 'user_1',
          name: 'Demo User',
          schedule: {},
          joinedAt: new Date().toISOString()
        }
      },
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    };
    
    await redis.setEx(roomKey, 86400, JSON.stringify(roomData)); // 24시간 TTL
    console.log('✅ Room data saved');
    
    const savedRoom = await redis.get(roomKey);
    if (savedRoom) {
      console.log('✅ Room data retrieved successfully');
    }

    // 테스트 7: 패턴 검색
    console.log('\n📝 Test 7: Pattern search');
    const roomKeys = await redis.keys('room:*');
    console.log('✅ Found room keys:', roomKeys);

    // 테스트 8: 정리
    console.log('\n📝 Test 8: Cleanup');
    await redis.del(testKey);
    await redis.del(roomKey);
    console.log('✅ Test data deleted');

    // 연결 정보
    console.log('\n📊 Connection Info:');
    const info = await redis.info('server');
    const versionMatch = info.match(/redis_version:([^\r\n]+)/);
    if (versionMatch) {
      console.log('- Redis Version:', versionMatch[1]);
    }
    
    console.log('\n🎉 All tests passed! Redis is working correctly!');
    console.log('You can now use the application with Redis storage.');
    
  } catch (error) {
    console.error('\n❌ Redis Connection Error:', error);
    console.log('\n💡 Troubleshooting tips:');
    console.log('1. Check if your KV_URL is correct');
    console.log('2. Make sure your KV database is active in Vercel Dashboard');
    console.log('3. Try running: vercel env pull .env.development.local');
    console.log('4. Check your network connection');
    process.exit(1);
  } finally {
    // Redis 연결 종료
    if (redis) {
      await redis.quit();
      console.log('\n👋 Redis connection closed');
    }
  }
}

// 실행
testRedisConnection().catch(console.error);
