import { NextRequest, NextResponse } from 'next/server';
import { roomStorage } from '@/lib/storage';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const body = await request.json();
    const { userId, schedule } = body;

    if (!userId || schedule === undefined) {
      return NextResponse.json(
        { error: 'userId and schedule are required' },
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

    if (!room.participants[userId]) {
      return NextResponse.json(
        { error: 'User not found in room' },
        { status: 404 }
      );
    }

    // Update user's schedule
    room.participants[userId].schedule = schedule;
    await roomStorage.setRoom(code.toUpperCase(), room);

    return NextResponse.json({ success: true, room });
  } catch (error) {
    console.error('Update schedule error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
