import { NextResponse } from 'next/server';
import { roomStorage } from '@/lib/storage';
import { testRedisConnection, isRedisConnected } from '@/lib/redis-client';

export async function GET() {
  // 디버깅 엔드포인트 - 개발 환경에서만 사용
  try {
    // Redis 연결 테스트
    const redisTest = await testRedisConnection();
    
    // 현재 저장된 모든 방 코드 확인
    const allRoomCodes = await roomStorage.getAllRoomCodes();
    
    // 테스트 방이 있는지 확인
    const testRoomCode = 'TEST1234';
    let testRoom = await roomStorage.getRoom(testRoomCode);
    
    if (!testRoom) {
      // 테스트 방 생성
      const now = new Date().toISOString();
      testRoom = {
        code: testRoomCode,
        createdAt: now,
        participants: {
          'test_user_1': {
            id: 'test_user_1',
            name: 'Test User',
            schedule: {},
            joinedAt: now,
          },
        },
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString(),
      };
      
      await roomStorage.setRoom(testRoomCode, testRoom);
      console.log('Test room created:', testRoomCode);
    }
    
    // 각 방의 상세 정보 수집
    const roomDetails = await Promise.all(
      allRoomCodes.map(async (code) => {
        const room = await roomStorage.getRoom(code);
        return {
          code,
          exists: !!room,
          participantCount: room ? Object.keys(room.participants || {}).length : 0,
          createdAt: room?.createdAt
        };
      })
    );
    
    return NextResponse.json({ 
      message: 'Debug endpoint',
      redis: {
        configured: !!process.env.KV_URL,
        connected: isRedisConnected(),
        testResult: redisTest,
        connectionString: process.env.KV_URL ? '✅ Set' : '❌ Not set',
      },
      storage: {
        type: isRedisConnected() ? 'Redis (node-redis)' : 'Memory (Global)',
        environment: process.env.NODE_ENV,
        totalRooms: allRoomCodes.length,
        envVars: {
          KV_URL: !!process.env.KV_URL,
          KV_REST_API_URL: !!process.env.KV_REST_API_URL,
          KV_REST_API_TOKEN: !!process.env.KV_REST_API_TOKEN
        }
      },
      testRoom: {
        code: testRoomCode,
        exists: !!testRoom,
        participantCount: testRoom ? Object.keys(testRoom.participants || {}).length : 0,
        url: `/api/rooms/${testRoomCode}`
      },
      allRooms: roomDetails,
      timestamp: new Date().toISOString(),
      instructions: {
        createRoom: 'POST /api/rooms with { creatorName: "Your Name" }',
        joinRoom: 'POST /api/rooms/[CODE]/join with { name: "Your Name" }',
        updateSchedule: 'PUT /api/rooms/[CODE]/schedule with { userId, schedule }',
        getRoom: 'GET /api/rooms/[CODE]'
      }
    }, { 
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      }
    });
  } catch (error) {
    console.error('Debug endpoint error:', error);
    return NextResponse.json({ 
      error: 'Debug error', 
      details: String(error),
      stack: error instanceof Error ? error.stack : undefined 
    }, { status: 500 });
  }
}
