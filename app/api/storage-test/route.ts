import { NextResponse } from 'next/server';
import { roomStorage, getStorageStatus } from '@/lib/storage';

export async function GET() {
  try {
    // 스토리지 상태 가져오기
    const storageStatus = await getStorageStatus();
    
    // 현재 저장된 모든 방 코드 가져오기
    const roomCodes = await roomStorage.getAllRoomCodes();
    
    // 각 방의 상세 정보 가져오기 (최대 5개만)
    const rooms = await Promise.all(
      roomCodes.slice(0, 5).map(async (code) => {
        const room = await roomStorage.getRoom(code);
        return {
          code,
          participantCount: room ? Object.keys(room.participants || {}).length : 0,
          createdAt: room?.createdAt,
          startDate: room?.startDate,
          endDate: room?.endDate
        };
      })
    );

    return NextResponse.json({
      storage: storageStatus,
      rooms: {
        total: roomCodes.length,
        codes: roomCodes,
        details: rooms
      },
      ttl: {
        days: 7,
        seconds: 604800,
        description: '방은 생성 후 7일 뒤에 자동으로 삭제됩니다.'
      },
      redis: {
        connected: storageStatus.redisConnected,
        host: storageStatus.environment.kvUrlHost,
        tip: !storageStatus.redisConnected ? 
          'Redis에 연결되지 않았습니다. 메모리 저장소를 사용 중입니다. (서버 재시작 시 데이터 소실)' :
          'Redis Cloud에 정상적으로 연결되어 있습니다.'
      }
    }, { status: 200 });
  } catch (error) {
    console.error('Storage test error:', error);
    return NextResponse.json(
      { error: 'Storage test failed', details: String(error) },
      { status: 500 }
    );
  }
}