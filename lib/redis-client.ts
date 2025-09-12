import { createClient } from 'redis';
import type { RedisClientType } from 'redis';

// Redis 클라이언트 타입
let redis: RedisClientType | null = null;

// Redis 연결 상태
let isConnected = false;

/**
 * Redis 클라이언트 초기화 및 연결
 */
export async function getRedisClient(): Promise<RedisClientType | null> {
  // Redis URL이 없으면 null 반환 (메모리 저장소 사용)
  if (!process.env.KV_URL) {
    console.log('Redis URL not found, using memory storage');
    return null;
  }

  // 이미 연결되어 있으면 기존 클라이언트 반환
  if (redis && isConnected) {
    return redis;
  }

  try {
    // Redis 클라이언트 생성
    redis = createClient({
      url: process.env.KV_URL,
      socket: {
        connectTimeout: 5000,
        reconnectStrategy: (retries) => {
          if (retries > 3) {
            console.error('Redis reconnection failed after 3 attempts');
            return false;
          }
          return Math.min(retries * 100, 3000);
        }
      }
    });

    // 에러 핸들러
    redis.on('error', (err) => {
      console.error('Redis Client Error:', err);
      isConnected = false;
    });

    redis.on('connect', () => {
      console.log('Redis Client Connected');
      isConnected = true;
    });

    redis.on('ready', () => {
      console.log('Redis Client Ready');
    });

    redis.on('end', () => {
      console.log('Redis Client Connection Closed');
      isConnected = false;
    });

    // Redis 연결
    await redis.connect();
    
    // 연결 테스트
    const pong = await redis.ping();
    console.log('Redis connection test:', pong);

    return redis;
  } catch (error) {
    console.error('Failed to connect to Redis:', error);
    redis = null;
    isConnected = false;
    return null;
  }
}

/**
 * Redis 연결 종료
 */
export async function disconnectRedis(): Promise<void> {
  if (redis && isConnected) {
    try {
      await redis.quit();
      redis = null;
      isConnected = false;
      console.log('Redis disconnected');
    } catch (error) {
      console.error('Error disconnecting Redis:', error);
    }
  }
}

/**
 * Redis 연결 상태 확인
 */
export function isRedisConnected(): boolean {
  return isConnected && redis !== null;
}

/**
 * Redis 연결 테스트
 */
export async function testRedisConnection(): Promise<{ connected: boolean; message: string }> {
  try {
    const client = await getRedisClient();
    if (!client) {
      return { connected: false, message: 'Redis URL not configured' };
    }

    const pong = await client.ping();
    return { connected: true, message: pong };
  } catch (error) {
    return { connected: false, message: String(error) };
  }
}
