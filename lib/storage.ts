import { kv } from '@vercel/kv';

// Room 타입 정의
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

// Next.js 개발 모드에서 메모리 유지를 위해 global 사용
declare global {
  var __memoryStore: Map<string, Room> | undefined;
}

// 메모리 저장소 (개발 환경용) - global로 유지
const memoryStore = global.__memoryStore || new Map<string, Room>();
if (!global.__memoryStore) {
  global.__memoryStore = memoryStore;
  console.log('Memory store initialized (global)');
}

// KV 사용 가능 여부 확인
const useKV = process.env.KV_URL && process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN;

console.log('Storage module loaded:', { useKV, nodeEnv: process.env.NODE_ENV, memoryKeys: memoryStore.size });

// Room 데이터 검증 및 정규화
function normalizeRoom(room: Room | null): Room | null {
  if (!room) return null;
  
  // participants가 없으면 빈 객체로 초기화
  if (!room.participants) {
    room.participants = {};
  }
  
  // participants의 각 멤버에 대해 schedule이 없으면 빈 객체로 초기화
  Object.keys(room.participants).forEach(userId => {
    if (!room.participants[userId].schedule) {
      room.participants[userId].schedule = {};
    }
  });
  
  return room;
}

// 개발/프로덕션 환경에 따라 다른 저장소 사용
export const storage = {
  async get(key: string): Promise<Room | null> {
    console.log(`Storage GET: ${key}`);
    
    if (useKV) {
      try {
        const data = await kv.get<Room>(key);
        console.log(`KV GET result for ${key}:`, !!data);
        return data;
      } catch (error) {
        console.error('KV get error:', error);
        return null;
      }
    }
    
    const data = memoryStore.get(key) || null;
    console.log(`Memory GET result for ${key}:`, !!data);
    console.log('Current memory keys:', Array.from(memoryStore.keys()));
    return data;
  },

  async set(key: string, value: Room, options?: { ex?: number }): Promise<void> {
    console.log(`Storage SET: ${key}`, { hasValue: !!value });
    
    if (useKV) {
      try {
        // Vercel KV는 기본적으로 24시간 후 만료
        if (options?.ex) {
          await kv.set(key, value, { ex: options.ex });
        } else {
          await kv.set(key, value, { ex: 86400 });
        }
        console.log(`KV SET success for ${key}`);
      } catch (error) {
        console.error('KV set error:', error);
      }
    } else {
      memoryStore.set(key, value);
      console.log(`Memory SET success for ${key}, total keys:`, memoryStore.size);
      console.log('All keys:', Array.from(memoryStore.keys()));
    }
  },

  async exists(key: string): Promise<boolean> {
    if (useKV) {
      try {
        const result = await kv.exists(key);
        return result === 1;
      } catch (error) {
        console.error('KV exists error:', error);
        return false;
      }
    }
    return memoryStore.has(key);
  }
};

// 방 관련 유틸리티 함수
export const roomStorage = {
  async getRoom(code: string): Promise<Room | null> {
    const room = await storage.get(`room:${code}`);
    return normalizeRoom(room);
  },

  async setRoom(code: string, room: Room): Promise<void> {
    const normalizedRoom = normalizeRoom(room);
    if (!normalizedRoom) return;
    // 24시간 후 자동 삭제
    await storage.set(`room:${code}`, normalizedRoom, { ex: 86400 });
  },

  async roomExists(code: string): Promise<boolean> {
    return await storage.exists(`room:${code}`);
  },

  // 디버깅용 - 모든 방 목록
  async getAllRoomCodes(): Promise<string[]> {
    if (useKV) {
      // KV에서는 지원하지 않음
      return [];
    }
    
    const codes = Array.from(memoryStore.keys())
      .filter(key => key.startsWith('room:'))
      .map(key => key.replace('room:', ''));
    
    console.log('All room codes:', codes);
    return codes;
  }
};
