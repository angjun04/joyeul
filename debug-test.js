// 디버깅용 테스트 스크립트
// 브라우저 콘솔에서 실행하여 오류 상황을 재현할 수 있습니다.

// 1. 방 생성 테스트
async function testCreateRoom() {
  const response = await fetch('/api/rooms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ creatorName: 'Test User' })
  });
  const data = await response.json();
  console.log('Created room:', data);
  return data;
}

// 2. 방 정보 조회 테스트
async function testGetRoom(code) {
  const response = await fetch(`/api/rooms/${code}`);
  const data = await response.json();
  console.log('Room data:', data);
  return data;
}

// 3. 방 참여 테스트
async function testJoinRoom(code, userName) {
  const response = await fetch(`/api/rooms/${code}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: userName })
  });
  const data = await response.json();
  console.log('Join result:', data);
  return data;
}

// 4. 일정 업데이트 테스트
async function testUpdateSchedule(code, userId, schedule) {
  const response = await fetch(`/api/rooms/${code}/schedule`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, schedule })
  });
  const data = await response.json();
  console.log('Update result:', data);
  return data;
}

// 전체 플로우 테스트
async function runFullTest() {
  console.log('=== Starting full test ===');
  
  // 1. 방 생성
  const createResult = await testCreateRoom();
  if (!createResult.room) {
    console.error('Failed to create room');
    return;
  }
  
  const roomCode = createResult.room.code;
  const firstUserId = createResult.userId;
  
  // 2. 방 조회
  await testGetRoom(roomCode);
  
  // 3. 다른 사용자 참여
  await testJoinRoom(roomCode, 'Another User');
  
  // 4. 일정 업데이트
  const schedule = {
    '2025-01-16_14': true,
    '2025-01-16_15': true
  };
  await testUpdateSchedule(roomCode, firstUserId, schedule);
  
  // 5. 최종 상태 확인
  const finalRoom = await testGetRoom(roomCode);
  console.log('Final room state:', finalRoom);
  
  console.log('=== Test completed ===');
}

// 사용 예:
// runFullTest();
