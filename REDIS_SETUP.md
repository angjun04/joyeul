# Redis (node-redis) 설정 가이드

## 📌 개요
이 프로젝트는 Vercel KV를 직접 Redis 클라이언트(`redis` 패키지)로 접근하여 사용합니다.
더 유연한 Redis 제어와 고급 기능 사용이 가능합니다.

## 🚀 빠른 시작

### 1. 패키지 설치
```bash
# 의존성 설치
npm install

# 또는 개별 설치
npm install redis dotenv
```

### 2. Vercel KV 생성
1. [Vercel Dashboard](https://vercel.com/dashboard) 접속
2. 프로젝트 선택 → **Storage** 탭
3. **Create Database** → **KV** 선택
4. 데이터베이스 이름 입력
5. Region: `Singapore` (한국에서 가장 가까움)
6. **Create** 클릭

### 3. 환경 변수 가져오기
```bash
# Vercel CLI 설치 (없다면)
npm i -g vercel

# Vercel 로그인
vercel login

# 프로젝트 연결
vercel link

# 환경 변수 가져오기
vercel env pull .env.development.local
```

### 4. 연결 테스트
```bash
# Redis 연결 테스트
npm run test-redis

# 개발 서버 실행
npm run dev

# 디버그 페이지 확인
open http://localhost:3000/api/rooms/debug
```

## 📊 상태 확인

### 디버그 엔드포인트 응답 예시
```json
{
  "redis": {
    "configured": true,
    "connected": true,
    "testResult": {
      "connected": true,
      "message": "PONG"
    }
  },
  "storage": {
    "type": "Redis (node-redis)",
    "environment": "development",
    "totalRooms": 2
  }
}
```

## 🏗️ 아키텍처

### 계층 구조
```
┌─────────────────┐
│   Next.js App   │
├─────────────────┤
│   API Routes    │
├─────────────────┤
│  Room Storage   │  ← 비즈니스 로직
├─────────────────┤
│  Storage Layer  │  ← 추상화 계층
├─────────────────┤
│ Redis Client    │  ← Redis 연결 관리
├─────────────────┤
│  Vercel KV      │  ← 실제 데이터베이스
└─────────────────┘
```

### 주요 파일
- `lib/redis-client.ts` - Redis 연결 관리
- `lib/storage.ts` - 스토리지 추상화 및 failover
- `app/api/rooms/*` - API 엔드포인트

## 🔧 고급 기능

### Failover 메커니즘
Redis 연결 실패 시 자동으로 메모리 저장소로 전환:
- Redis 우선 사용
- 실패 시 메모리 백업
- 로그를 통한 상태 추적

### TTL (Time To Live)
방 데이터는 24시간 후 자동 삭제:
```typescript
await redis.setEx(key, 86400, JSON.stringify(data));
```

### 패턴 검색
와일드카드를 사용한 키 검색:
```typescript
const roomKeys = await redis.keys('room:*');
```

## 📝 API 사용법

### 방 생성
```typescript
// POST /api/rooms
const response = await fetch('/api/rooms', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ creatorName: '홍길동' })
});

const { room, userId } = await response.json();
console.log('방 코드:', room.code);
```

### 방 참여
```typescript
// POST /api/rooms/[CODE]/join
const response = await fetch(`/api/rooms/${roomCode}/join`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: '김철수' })
});
```

### 일정 업데이트
```typescript
// PUT /api/rooms/[CODE]/schedule
const response = await fetch(`/api/rooms/${roomCode}/schedule`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: 'user_123',
    schedule: {
      '2024-01-20_10': true,
      '2024-01-20_11': true
    }
  })
});
```

## 🔍 문제 해결

### Redis 연결 실패
```bash
# 환경 변수 확인
cat .env.development.local

# 다시 가져오기
vercel env pull .env.development.local

# 테스트 실행
npm run test-redis
```

### 로컬 개발 팁
- `.env.development.local` - 개발 환경 변수
- `.env.local` - 로컬 환경 변수 (fallback)
- 환경 변수 없으면 자동으로 메모리 저장소 사용

### Vercel Dashboard 확인
1. Storage 탭에서 KV 상태 확인
2. Metrics 탭에서 사용량 모니터링
3. Logs 탭에서 오류 확인

## 💰 비용 최적화

### 무료 티어 활용
- 30,000 요청/월 무료
- 256MB 저장공간
- 256MB 대역폭

### 최적화 팁
1. TTL 설정으로 자동 정리
2. 필요한 데이터만 저장
3. 압축 가능한 데이터는 압축
4. 캐싱 전략 활용

## 🚢 배포

### Vercel 배포
```bash
# 프로덕션 배포
vercel --prod

# 환경 변수는 자동으로 적용됨
```

### 환경별 설정
- **Development**: `.env.development.local`
- **Preview**: Vercel 환경 변수
- **Production**: Vercel 환경 변수

## 📚 참고 자료
- [node-redis 문서](https://github.com/redis/node-redis)
- [Vercel KV 문서](https://vercel.com/docs/storage/vercel-kv)
- [Redis 명령어 참조](https://redis.io/commands)

## 🤝 지원
문제 발생 시:
1. `npm run test-redis` 실행
2. `/api/rooms/debug` 확인
3. Vercel Dashboard Logs 확인
4. GitHub Issues 생성
