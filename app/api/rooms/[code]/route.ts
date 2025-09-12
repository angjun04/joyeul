import { NextRequest, NextResponse } from 'next/server';
import { roomStorage } from '@/lib/storage';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    console.log('Fetching room with code:', code, 'uppercase:', code.toUpperCase());
    
    const room = await roomStorage.getRoom(code.toUpperCase());
    console.log('Room found:', !!room);

    if (!room) {
      console.log('Room not found for code:', code.toUpperCase());
      return NextResponse.json(
        { error: 'Room not found' },
        { status: 404 }
      );
    }

    // Ensure room has proper structure
    if (!room.participants) {
      room.participants = {};
    }

    return NextResponse.json(room);
  } catch (error) {
    console.error('Get room error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
