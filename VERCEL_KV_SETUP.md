# Vercel KV 설정 가이드

## 1. Vercel KV 스토리지 생성

1. [Vercel Dashboard](https://vercel.com/dashboard)에 로그인
2. **Storage** 탭 클릭
3. **Create Database** 클릭
4. **KV** 선택
5. 데이터베이스 이름 입력 (예: `joyeul-kv`)
6. Region 선택 (한국이면 `apac` 권장)
7. **Create** 클릭

## 2. 환경 변수 설정

### 방법 1: Vercel Dashboard에서 복사
1. Vercel Dashboard > Storage > 생성한 KV 선택
2. **`.env.local`** 탭 클릭
3. 모든 내용 복사
4. 프로젝트의 `.env.local` 파일에 붙여넣기

### 방법 2: Vercel CLI 사용
```bash
vercel env pull .env.local
```

## 3. 필수 환경 변수

`.env.local` 파일에 다음 3개 변수가 모두 필요합니다:

```env
# Redis 연결 URL
KV_URL=redis://...

# REST API URL
KV_REST_API_URL=https://...

# REST API 토큰
KV_REST_API_TOKEN=...
```

## 4. 프로덕션 배포

Vercel에 배포할 때는 자동으로 연결됩니다:

1. **Settings** > **Environment Variables**
2. KV 데이터베이스가 자동으로 연결되어 있는지 확인
3. 없다면 Storage 탭에서 프로젝트와 연결

## 5. 확인 방법

### 로컬 개발 환경
```bash
npm run dev
# 브라우저에서 http://localhost:3000/api/storage-test 접속
```

### 프로덕션
```
https://your-app.vercel.app/api/storage-test
```

## 문제 해결

### "Vercel KV가 설정되지 않았습니다" 메시지
- `.env.local` 파일에 3개 환경 변수가 모두 있는지 확인
- 개발 서버 재시작 (`npm run dev`)

### 데이터가 사라지는 문제
- Vercel KV가 연결되지 않아 메모리 저장소를 사용 중
- 위 설정 방법을 따라 Vercel KV 연결

### 비용
- Vercel KV는 프리 티어에서 제한적으로 무료
- 소규모 프로젝트에는 충분함
- 자세한 내용은 [Vercel Pricing](https://vercel.com/pricing) 참고
