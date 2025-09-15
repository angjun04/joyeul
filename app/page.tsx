'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import useSWR from 'swr';

const DEFAULT_START_HOUR = 0;
const DEFAULT_END_HOUR = 24;
const DEFAULT_DAYS_RANGE = 7;

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

interface DragSelection {
  isSelecting: boolean;
  startSlot: string | null;
  endSlot: string | null;
  selectedSlots: Set<string>;
  initialValue: boolean;
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP error! status: ${res.status}`);
  }
  const data = await res.json();
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
  
  const [startDate, setStartDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() + DEFAULT_DAYS_RANGE - 1);
    return date.toISOString().split('T')[0];
  });
  
  const [localSchedule, setLocalSchedule] = useState<Record<string, boolean>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [lastSavedSchedule, setLastSavedSchedule] = useState<Record<string, boolean>>({});
  // 자동저장 제거 - KV DB 부하 감소

  const [dragSelection, setDragSelection] = useState<DragSelection>({
    isSelecting: false,
    startSlot: null,
    endSlot: null,
    selectedSlots: new Set(),
    initialValue: false
  });
  const gridRef = useRef<HTMLDivElement>(null);

  const { data: roomData, mutate } = useSWR(
    currentRoom ? `/api/rooms/${currentRoom.code}` : null,
    fetcher,
    { 
      refreshInterval: viewMode === 'view' ? 3000 : 10000,
      onError: (err) => {
        console.error('SWR Error:', err);
      }
    }
  );

  useEffect(() => {
    if (roomData && currentRoom) {
      if (roomData.code && roomData.participants !== undefined) {
        setCurrentRoom(roomData);
        
        if (viewMode === 'view' || !hasChanges) {
          const currentParticipant = roomData.participants[currentUserId];
          if (currentParticipant) {
            setLocalSchedule(currentParticipant.schedule || {});
            setLastSavedSchedule(currentParticipant.schedule || {});
          }
        }
      }
    }
  }, [roomData, currentUserId, viewMode, hasChanges, currentRoom]);

  // 자동저장 제거 - 수동 저장만 사용

  useEffect(() => {
    const hasLocalChanges = JSON.stringify(localSchedule) !== JSON.stringify(lastSavedSchedule);
    setHasChanges(hasLocalChanges);
  }, [localSchedule, lastSavedSchedule]);

  const createNewRoom = async () => {
    if (!userName.trim()) {
      setLoginError('이름을 입력해주세요.');
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start > end) {
      setLoginError('종료일이 시작일보다 빠를 수 없습니다.');
      return;
    }
    
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    if (daysDiff > 30) {
      setLoginError('최대 30일까지만 설정 가능합니다.');
      return;
    }

    setIsCreating(true);
    try {
      const response = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          creatorName: userName,
          startDate: new Date(startDate).toISOString(),
          endDate: new Date(endDate + 'T23:59:59').toISOString()
        }),
      });

      if (!response.ok) throw new Error('Failed to create room');

      const data = await response.json();
      setCurrentRoom(data.room);
      setCurrentUserId(data.userId);
      setRoomCode(data.room.code);
      setLocalSchedule({});
      setLastSavedSchedule({});
      setLoginError('');
      
      if (navigator.clipboard) {
        try {
          await navigator.clipboard.writeText(data.room.code);
          setSuccessMessage(`방이 생성되었습니다. 코드: ${data.room.code} (클립보드에 복사됨)`);
        } catch (err) {
          setSuccessMessage(`방이 생성되었습니다. 코드: ${data.room.code}`);
        }
      } else {
        setSuccessMessage(`방이 생성되었습니다. 코드: ${data.room.code}`);
      }
      
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
      setCurrentRoom(data.room);
      setCurrentUserId(data.userId);
      
      const participant = data.room.participants[data.userId];
      if (participant) {
        setLocalSchedule(participant.schedule || {});
        setLastSavedSchedule(participant.schedule || {});
      }
      
      setLoginError('');
    } catch (error) {
      console.error('Join room error:', error);
      setLoginError('방 참여에 실패했습니다.');
    }
  };

  const getSlotRange = (start: string, end: string): string[] => {
    const days = getDaysInRange();
    const slots: string[] = [];
    
    const [startDate, startHour] = start.split('_').map(s => s.includes('-') ? s : parseInt(s));
    const [endDate, endHour] = end.split('_').map(s => s.includes('-') ? s : parseInt(s));
    
    let startDayIndex = days.findIndex(d => formatDate(d) === startDate);
    let endDayIndex = days.findIndex(d => formatDate(d) === endDate);
    let startH = parseInt(startHour as string);
    let endH = parseInt(endHour as string);
    
    if (startDayIndex > endDayIndex || (startDayIndex === endDayIndex && startH > endH)) {
      [startDayIndex, endDayIndex] = [endDayIndex, startDayIndex];
      [startH, endH] = [endH, startH];
    }
    
    for (let dayIdx = startDayIndex; dayIdx <= endDayIndex; dayIdx++) {
      const day = days[dayIdx];
      const dayStr = formatDate(day);
      
      const hourStart = dayIdx === startDayIndex ? startH : DEFAULT_START_HOUR;
      const hourEnd = dayIdx === endDayIndex ? endH : DEFAULT_END_HOUR - 1;
      
      for (let hour = hourStart; hour <= hourEnd; hour++) {
        slots.push(`${dayStr}_${hour}`);
      }
    }
    
    return slots;
  };

  const handleMouseDown = (slotKey: string) => {
    if (viewMode !== 'edit') return;
    
    const currentValue = localSchedule[slotKey] || false;
    
    setDragSelection({
      isSelecting: true,
      startSlot: slotKey,
      endSlot: slotKey,
      selectedSlots: new Set([slotKey]),
      initialValue: !currentValue
    });
    
    toggleTimeSlot(slotKey);
  };

  const handleMouseEnter = (slotKey: string) => {
    if (!dragSelection.isSelecting || viewMode !== 'edit') return;
    
    const range = getSlotRange(dragSelection.startSlot!, slotKey);
    setDragSelection(prev => ({
      ...prev,
      endSlot: slotKey,
      selectedSlots: new Set(range)
    }));
    
    setLocalSchedule(prev => {
      const newSchedule = { ...prev };
      range.forEach(slot => {
        if (dragSelection.initialValue) {
          newSchedule[slot] = true;
        } else {
          delete newSchedule[slot];
        }
      });
      return newSchedule;
    });
  };

  const handleMouseUp = () => {
    setDragSelection({
      isSelecting: false,
      startSlot: null,
      endSlot: null,
      selectedSlots: new Set(),
      initialValue: false
    });
  };

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (dragSelection.isSelecting) {
        handleMouseUp();
      }
    };

    document.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [dragSelection.isSelecting]);

  const toggleTimeSlot = (slotKey: string) => {
    if (viewMode !== 'edit') return;

    setLocalSchedule(prev => {
      const newSchedule = { ...prev };
      if (newSchedule[slotKey]) {
        delete newSchedule[slotKey];
      } else {
        newSchedule[slotKey] = true;
      }
      return newSchedule;
    });
  };

  const saveSchedule = async () => {
    if (!currentRoom || !hasChanges) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/rooms/${currentRoom.code}/schedule`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUserId,
          schedule: localSchedule,
        }),
      });

      if (!response.ok) throw new Error('Failed to save schedule');

      setLastSavedSchedule(localSchedule);
      setHasChanges(false);
      
      setSuccessMessage('✅ 일정이 성공적으로 저장되었습니다!');
      setTimeout(() => setSuccessMessage(''), 3000);
      
      await mutate();
    } catch (error) {
      console.error('Failed to save schedule:', error);
      setLoginError('일정 저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const cancelChanges = () => {
    setLocalSchedule(lastSavedSchedule);
    setHasChanges(false);
  };

  const selectAll = () => {
    const days = getDaysInRange();
    const newSchedule: Record<string, boolean> = {};
    
    days.forEach(day => {
      for (let hour = DEFAULT_START_HOUR; hour < DEFAULT_END_HOUR; hour++) {
        const slotKey = `${formatDate(day)}_${hour}`;
        newSchedule[slotKey] = true;
      }
    });
    
    setLocalSchedule(newSchedule);
  };

  const clearAll = () => {
    setLocalSchedule({});
  };

  const leaveRoom = () => {
    if (hasChanges && viewMode === 'edit') {
      if (!confirm('저장하지 않은 변경사항이 있습니다. 정말 나가시겠습니까?')) {
        return;
      }
    }
    
    setCurrentRoom(null);
    setCurrentUserId('');
    setRoomCode('');
    setUserName('');
    setViewMode('edit');
    setLoginError('');
    setSuccessMessage('');
    setLocalSchedule({});
    setLastSavedSchedule({});
    setHasChanges(false);
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

  const selectedSlotsCount = useMemo(() => {
    return Object.keys(localSchedule).filter(key => localSchedule[key]).length;
  }, [localSchedule]);

  const formatHour = (hour: number): string => {
    if (hour === 0) return '00:00';
    if (hour === 24) return '24:00';
    return `${hour.toString().padStart(2, '0')}:00`;
  };

  if (!currentRoom) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="w-full max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h1 className="text-7xl font-black">조율</h1>
            <p className="text-2xl text-[var(--muted-foreground)] mt-4">
              가장 간단한 일정 조율 서비스
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-12 w-full">
            {/* 새 방 만들기 */}
            <div className="card p-10">
              <h2 className="text-3xl font-bold mb-8 text-center">새로운 일정 만들기</h2>
              
              <div className="space-y-6">
                <div>
                  <label className="text-sm font-medium mb-3">이름</label>
                  <input
                    type="text"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    className="input w-full"
                    placeholder="홍길동"
                    disabled={!!roomCode}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-3">조율 기간</label>
                  <div className="grid grid-cols-2 gap-4 mt-3">
                    <div>
                      <label className="text-xs text-[var(--muted-foreground)] mb-2">시작일</label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                        className="input w-full"
                        disabled={!!roomCode}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-[var(--muted-foreground)] mb-2">종료일</label>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        min={startDate}
                        className="input w-full"
                        disabled={!!roomCode}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-[var(--muted-foreground)] mt-3">
                    최대 30일까지 설정 가능
                  </p>
                </div>

                <div className="pt-4">
                  <button
                    onClick={createNewRoom}
                    disabled={isCreating || !!roomCode}
                    className="btn btn-primary btn-lg w-full"
                  >
                    {isCreating ? <span className="spinner"></span> : '방 만들기'}
                  </button>
                </div>
              </div>
            </div>

            {/* 기존 방 참여 */}
            <div className="card p-10">
              <h2 className="text-3xl font-bold mb-8 text-center">기존 일정 참여</h2>
              
              <div className="space-y-6">
                <div>
                  <label className="text-sm font-medium mb-3">이름</label>
                  <input
                    type="text"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    className="input w-full"
                    placeholder="홍길동"
                    disabled={!!startDate !== !!endDate}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-3">방 코드</label>
                  <input
                    type="text"
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value)}
                    className="input w-full uppercase font-mono text-center text-lg"
                    placeholder="ABCD1234"
                    maxLength={10}
                    disabled={!!startDate !== !!endDate}
                  />
                  <p className="text-xs text-[var(--muted-foreground)] mt-3">
                    주최자로부터 받은 코드를 입력하세요
                  </p>
                </div>

                <div className="pt-4">
                  <button
                    onClick={joinRoom}
                    className="btn btn-secondary btn-lg w-full"
                    disabled={!!startDate !== !!endDate}
                  >
                    참여하기
                  </button>
                </div>
              </div>
            </div>
          </div>

          {successMessage && (
            <div className="alert alert-success mt-12 max-w-3xl mx-auto">
              {successMessage}
            </div>
          )}

          {loginError && (
            <div className="alert alert-error mt-12 max-w-3xl mx-auto">
              {loginError}
            </div>
          )}
        </div>
      </div>
    );
  }

  const days = getDaysInRange();
  const currentUser = currentRoom.participants?.[currentUserId];
  const totalParticipants = Object.keys(currentRoom.participants || {}).length;
  const bestTimes = findBestTimes();

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b sticky top-0 bg-[var(--background)] z-10">
        <div className="container">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center space-x-6">
              <h1 className="text-2xl font-bold">조율</h1>
              <span className="badge badge-default font-mono text-sm px-4 py-3">{currentRoom.code}</span>
            </div>
            
            <div className="flex items-center gap-6">
              <div className="text-sm">
                <span className="text-[var(--muted-foreground)]">참여자:</span>
                <strong className="ml-2">{currentUser?.name}</strong>
              </div>
              <button onClick={leaveRoom} className="btn btn-ghost">
                나가기
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="container" style={{ paddingTop: '3rem', paddingBottom: '3rem' }}>
        <div className="grid lg:grid-cols-3 gap-12">
          {/* 왼쪽 사이드바 */}
          <div className="lg:col-span-1 space-y-8">
            {/* 참여자 목록 */}
            <div className="card p-8">
              <h3 className="text-lg font-bold mb-6">참여자 {totalParticipants}명</h3>
              <div className="space-y-3">
                {currentRoom.participants && Object.values(currentRoom.participants).map((participant) => (
                  <div
                    key={participant.id}
                    className={`flex items-center justify-between p-4 rounded-lg ${
                      participant.id === currentUserId ? 'bg-[var(--accent)]' : ''
                    }`}
                  >
                    <span className="font-medium">{participant.name}</span>
                    {participant.id === currentUserId && (
                      <span className="badge badge-primary">나</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* 최적 시간 */}
            <div className="card p-8">
              <h3 className="text-lg font-bold mb-6">추천 시간</h3>
              {bestTimes.length === 0 ? (
                <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
                  아직 선택된 시간이 없습니다.
                </p>
              ) : (
                <div className="space-y-5">
                  {bestTimes.slice(0, 3).map((time) => {
                    const isPerfect = time.availability.count === totalParticipants;
                    const percentage = Math.round((time.availability.count / totalParticipants) * 100);
                    
                    return (
                      <div key={time.slotKey} className="pb-5 border-b last:border-0">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <div className="font-semibold">
                              {time.date.getMonth() + 1}월 {time.date.getDate()}일
                            </div>
                            <div className="text-sm text-[var(--muted-foreground)] mt-2">
                              {formatHour(time.hour)} ~ {formatHour(time.hour + 1)}
                            </div>
                          </div>
                          <div className="text-right">
                            {isPerfect ? (
                              <span className="badge badge-success">전원</span>
                            ) : (
                              <span className="badge badge-warning">{percentage}%</span>
                            )}
                          </div>
                        </div>
                        <div className="text-xs text-[var(--muted-foreground)] mt-3">
                          참여 가능: {time.availability.participants.map(p => p.name).join(', ')}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 컨트롤 */}
            <div className="card p-8 space-y-6">
              <div className="flex items-center justify-between">
                <span className="font-medium">모드</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setViewMode('edit')}
                    className={`btn ${viewMode === 'edit' ? 'btn-primary' : 'btn-ghost'}`}
                  >
                    편집
                  </button>
                  <button
                    onClick={() => setViewMode('view')}
                    className={`btn ${viewMode === 'view' ? 'btn-primary' : 'btn-ghost'}`}
                  >
                    보기
                  </button>
                </div>
              </div>

              {viewMode === 'edit' && (
                <>
                  <div className="flex items-center justify-between pt-2">
                    <span className="font-medium">선택된 시간</span>
                    <span className="text-xl font-bold">{selectedSlotsCount}개</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <button onClick={selectAll} className="btn btn-secondary">
                      전체 선택
                    </button>
                    <button onClick={clearAll} className="btn btn-secondary">
                      전체 해제
                    </button>
                  </div>

                  {hasChanges && (
                    <div className="pt-6 border-t">
                      <div className="bg-[var(--warning)] bg-opacity-10 rounded-lg p-3 mb-4">
                        <p className="text-xs text-center font-medium">
                          ⚠️ 변경사항이 있습니다
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <button onClick={cancelChanges} className="btn btn-ghost">
                          취소
                        </button>
                        <button 
                          onClick={saveSchedule}
                          disabled={isSaving}
                          className="btn btn-primary"
                          style={{ 
                            background: 'var(--danger)',
                            borderColor: 'var(--danger)',
                            animation: 'pulse 2s infinite'
                          }}
                        >
                          {isSaving ? <span className="spinner"></span> : '💾 저장하기'}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* 메인 그리드 */}
          <div className="lg:col-span-2">
            {successMessage && (
              <div className="alert alert-success mb-6">
                {successMessage}
              </div>
            )}

            {viewMode === 'edit' && hasChanges && (
              <div className="alert alert-warning mb-6">
                ⚠️ 저장하지 않은 변경사항이 있습니다. 저장 버튼을 눌러주세요.
              </div>
            )}

            <div className="card p-8 overflow-x-auto">
              <h3 className="text-xl font-bold mb-3">
                {viewMode === 'edit' ? '내 일정 선택' : '전체 일정'}
              </h3>
              
              {viewMode === 'edit' && (
                <p className="text-sm text-[var(--muted-foreground)] mb-8">
                  드래그하여 여러 시간을 선택할 수 있습니다.
                </p>
              )}
              
              <div 
                ref={gridRef}
                className="grid gap-0.5 select-none"
                style={{ 
                  gridTemplateColumns: `60px repeat(${days.length}, minmax(60px, 1fr))`
                }}
              >
                {/* Header */}
                <div></div>
                {days.map((day) => (
                  <div key={day.toISOString()} className="text-center p-2">
                    <div className="text-sm font-semibold">
                      {day.getMonth() + 1}/{day.getDate()}
                    </div>
                    <div className="text-xs text-[var(--muted-foreground)]">
                      {['일', '월', '화', '수', '목', '금', '토'][day.getDay()]}
                    </div>
                  </div>
                ))}

                {/* Time Slots */}
                {Array.from({ length: DEFAULT_END_HOUR - DEFAULT_START_HOUR }, (_, i) => {
                  const hour = DEFAULT_START_HOUR + i;
                  return (
                    <React.Fragment key={hour}>
                      <div className="text-xs font-medium p-1 text-center">
                        {formatHour(hour)}
                      </div>
                      {days.map((day) => {
                        const slotKey = `${formatDate(day)}_${hour}`;
                        const availability = calculateSlotAvailability(slotKey);
                        const isSelected = localSchedule[slotKey];
                        const isDragging = dragSelection.selectedSlots.has(slotKey);

                        let slotClass = 'time-slot';
                        
                        if (viewMode === 'edit') {
                          if (isDragging || isSelected) {
                            slotClass += ' time-slot-selected';
                          }
                        } else {
                          if (availability.count > 0) {
                            if (availability.count === totalParticipants) {
                              slotClass += ' time-slot-available-full';
                            } else {
                              slotClass += ' time-slot-available-partial';
                            }
                          }
                        }

                        return (
                          <div
                            key={slotKey}
                            onMouseDown={() => viewMode === 'edit' && handleMouseDown(slotKey)}
                            onMouseEnter={() => viewMode === 'edit' && handleMouseEnter(slotKey)}
                            className={slotClass}
                            title={viewMode === 'view' && availability.count > 0 
                              ? `${availability.participants.map(p => p.name).join(', ')}` 
                              : ''}
                          >
                            {viewMode === 'view' && availability.count > 0 && (
                              <span className="text-xs font-bold">
                                {availability.count === totalParticipants ? '✓' : availability.count}
                              </span>
                            )}
                            {viewMode === 'edit' && isSelected && '✓'}
                          </div>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}