import { NextRequest, NextResponse } from 'next/server';
import { roomStorage } from '@/lib/storage';

function generateRoomCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function generateUserId(): string {
  return `user_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { creatorName } = body;

    if (!creatorName) {
      return NextResponse.json(
        { error: 'Creator name is required' },
        { status: 400 }
      );
    }

    // 고유한 방 코드 생성 (중복 확인)
    let roomCode = generateRoomCode();
    let attempts = 0;
    while (await roomStorage.roomExists(roomCode) && attempts < 10) {
      roomCode = generateRoomCode();
      attempts++;
    }

    const userId = generateUserId();
    const now = new Date().toISOString();

    const room = {
      code: roomCode,
      createdAt: now,
      participants: {
        [userId]: {
          id: userId,
          name: creatorName,
          schedule: {},
          joinedAt: now,
        },
      },
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString(),
    };

    await roomStorage.setRoom(roomCode, room);
    
    console.log('Room created:', { roomCode, userId, creatorName });

    return NextResponse.json({ room, userId }, { status: 201 });
  } catch (error) {
    console.error('Create room error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  // 디버깅용 - 현재 저장된 모든 방 코드 확인
  if (process.env.NODE_ENV === 'development') {
    // 메모리 저장소의 모든 키 확인
    console.log('Storage debugging info');
    return NextResponse.json({ 
      message: 'Room creation endpoint',
      usage: 'POST /api/rooms with { creatorName: string }',
      environment: {
        useKV: !!(process.env.KV_URL && process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN),
        nodeEnv: process.env.NODE_ENV
      }
    });
  }
  
  return NextResponse.json({ 
    message: 'Room creation endpoint',
    usage: 'POST /api/rooms with { creatorName: string }'
  });
}
