'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import useSWR from 'swr';

const DEFAULT_START_HOUR = 0;
const DEFAULT_END_HOUR = 24;
const AUTOSAVE_DELAY_MS = 5000; // 5초 후 자동 저장
const DEFAULT_DAYS_RANGE = 7; // 기본 7일

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
  
  // 날짜 범위 설정 (방 생성 시)
  const [startDate, setStartDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() + DEFAULT_DAYS_RANGE - 1);
    return date.toISOString().split('T')[0];
  });
  
  // 로컬 일정 상태 (편집 중인 데이터)
  const [localSchedule, setLocalSchedule] = useState<Record<string, boolean>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [lastSavedSchedule, setLastSavedSchedule] = useState<Record<string, boolean>>({});
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(false);
  const [autoSaveTimer, setAutoSaveTimer] = useState<NodeJS.Timeout | null>(null);

  // 드래그 선택 상태
  const [dragSelection, setDragSelection] = useState<DragSelection>({
    isSelecting: false,
    startSlot: null,
    endSlot: null,
    selectedSlots: new Set(),
    initialValue: false
  });
  const gridRef = useRef<HTMLDivElement>(null);

  // Use SWR for real-time room updates
  const { data: roomData, mutate } = useSWR(
    currentRoom ? `/api/rooms/${currentRoom.code}` : null,
    fetcher,
    { 
      refreshInterval: viewMode === 'view' ? 3000 : 10000, // 보기 모드에서만 자주 갱신
      onError: (err) => {
        console.error('SWR Error:', err);
      }
    }
  );

  // 서버 데이터가 업데이트되면 반영
  useEffect(() => {
    if (roomData && currentRoom) {
      console.log('Room data updated:', roomData);
      // Ensure the data has proper structure before updating
      if (roomData.code && roomData.participants !== undefined) {
        setCurrentRoom(roomData);
        
        // 편집 모드가 아니거나 변경사항이 없을 때만 로컬 스케줄 업데이트
        if (viewMode === 'view' || !hasChanges) {
          const currentParticipant = roomData.participants[currentUserId];
          if (currentParticipant) {
            setLocalSchedule(currentParticipant.schedule || {});
            setLastSavedSchedule(currentParticipant.schedule || {});
          }
        }
      }
    }
  }, [roomData, currentUserId, viewMode, hasChanges]);

  // 자동 저장 로직
  useEffect(() => {
    if (autoSaveEnabled && hasChanges && viewMode === 'edit') {
      // 이전 타이머 취소
      if (autoSaveTimer) {
        clearTimeout(autoSaveTimer);
      }
      
      // 새 타이머 설정
      const timer = setTimeout(() => {
        saveSchedule();
      }, AUTOSAVE_DELAY_MS);
      
      setAutoSaveTimer(timer);
      
      return () => {
        if (timer) clearTimeout(timer);
      };
    }
  }, [localSchedule, autoSaveEnabled, hasChanges]);

  // 변경사항 체크
  useEffect(() => {
    const hasLocalChanges = JSON.stringify(localSchedule) !== JSON.stringify(lastSavedSchedule);
    setHasChanges(hasLocalChanges);
  }, [localSchedule, lastSavedSchedule]);

  const createNewRoom = async () => {
    if (!userName.trim()) {
      setLoginError('이름을 입력해주세요.');
      return;
    }

    // 날짜 검증
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
      console.log('Room created:', data);
      setCurrentRoom(data.room);
      setCurrentUserId(data.userId);
      setRoomCode(data.room.code);
      setLocalSchedule({});
      setLastSavedSchedule({});
      setLoginError('');
      
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
      
      // 기존 일정 로드
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

  // 드래그 선택을 위한 함수들
  const getSlotRange = (start: string, end: string): string[] => {
    const days = getDaysInRange();
    const slots: string[] = [];
    
    // 시작과 끝 슬롯 파싱
    const [startDate, startHour] = start.split('_').map(s => s.includes('-') ? s : parseInt(s));
    const [endDate, endHour] = end.split('_').map(s => s.includes('-') ? s : parseInt(s));
    
    let startDayIndex = days.findIndex(d => formatDate(d) === startDate);
    let endDayIndex = days.findIndex(d => formatDate(d) === endDate);
    let startH = parseInt(startHour as string);
    let endH = parseInt(endHour as string);
    
    // 범위 정규화 (시작이 끝보다 뒤에 있는 경우 처리)
    if (startDayIndex > endDayIndex || (startDayIndex === endDayIndex && startH > endH)) {
      [startDayIndex, endDayIndex] = [endDayIndex, startDayIndex];
      [startH, endH] = [endH, startH];
    }
    
    // 범위 내 모든 슬롯 추가
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
    
    // 현재 슬롯의 상태를 확인하여 토글할 값 결정
    const currentValue = localSchedule[slotKey] || false;
    
    setDragSelection({
      isSelecting: true,
      startSlot: slotKey,
      endSlot: slotKey,
      selectedSlots: new Set([slotKey]),
      initialValue: !currentValue // 반대값으로 토글
    });
    
    // 즉시 토글
    toggleTimeSlot(slotKey);
  };

  const handleMouseEnter = (slotKey: string) => {
    if (!dragSelection.isSelecting || viewMode !== 'edit') return;
    
    // 드래그 범위 업데이트
    const range = getSlotRange(dragSelection.startSlot!, slotKey);
    setDragSelection(prev => ({
      ...prev,
      endSlot: slotKey,
      selectedSlots: new Set(range)
    }));
    
    // 범위 내 모든 슬롯을 초기값으로 설정
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

  // 전역 마우스 이벤트 (드래그가 그리드 밖에서 끝날 때 처리)
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

  // 로컬에서만 토글 (서버 요청 없음)
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

  // 일정 저장 (서버에 한 번에 전송)
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
      
      // 성공 메시지
      setSuccessMessage('일정이 저장되었습니다!');
      setTimeout(() => setSuccessMessage(''), 2000);
      
      // SWR 갱신
      await mutate();
    } catch (error) {
      console.error('Failed to save schedule:', error);
      setLoginError('일정 저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  // 변경사항 취소
  const cancelChanges = () => {
    setLocalSchedule(lastSavedSchedule);
    setHasChanges(false);
  };

  // 전체 선택/해제
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
    // 변경사항이 있으면 확인
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
    
    if (autoSaveTimer) {
      clearTimeout(autoSaveTimer);
    }
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

  // 선택된 슬롯 개수 계산
  const selectedSlotsCount = useMemo(() => {
    return Object.keys(localSchedule).filter(key => localSchedule[key]).length;
  }, [localSchedule]);

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

            {/* 날짜 범위 선택 (방 생성 시) */}
            {!roomCode && (
              <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
                <label className="block text-sm font-medium text-gray-700">
                  일정 조율 기간 <span className="font-normal text-gray-400 text-xs">(방 생성 시)</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">시작일</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">종료일</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      min={startDate}
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">최대 30일까지 설정 가능합니다</p>
              </div>
            )}

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
          </div>
        </div>
      </div>
    );
  }

  const days = getDaysInRange();
  const currentUser = currentRoom.participants?.[currentUserId];
  const totalParticipants = Object.keys(currentRoom.participants || {}).length;
  const bestTimes = findBestTimes();

  // 시간 포맷팅 (0시 -> 00:00, 13시 -> 13:00)
  const formatHour = (hour: number): string => {
    return `${hour.toString().padStart(2, '0')}:00`;
  };

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
        {/* View Mode Toggle & Save Controls */}
        <div className="flex justify-between items-start mb-8">
          <div className="flex gap-1 p-1 bg-gray-100 rounded-lg inline-flex">
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

          {/* 편집 모드일 때 저장 컨트롤 */}
          {viewMode === 'edit' && (
            <div className="flex items-center gap-3">
              {/* 자동 저장 토글 */}
              <label className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-lg cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoSaveEnabled}
                  onChange={(e) => setAutoSaveEnabled(e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-gray-100 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">자동 저장</span>
              </label>

              {/* 선택된 시간 표시 */}
              <div className="px-4 py-2 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-600">선택된 시간:</span>
                <span className="ml-2 font-medium text-gray-900">{selectedSlotsCount}개</span>
              </div>

              {/* 빠른 선택 버튼 */}
              <button
                onClick={selectAll}
                className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                전체 선택
              </button>
              <button
                onClick={clearAll}
                className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                전체 해제
              </button>

              {/* 저장/취소 버튼 */}
              {hasChanges && (
                <>
                  <button
                    onClick={cancelChanges}
                    className="px-5 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    취소
                  </button>
                  <button
                    onClick={saveSchedule}
                    disabled={isSaving}
                    className={`px-6 py-2 text-sm font-medium text-white rounded-lg transition-all ${
                      isSaving 
                        ? 'bg-gray-400 cursor-not-allowed' 
                        : 'bg-blue-600 hover:bg-blue-700 shadow-sm hover:shadow-md'
                    } ${hasChanges ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`}
                  >
                    {isSaving ? '저장 중...' : '저장하기'}
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* 알림 메시지 */}
        {successMessage && (
          <div className="mb-4 bg-green-50 border border-green-200 text-green-700 p-4 rounded-lg text-sm flex items-center">
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            {successMessage}
          </div>
        )}

        {/* 변경사항 알림 */}
        {viewMode === 'edit' && hasChanges && !autoSaveEnabled && (
          <div className="mb-4 bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-lg text-sm flex items-center">
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            저장하지 않은 변경사항이 있습니다. 저장 버튼을 눌러 변경사항을 반영하세요.
          </div>
        )}

        {/* 드래그 안내 */}
        {viewMode === 'edit' && (
          <div className="mb-4 bg-blue-50 border border-blue-200 text-blue-700 p-3 rounded-lg text-sm flex items-center">
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            💡 마우스를 드래그하여 여러 시간을 한 번에 선택할 수 있습니다.
          </div>
        )}

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
              <>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-blue-600 rounded"></div>
                  <span className="text-sm text-gray-600">선택됨 (저장됨)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-blue-400 rounded"></div>
                  <span className="text-sm text-gray-600">선택됨 (미저장)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-blue-200 rounded ring-2 ring-blue-400"></div>
                  <span className="text-sm text-gray-600">드래그 중</span>
                </div>
              </>
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
          
          <div 
            ref={gridRef}
            className="grid grid-cols-[80px_repeat(var(--days-count),_minmax(100px,_1fr))] gap-0.5 min-w-[600px] select-none" 
            style={{ '--days-count': days.length } as React.CSSProperties}
            onMouseLeave={() => {
              if (dragSelection.isSelecting) {
                // 그리드를 벗어나면 드래그 취소
                handleMouseUp();
              }
            }}
          >
            {/* Header */}
            <div className="bg-gray-50 p-3 text-center font-medium text-sm text-gray-700 rounded-tl-lg sticky left-0 z-10">시간</div>
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
                  <div className={`bg-gray-50 p-3 text-center font-medium text-sm text-gray-700 sticky left-0 z-10 ${isLastRow ? 'rounded-bl-lg' : ''}`}>
                    {formatHour(hour)}
                  </div>
                  {days.map((day, dayIndex) => {
                    const slotKey = `${formatDate(day)}_${hour}`;
                    const availability = calculateSlotAvailability(slotKey);
                    const isSelected = localSchedule[slotKey];
                    const isSaved = lastSavedSchedule[slotKey];
                    const isLastCol = dayIndex === days.length - 1;
                    const isDragging = dragSelection.selectedSlots.has(slotKey);

                    let slotClass = 'bg-white hover:bg-gray-50 border border-gray-200';
                    let slotContent = '';

                    if (viewMode === 'edit') {
                      if (isDragging) {
                        slotClass = 'bg-blue-200 ring-2 ring-blue-400 cursor-pointer';
                        slotContent = dragSelection.initialValue ? '✓' : '';
                      } else if (isSelected && isSaved) {
                        slotClass = 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer';
                        slotContent = '✓';
                      } else if (isSelected && !isSaved) {
                        slotClass = 'bg-blue-400 hover:bg-blue-500 text-white cursor-pointer ring-2 ring-blue-300';
                        slotContent = '✓';
                      } else if (!isSelected && isSaved) {
                        slotClass = 'bg-orange-200 hover:bg-orange-300 cursor-pointer';
                        slotContent = '−';
                      } else {
                        slotClass = 'bg-white hover:bg-gray-100 border border-gray-200 cursor-pointer';
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
                        onMouseDown={() => viewMode === 'edit' && handleMouseDown(slotKey)}
                        onMouseEnter={() => viewMode === 'edit' && handleMouseEnter(slotKey)}
                        className={`p-3 text-center transition-all text-sm ${slotClass} ${isLastRow && isLastCol ? 'rounded-br-lg' : ''}`}
                        title={viewMode === 'view' && availability.count > 0 
                          ? `참여 가능: ${availability.participants.map(p => p.name).join(', ')}` 
                          : ''}
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
                            {time.date.getMonth() + 1}월 {time.date.getDate()}일 ({['일', '월', '화', '수', '목', '금', '토'][time.date.getDay()]}) {formatHour(time.hour)} - {formatHour(time.hour + 1)}
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

        {/* 기간 정보 */}
        <div className="mt-8 text-center text-sm text-gray-500">
          조율 기간: {new Date(currentRoom.startDate).toLocaleDateString('ko-KR')} ~ {new Date(currentRoom.endDate).toLocaleDateString('ko-KR')}
        </div>
      </div>
    </div>
  );
}