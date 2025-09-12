# Vercel 배포 가이드

## 🚀 Vercel에 배포하기

### 1. 로컬에서 테스트
```bash
npm install
npm run dev
```
로컬에서는 메모리 저장소를 사용하므로 KV 설정 없이도 작동합니다.

### 2. Vercel에 배포

#### 방법 1: Vercel CLI 사용
```bash
npm i -g vercel
vercel
```

#### 방법 2: GitHub 연동
1. GitHub에 코드 푸시
2. [Vercel Dashboard](https://vercel.com/dashboard)에서 "New Project" 클릭
3. GitHub 저장소 선택
4. 배포 설정은 기본값 사용

### 3. Vercel KV 설정 (선택사항)

현재 코드는 **Vercel KV 없이도 작동**하도록 설계되었습니다. 
- 로컬 개발: 메모리 저장소 사용
- Vercel 배포 (KV 미설정): 메모리 저장소 사용 (제한사항 있음)
- Vercel 배포 (KV 설정): Redis 기반 영구 저장소 사용

#### Vercel KV 활성화 방법:
1. Vercel Dashboard에서 프로젝트 선택
2. "Storage" 탭 클릭
3. "Create Database" → "KV" 선택
4. 데이터베이스 이름 입력 (예: joyeul-kv)
5. 환경 변수가 자동으로 설정됨

### 4. 환경 변수 확인
Vercel KV를 생성하면 다음 환경 변수가 자동으로 추가됩니다:
- `KV_URL`
- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`

### 5. 배포 확인
```
https://your-project.vercel.app
```

## ⚠️ 제한사항

### KV 없이 배포한 경우:
- 각 API 함수가 5-10분 후 종료되며 데이터가 사라짐
- 트래픽이 많으면 여러 인스턴스가 생성되어 데이터가 동기화되지 않음
- 테스트나 데모용으로만 적합

### KV 사용 시:
- 데이터가 24시간 동안 유지됨 (코드에서 설정한 TTL)
- 모든 인스턴스가 동일한 데이터 접근
- 무료 티어: 일일 3,000개 명령, 256MB 저장소

## 🛠️ 문제 해결

### "Room not found" 오류가 자주 발생하는 경우
→ KV 설정을 확인하거나, Vercel KV를 활성화하세요.

### 배포 후 접속이 안 되는 경우
→ Vercel Dashboard에서 Functions 탭의 로그를 확인하세요.

### 환경 변수가 작동하지 않는 경우
→ 환경 변수 설정 후 재배포가 필요합니다.

## 📝 추가 설정

### 커스텀 도메인 연결
1. Vercel Dashboard → Settings → Domains
2. 도메인 추가 및 DNS 설정

### 프로덕션 최적화
```json
// vercel.json (선택사항)
{
  "functions": {
    "app/api/rooms/*/route.ts": {
      "maxDuration": 10
    }
  }
}
```

## 🔗 유용한 링크
- [Vercel KV 문서](https://vercel.com/docs/storage/vercel-kv)
- [Next.js on Vercel](https://vercel.com/docs/frameworks/nextjs)
