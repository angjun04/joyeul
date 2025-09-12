import { getRedisClient } from './redis-client';

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
    
    const redis = await getRedisClient();
    
    if (redis) {
      try {
        const data = await redis.get(key);
        if (data) {
          const room = JSON.parse(data) as Room;
          console.log(`Redis GET result for ${key}:`, !!room);
          return room;
        }
        return null;
      } catch (error) {
        console.error('Redis get error:', error);
        // Fallback to memory storage
        const data = memoryStore.get(key) || null;
        console.log(`Fallback to memory GET result for ${key}:`, !!data);
        return data;
      }
    }
    
    // Redis가 없으면 메모리 저장소 사용
    const data = memoryStore.get(key) || null;
    console.log(`Memory GET result for ${key}:`, !!data);
    console.log('Current memory keys:', Array.from(memoryStore.keys()));
    return data;
  },

  async set(key: string, value: Room, options?: { ex?: number }): Promise<void> {
    console.log(`Storage SET: ${key}`, { hasValue: !!value });
    
    const redis = await getRedisClient();
    
    if (redis) {
      try {
        // Redis에 JSON 문자열로 저장, 기본 24시간 후 만료
        const ttl = options?.ex || 86400;
        await redis.setEx(key, ttl, JSON.stringify(value));
        console.log(`Redis SET success for ${key}, TTL: ${ttl}s`);
        
        // 메모리 저장소에도 백업 (failover용)
        memoryStore.set(key, value);
      } catch (error) {
        console.error('Redis set error:', error);
        // Fallback to memory storage
        memoryStore.set(key, value);
        console.log(`Fallback to memory SET for ${key}`);
      }
    } else {
      // Redis가 없으면 메모리 저장소만 사용
      memoryStore.set(key, value);
      console.log(`Memory SET success for ${key}, total keys:`, memoryStore.size);
      console.log('All keys:', Array.from(memoryStore.keys()));
    }
  },

  async exists(key: string): Promise<boolean> {
    const redis = await getRedisClient();
    
    if (redis) {
      try {
        const result = await redis.exists(key);
        return result === 1;
      } catch (error) {
        console.error('Redis exists error:', error);
        // Fallback to memory storage
        return memoryStore.has(key);
      }
    }
    
    return memoryStore.has(key);
  },

  async delete(key: string): Promise<boolean> {
    const redis = await getRedisClient();
    
    if (redis) {
      try {
        const result = await redis.del(key);
        memoryStore.delete(key); // 메모리에서도 삭제
        return result === 1;
      } catch (error) {
        console.error('Redis delete error:', error);
        return memoryStore.delete(key);
      }
    }
    
    return memoryStore.delete(key);
  },

  async keys(pattern: string): Promise<string[]> {
    const redis = await getRedisClient();
    
    if (redis) {
      try {
        const keys = await redis.keys(pattern);
        return keys;
      } catch (error) {
        console.error('Redis keys error:', error);
        // Fallback to memory storage
        const regex = new RegExp(pattern.replace('*', '.*'));
        return Array.from(memoryStore.keys()).filter(key => regex.test(key));
      }
    }
    
    // 메모리 저장소에서 패턴 매칭
    const regex = new RegExp(pattern.replace('*', '.*'));
    return Array.from(memoryStore.keys()).filter(key => regex.test(key));
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

  async deleteRoom(code: string): Promise<boolean> {
    return await storage.delete(`room:${code}`);
  },

  // 모든 방 목록 가져오기
  async getAllRoomCodes(): Promise<string[]> {
    const keys = await storage.keys('room:*');
    const codes = keys.map(key => key.replace('room:', ''));
    console.log('All room codes:', codes);
    return codes;
  },

  // 방 정보 업데이트 (부분 업데이트)
  async updateRoom(code: string, updates: Partial<Room>): Promise<void> {
    const room = await roomStorage.getRoom(code);
    if (!room) {
      throw new Error(`Room ${code} not found`);
    }
    
    const updatedRoom = { ...room, ...updates };
    await roomStorage.setRoom(code, updatedRoom);
  },

  // 참가자 추가
  async addParticipant(roomCode: string, participant: Participant): Promise<void> {
    const room = await roomStorage.getRoom(roomCode);
    if (!room) {
      throw new Error(`Room ${roomCode} not found`);
    }
    
    room.participants[participant.id] = participant;
    await roomStorage.setRoom(roomCode, room);
  },

  // 참가자 일정 업데이트
  async updateParticipantSchedule(
    roomCode: string, 
    userId: string, 
    schedule: Record<string, boolean>
  ): Promise<void> {
    const room = await roomStorage.getRoom(roomCode);
    if (!room) {
      throw new Error(`Room ${roomCode} not found`);
    }
    
    if (!room.participants[userId]) {
      throw new Error(`Participant ${userId} not found in room ${roomCode}`);
    }
    
    room.participants[userId].schedule = schedule;
    await roomStorage.setRoom(roomCode, room);
  }
};
