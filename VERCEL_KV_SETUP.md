# Vercel KV (Redis) 설정 가이드

## 📌 개요
이 프로젝트는 Vercel KV (관리형 Redis)를 사용하여 방 정보와 일정 데이터를 저장합니다.
로컬 개발 시에는 메모리 저장소를 사용하며, 프로덕션에서는 자동으로 KV를 사용합니다.

## 🚀 빠른 시작

### 1. Vercel 계정 및 프로젝트 설정
```bash
# Vercel CLI 설치
npm i -g vercel

# Vercel 로그인
vercel login

# 프로젝트 연결
vercel link
```

### 2. Vercel KV 생성
1. [Vercel Dashboard](https://vercel.com/dashboard) 접속
2. 프로젝트 선택 → **Storage** 탭
3. **Create Database** → **KV** 선택
4. 데이터베이스 이름: `joyeul-kv` (또는 원하는 이름)
5. Region: `Singapore` (한국에서 가장 가까움)
6. **Create** 클릭

### 3. 환경 변수 연결
KV 생성 후:
1. **Connect to Project** 클릭
2. 현재 프로젝트 선택
3. 환경 선택 (모두 체크 권장):
   - ✅ Development
   - ✅ Preview  
   - ✅ Production
4. **Connect** 클릭

### 4. 로컬 환경 변수 설정
1. Vercel Dashboard → Storage → KV 데이터베이스 선택
2. **.env.local** 탭 클릭
3. 모든 내용 복사
4. 프로젝트 루트에 `.env.local` 파일 생성 후 붙여넣기

```env
# .env.local 예시
KV_URL=redis://default:AbC123...@useful-fish-12345.kv.vercel-storage.com:12345
KV_REST_API_URL=https://useful-fish-12345.kv.vercel-storage.com
KV_REST_API_TOKEN=AbC123...
```

### 5. 연결 테스트
```bash
# KV 연결 테스트
npm run test-kv

# 개발 서버 실행
npm run dev

# 디버그 페이지 확인 (개발 모드에서만)
open http://localhost:3000/api/rooms/debug
```

## 📊 상태 확인

### 디버그 엔드포인트
개발 모드에서 `/api/rooms/debug` 접속 시:
- KV 연결 상태
- 저장된 방 목록
- 테스트 방 정보
- 환경 변수 설정 상태

### 정상 작동 확인 사항
✅ KV Status: "Connected"  
✅ kvPing: "PONG"  
✅ Storage Type: "Vercel KV (Redis)"

## 🔧 문제 해결

### KV 연결 실패 시
1. **환경 변수 확인**
   ```bash
   # .env.local 파일 확인
   cat .env.local
   ```

2. **Vercel CLI로 환경 변수 가져오기**
   ```bash
   vercel env pull .env.local
   ```

3. **KV 데이터베이스 상태 확인**
   - Vercel Dashboard → Storage에서 상태 확인
   - "Active" 상태인지 확인

### 로컬 개발 시 메모리 저장소 사용
환경 변수가 없으면 자동으로 메모리 저장소 사용:
- 서버 재시작 시 데이터 유지 (global 변수 사용)
- 프로덕션과 동일한 API 인터페이스

## 📝 API 엔드포인트

### 방 생성
```bash
curl -X POST http://localhost:3000/api/rooms \
  -H "Content-Type: application/json" \
  -d '{"creatorName": "홍길동"}'
```

### 방 참여
```bash
curl -X POST http://localhost:3000/api/rooms/TEST1234/join \
  -H "Content-Type: application/json" \
  -d '{"name": "김철수"}'
```

### 방 정보 조회
```bash
curl http://localhost:3000/api/rooms/TEST1234
```

### 일정 업데이트
```bash
curl -X PUT http://localhost:3000/api/rooms/TEST1234/schedule \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user_123",
    "schedule": {
      "2024-01-20_10": true,
      "2024-01-20_11": true
    }
  }'
```

## 🚢 배포

### Vercel로 배포
```bash
# 프로덕션 배포
vercel --prod

# 프리뷰 배포
vercel
```

배포 후 자동으로 KV 사용 (환경 변수가 이미 연결됨)

## 💰 요금 정보

### Vercel KV 무료 티어
- **요청**: 30,000 요청/월
- **대역폭**: 256MB/월
- **저장공간**: 256MB
- **TTL**: 지원 (자동 만료)

### 예상 사용량 (100명 기준)
- 방 생성/참여: ~500 요청
- 일정 업데이트: ~5,000 요청
- 조회: ~10,000 요청
- **총**: ~15,500 요청/월 (무료 티어 내)

## 📚 추가 자료
- [Vercel KV 문서](https://vercel.com/docs/storage/vercel-kv)
- [KV SDK 문서](https://github.com/vercel/storage/tree/main/packages/kv)
- [Redis 명령어](https://redis.io/commands)

## 🤝 지원
문제가 있으시면:
1. `/api/rooms/debug` 엔드포인트 확인
2. `npm run test-kv` 실행
3. Vercel Dashboard의 Function Logs 확인
