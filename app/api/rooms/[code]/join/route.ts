import { NextRequest, NextResponse } from 'next/server';
import { roomStorage } from '@/lib/storage';

interface Participant {
  id: string;
  name: string;
  schedule: Record<string, boolean>;
  joinedAt: string;
}

function generateUserId(): string {
  return `user_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const body = await request.json();
    const { name } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    const room = await roomStorage.getRoom(code.toUpperCase());

    if (!room) {
      return NextResponse.json(
        { error: 'Room not found' },
        { status: 404 }
      );
    }

    // Ensure participants object exists
    if (!room.participants) {
      room.participants = {};
    }

    // Check if user already exists
    const existingUser = Object.values(room.participants).find(
      (p: Participant) => p.name === name
    );

    if (existingUser) {
      return NextResponse.json({ room, userId: existingUser.id });
    }

    // Add new participant
    const userId = generateUserId();
    const now = new Date().toISOString();

    room.participants[userId] = {
      id: userId,
      name,
      schedule: {},
      joinedAt: now,
    };

    await roomStorage.setRoom(code.toUpperCase(), room);

    return NextResponse.json({ room, userId }, { status: 201 });
  } catch (error) {
    console.error('Join room error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
