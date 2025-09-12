# Runtime TypeError 해결 가이드

## 최신 업데이트 (Next.js 15)

### Dynamic Route Params 변경사항
Next.js 15부터 동적 라우트의 `params`가 Promise로 변경되었습니다.

**변경 전:**
```typescript
export async function GET(
  request: NextRequest,
  { params }: { params: { code: string } }
) {
  const { code } = params; // ❌ 오류 발생
}
```

**변경 후:**
```typescript
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params; // ✅ 올바른 사용
}
```

## 오류 설명
`Cannot read properties of undefined (reading 'user_xxx')` 오류는 방(room) 데이터의 participants 객체가 undefined일 때 발생합니다.

## 수정 사항

### 1. **클라이언트 사이드 (page.tsx)**
- participants 접근 시 optional chaining 사용
- fetcher 함수에 데이터 검증 추가
- useEffect에 데이터 구조 확인 로직 추가

### 2. **서버 사이드 (API routes)**
- 모든 API 응답에서 participants 존재 확인
- room 데이터 반환 전 정규화

### 3. **저장소 레이어 (storage.ts)**
- normalizeRoom 함수로 데이터 구조 보장
- participants가 없으면 빈 객체로 초기화

## 디버깅 방법

### 1. 브라우저 콘솔에서 확인
```javascript
// 현재 방 상태 확인
console.log(currentRoom);

// participants 확인
console.log(currentRoom?.participants);
```

### 2. debug-test.js 사용
```bash
# 브라우저 콘솔에서 실행
runFullTest();
```

### 3. Vercel 로그 확인
Vercel Dashboard → Functions 탭에서 오류 로그 확인

## 일반적인 원인

1. **Vercel KV 직렬화 문제**
   - KV는 JSON으로 직렬화/역직렬화
   - undefined 값은 제거될 수 있음

2. **동시성 문제**
   - 여러 사용자가 동시에 접근
   - 데이터 일관성 문제 발생 가능

3. **네트워크 타이밍**
   - SWR 캐시와 실제 데이터 불일치
   - 폴링 중 데이터 변경

## 추가 보안 조치

만약 문제가 지속되면:

1. **전체 재배포**
   ```bash
   vercel --prod
   ```

2. **Vercel KV 재설정**
   - Storage 탭에서 KV 삭제 후 재생성

3. **환경 변수 확인**
   - KV 관련 환경 변수가 올바르게 설정되었는지 확인

## 임시 해결책

로컬 개발 시:
```bash
# KV 없이 메모리만 사용
npm run dev
```

프로덕션에서 문제 발생 시 Vercel KV를 일시적으로 비활성화하고 메모리 저장소만 사용하도록 환경 변수 제거.
