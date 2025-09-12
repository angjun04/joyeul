'use client';

import React, { useState, useEffect } from 'react';
import useSWR from 'swr';

const DEFAULT_START_HOUR = 9;
const DEFAULT_END_HOUR = 22;

interface Participant {
  id: string;
  name: string;
  schedule: Record<string, boolean>;
  joinedAt: string;
}

interface Room {
  code: string;
  createdAt: string;
  participants: Record<string, Participant>;
  startDate: string;
  endDate: string;
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP error! status: ${res.status}`);
  }
  const data = await res.json();
  // Ensure participants exists
  if (data && !data.participants) {
    data.participants = {};
  }
  return data;
};

export default function Home() {
  const [roomCode, setRoomCode] = useState('');
  const [userName, setUserName] = useState('');
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [viewMode, setViewMode] = useState<'edit' | 'view'>('edit');
  const [loginError, setLoginError] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Use SWR for real-time room updates
  const { data: roomData, mutate } = useSWR(
    currentRoom ? `/api/rooms/${currentRoom.code}` : null,
    fetcher,
    { 
      refreshInterval: 3000, // Poll every 3 seconds
      onError: (err) => {
        console.error('SWR Error:', err);
      }
    }
  );

  useEffect(() => {
    if (roomData && currentRoom) {
      console.log('Room data updated:', roomData);
      // Ensure the data has proper structure before updating
      if (roomData.code && roomData.participants !== undefined) {
        setCurrentRoom(roomData);
      }
    }
  }, [roomData]); // currentRoom?.code로 충분

  const createNewRoom = async () => {
    if (!userName.trim()) {
      setLoginError('이름을 입력해주세요.');
      return;
    }

    setIsCreating(true);
    try {
      const response = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creatorName: userName }),
      });

      if (!response.ok) throw new Error('Failed to create room');

      const data = await response.json();
      console.log('Room created:', data);
      setCurrentRoom(data.room);
      setCurrentUserId(data.userId);
      setRoomCode(data.room.code);
      setLoginError(''); // Clear any previous errors
      
      // 방 코드를 클립보드에 복사
      if (navigator.clipboard) {
        try {
          await navigator.clipboard.writeText(data.room.code);
          console.log('Room code copied to clipboard:', data.room.code);
          setSuccessMessage(`방이 생성되었습니다! 코드: ${data.room.code} (클립보드에 복사됨)`);
        } catch (err) {
          console.error('Failed to copy room code:', err);
          setSuccessMessage(`방이 생성되었습니다! 코드: ${data.room.code}`);
        }
      } else {
        setSuccessMessage(`방이 생성되었습니다! 코드: ${data.room.code}`);
      }
      
      // 3초 후 성공 메시지 제거
      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
    } catch (error) {
      console.error('Create room error:', error);
      setLoginError('방 생성에 실패했습니다.');
    } finally {
      setIsCreating(false);
    }
  };

  const joinRoom = async () => {
    if (!roomCode.trim() || !userName.trim()) {
      setLoginError('방 코드와 이름을 모두 입력해주세요.');
      return;
    }

    console.log('Joining room with code:', roomCode.toUpperCase());

    try {
      const response = await fetch(`/api/rooms/${roomCode.toUpperCase()}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: userName }),
      });

      if (!response.ok) {
        if (response.status === 404) {
          setLoginError('존재하지 않는 방 코드입니다.');
          return;
        }
        throw new Error('Failed to join room');
      }

      const data = await response.json();
      console.log('Joined room:', data);
      setCurrentRoom(data.room);
      setCurrentUserId(data.userId);
      setLoginError(''); // Clear any previous errors
    } catch (error) {
      console.error('Join room error:', error);
      setLoginError('방 참여에 실패했습니다.');
    }
  };

  const toggleTimeSlot = async (slotKey: string) => {
    if (!currentRoom || viewMode !== 'edit' || !currentRoom.participants) return;

    const participant = currentRoom.participants[currentUserId];
    if (!participant) return;

    const newSchedule = { ...participant.schedule };
    if (newSchedule[slotKey]) {
      delete newSchedule[slotKey];
    } else {
      newSchedule[slotKey] = true;
    }

    try {
      await fetch(`/api/rooms/${currentRoom.code}/schedule`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUserId,
          schedule: newSchedule,
        }),
      });

      mutate(); // Trigger SWR revalidation
    } catch (error) {
      console.error('Failed to update schedule:', error);
    }
  };

  const leaveRoom = () => {
    setCurrentRoom(null);
    setCurrentUserId('');
    setRoomCode('');
    setUserName('');
    setViewMode('edit');
    setLoginError('');
    setSuccessMessage('');
  };

  const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getDaysInRange = (): Date[] => {
    if (!currentRoom) return [];
    const days: Date[] = [];
    const current = new Date(currentRoom.startDate);
    const end = new Date(currentRoom.endDate);

    while (current <= end) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    return days;
  };

  const calculateSlotAvailability = (slotKey: string) => {
    if (!currentRoom || !currentRoom.participants) return { count: 0, participants: [] as Participant[] };

    const available: Participant[] = [];
    Object.values(currentRoom.participants).forEach(participant => {
      if (participant.schedule && participant.schedule[slotKey]) {
        available.push(participant);
      }
    });

    return { count: available.length, participants: available };
  };

  const findBestTimes = () => {
    if (!currentRoom) return [];

    interface TimeSlot {
      date: Date;
      hour: number;
      slotKey: string;
      availability: {
        count: number;
        participants: Participant[];
      };
    }

    const timeSlots: TimeSlot[] = [];
    const days = getDaysInRange();

    days.forEach(day => {
      for (let hour = DEFAULT_START_HOUR; hour < DEFAULT_END_HOUR; hour++) {
        const slotKey = `${formatDate(day)}_${hour}`;
        const availability = calculateSlotAvailability(slotKey);

        if (availability.count > 0) {
          timeSlots.push({
            date: day,
            hour,
            slotKey,
            availability,
          });
        }
      }
    });

    return timeSlots.sort((a, b) => b.availability.count - a.availability.count).slice(0, 5);
  };

  if (!currentRoom) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 p-10">
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-50 rounded-2xl mb-4">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">일정 조율</h1>
            <p className="text-gray-500 mt-2">팀원들과 함께 최적의 시간을 찾아보세요</p>
          </div>

          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                이름
              </label>
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="이름을 입력해주세요"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                방 코드 <span className="font-normal text-gray-400 text-xs">(참여하는 경우)</span>
              </label>
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all uppercase font-mono"
                placeholder="예: TEAM2024"
                maxLength={10}
              />
            </div>

            {successMessage && (
              <div className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-lg text-sm flex items-start">
                <svg className="w-5 h-5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                {successMessage}
              </div>
            )}

            {loginError && (
              <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-lg text-sm flex items-start">
                <svg className="w-5 h-5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                {loginError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 pt-4">
              <button
                onClick={createNewRoom}
                disabled={isCreating}
                className="px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 hover:border-gray-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                새 방 만들기
              </button>
              <button
                onClick={joinRoom}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-all shadow-sm hover:shadow-md"
              >
                참여하기
              </button>
            </div>
            
            {process.env.NODE_ENV === 'development' && (
              <div className="mt-6 pt-6 border-t border-gray-200 text-center text-xs text-gray-400">
                <a 
                  href="/api/rooms/debug" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="hover:text-gray-600 underline"
                >
                  디버그 페이지
                </a>
                <span className="mx-2">•</span>
                <span>테스트 방: TEST1234</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const days = getDaysInRange();
  const currentUser = currentRoom.participants?.[currentUserId];
  const totalParticipants = Object.keys(currentRoom.participants || {}).length;
  const bestTimes = findBestTimes();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center mr-3">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-gray-900">일정 조율</h1>
                  <p className="text-sm text-gray-500">방 코드: <span className="font-mono font-medium text-gray-900">{currentRoom.code}</span></p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="px-4 py-2 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-600">참여자:</span>
                <span className="ml-2 font-medium text-gray-900">{currentUser?.name}</span>
              </div>
              <button
                onClick={leaveRoom}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                나가기
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        {/* View Mode Toggle */}
        <div className="flex gap-1 p-1 bg-gray-100 rounded-lg mb-8 inline-flex">
          <button
            onClick={() => setViewMode('edit')}
            className={`px-6 py-2.5 rounded-md font-medium text-sm transition-all ${
              viewMode === 'edit'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            내 일정 편집
          </button>
          <button
            onClick={() => setViewMode('view')}
            className={`px-6 py-2.5 rounded-md font-medium text-sm transition-all ${
              viewMode === 'view'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            전체 일정 보기
          </button>
        </div>

        {/* Participants */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">참여자 ({totalParticipants}명)</h3>
          <div className="flex flex-wrap gap-2">
            {currentRoom.participants && Object.values(currentRoom.participants).map((participant) => (
              <span
                key={participant.id}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                  participant.id === currentUserId
                    ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-500 ring-offset-2'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                {participant.name}
              </span>
            ))}
          </div>
        </div>

        {/* Schedule Grid */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8 overflow-x-auto">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">
            {viewMode === 'edit' ? '내 가능한 시간 선택하기' : '전체 참여자 일정'}
          </h3>
          
          {/* Legend */}
          <div className="flex flex-wrap gap-6 mb-6 pb-6 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-gray-100 rounded border border-gray-300"></div>
              <span className="text-sm text-gray-600">선택 안됨</span>
            </div>
            {viewMode === 'edit' && (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-blue-600 rounded"></div>
                <span className="text-sm text-gray-600">선택됨</span>
              </div>
            )}
            {viewMode === 'view' && (
              <>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-amber-500 rounded"></div>
                  <span className="text-sm text-gray-600">일부 가능</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-green-500 rounded"></div>
                  <span className="text-sm text-gray-600">전원 가능</span>
                </div>
              </>
            )}
          </div>
          
          <div className="grid grid-cols-[80px_repeat(var(--days-count),_minmax(100px,_1fr))] gap-0.5 min-w-[600px]" style={{ '--days-count': days.length } as React.CSSProperties}>
            {/* Header */}
            <div className="bg-gray-50 p-3 text-center font-medium text-sm text-gray-700 rounded-tl-lg">시간</div>
            {days.map((day, index) => (
              <div key={day.toISOString()} className={`bg-gray-50 p-3 text-center font-medium text-sm text-gray-700 ${index === days.length - 1 ? 'rounded-tr-lg' : ''}`}>
                {day.getMonth() + 1}/{day.getDate()}<br />
                <span className="text-xs text-gray-500">
                  {['일', '월', '화', '수', '목', '금', '토'][day.getDay()]}
                </span>
              </div>
            ))}

            {/* Time Slots */}
            {Array.from({ length: DEFAULT_END_HOUR - DEFAULT_START_HOUR }, (_, i) => {
              const hour = DEFAULT_START_HOUR + i;
              const isLastRow = i === DEFAULT_END_HOUR - DEFAULT_START_HOUR - 1;
              return (
                <React.Fragment key={hour}>
                  <div className={`bg-gray-50 p-3 text-center font-medium text-sm text-gray-700 ${isLastRow ? 'rounded-bl-lg' : ''}`}>
                    {hour}:00
                  </div>
                  {days.map((day, dayIndex) => {
                    const slotKey = `${formatDate(day)}_${hour}`;
                    const availability = calculateSlotAvailability(slotKey);
                    const isSelected = currentUser?.schedule?.[slotKey];
                    const isLastCol = dayIndex === days.length - 1;

                    let slotClass = 'bg-white hover:bg-gray-50 border border-gray-200';
                    let slotContent = '';

                    if (viewMode === 'edit') {
                      if (isSelected) {
                        slotClass = 'bg-blue-600 hover:bg-blue-700 text-white';
                        slotContent = '✓';
                      }
                    } else {
                      if (availability.count > 0) {
                        if (availability.count === totalParticipants) {
                          slotClass = 'bg-green-500 hover:bg-green-600 text-white font-medium';
                          slotContent = '전원';
                        } else {
                          const intensity = availability.count / totalParticipants;
                          slotClass = `${intensity > 0.5 ? 'bg-amber-500 hover:bg-amber-600' : 'bg-amber-400 hover:bg-amber-500'} text-white`;
                          slotContent = `${availability.count}명`;
                        }
                      }
                    }

                    return (
                      <div
                        key={slotKey}
                        onClick={() => toggleTimeSlot(slotKey)}
                        className={`p-3 text-center cursor-pointer transition-colors text-sm ${slotClass} ${isLastRow && isLastCol ? 'rounded-br-lg' : ''}`}
                      >
                        {slotContent}
                      </div>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Best Times */}
        <div className="bg-white rounded-xl border border-gray-200 p-8">
          <div className="flex items-center mb-6">
            <svg className="w-6 h-6 text-gray-700 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <h3 className="text-xl font-semibold text-gray-900">최적 시간대</h3>
          </div>
          
          {bestTimes.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-gray-500">아직 선택된 시간이 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {bestTimes.map((time, index) => {
                const isPerfect = time.availability.count === totalParticipants;
                const percentage = Math.round((time.availability.count / totalParticipants) * 100);
                
                return (
                  <div
                    key={time.slotKey}
                    className={`p-5 rounded-lg border ${
                      isPerfect ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'
                    } hover:shadow-sm transition-all`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                            isPerfect ? 'bg-green-600 text-white' : 'bg-gray-600 text-white'
                          }`}>
                            {index + 1}
                          </span>
                          <div className="font-medium text-gray-900">
                            {time.date.getMonth() + 1}월 {time.date.getDate()}일 ({['일', '월', '화', '수', '목', '금', '토'][time.date.getDay()]}) {time.hour}:00 - {time.hour + 1}:00
                          </div>
                        </div>
                        <div className="ml-11">
                          <div className="text-sm text-gray-600 mb-2">
                            참여 가능: {time.availability.participants.map((p: Participant) => p.name).join(', ')}
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                            <div 
                              className={`h-full transition-all duration-500 ${
                                isPerfect 
                                  ? 'bg-green-600' 
                                  : percentage >= 70 
                                    ? 'bg-amber-500' 
                                    : 'bg-gray-400'
                              }`}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="text-right ml-6 flex flex-col items-end">
                        <div className={`text-2xl font-bold mb-1 ${
                          isPerfect ? 'text-green-600' : 'text-gray-700'
                        }`}>
                          {time.availability.count}/{totalParticipants}
                        </div>
                        <div className="text-sm text-gray-500">{percentage}%</div>
                        {isPerfect && (
                          <span className="mt-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            최적
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
