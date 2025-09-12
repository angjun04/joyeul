import { NextResponse } from 'next/server';
import { roomStorage } from '@/lib/storage';

export async function GET() {
  // 디버깅 엔드포인트 - 개발 환경에서만 사용
  try {
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
      storage: {
        type: process.env.KV_URL ? 'Vercel KV' : 'Memory (Global)',
        environment: process.env.NODE_ENV,
        totalRooms: allRoomCodes.length
      },
      testRoom: {
        code: testRoomCode,
        exists: !!testRoom,
        participantCount: testRoom ? Object.keys(testRoom.participants || {}).length : 0
      },
      allRooms: roomDetails,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Debug endpoint error:', error);
    return NextResponse.json({ error: 'Debug error', details: String(error) }, { status: 500 });
  }
}
