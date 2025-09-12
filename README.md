# 조율 (Joyeul) - 팀 일정 조율 서비스

실시간으로 팀원들과 일정을 조율할 수 있는 웹 서비스입니다.

## 🚀 주요 기능

- **방 시스템**: 고유한 방 코드로 일정 조율 세션 관리
- **실시간 동기화**: 3초마다 자동으로 다른 참여자들의 일정 업데이트
- **최적 시간대 추천**: 가장 많은 인원이 가능한 시간대 TOP 5 표시
- **직관적인 UI**: 색상으로 구분되는 시간대 표시
  - 회색: 선택 안됨
  - 보라색: 내가 선택한 시간
  - 주황색: 일부 참여 가능
  - 초록색: 전원 참여 가능 (애니메이션 효과)
- **반응형 디자인**: 모바일, 태블릿, 데스크톱 모두 지원
- **Vercel 배포 지원**: 메모리 또는 Vercel KV 저장소 선택 가능

## 💻 기술 스택

- **Framework**: Next.js 15.5.3 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **State Management**: SWR (실시간 데이터 동기화)
- **Storage**: 메모리 (개발) / Vercel KV (프로덕션 옵션)
- **Runtime**: React 19.1.0

### ⚠️ Next.js 15 주의사항
Next.js 15부터 동적 라우트의 `params`가 Promise로 변경되어 `await`가 필수입니다.

## 🛠️ 설치 및 실행

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev

# 프로덕션 빌드
npm run build
npm start
```

개발 서버는 http://localhost:3000 에서 실행됩니다.

## 📖 사용 방법

### 1. 방 만들기
- 이름 입력 후 "새 방 만들기" 클릭
- 자동으로 생성된 방 코드를 팀원들에게 공유

### 2. 방 참여하기
- 공유받은 방 코드와 본인 이름 입력
- "참여하기" 버튼 클릭

### 3. 일정 선택
- "내 일정 편집" 모드에서 가능한 시간대 클릭
- 선택된 시간은 보라색 그라데이션으로 표시

### 4. 전체 일정 확인
- "전체 일정 보기"로 모든 참여자의 가능 시간 확인
- 하단의 최적 시간대에서 가장 많은 인원이 가능한 시간 확인

## 🐛 디버깅

### 테스트 방 사용
개발 환경에서는 항상 사용 가능한 테스트 방이 있습니다:
- **방 코드**: `TEST1234`
- **API**: http://localhost:3000/api/rooms/debug

### 콘솔 로그 확인
브라우저 개발자 도구에서 다음 로그를 확인할 수 있습니다:
- `Room created:` - 방 생성 시
- `Joined room:` - 방 참여 시
- `Storage GET/SET:` - 저장소 작업 시

### 일반적인 문제 해결

#### "방을 찾을 수 없습니다" 오류
1. **개발 서버 재시작**: 메모리 저장소가 초기화되었을 수 있습니다
2. **테스트 방 사용**: `TEST1234` 코드로 테스트
3. **브라우저 캐시 삭제**: 강제 새로고침 (Ctrl+F5)

#### 일정이 저장되지 않는 경우
1. 콘솔에서 네트워크 오류 확인
2. 개발자 도구 > Network 탭에서 API 응답 확인
3. `debug-test.js` 스크립트로 API 테스트

## 🚀 Vercel 배포

### 빠른 배포 (메모리 저장소)
```bash
npm i -g vercel
vercel
```

### Vercel KV 사용 (선택사항)
1. Vercel Dashboard에서 프로젝트 선택
2. Storage 탭 → Create Database → KV 선택
3. 환경 변수가 자동 설정됨

자세한 내용은 [DEPLOY.md](./DEPLOY.md) 참고

## 🔧 API 엔드포인트

- `POST /api/rooms` - 새로운 방 생성
- `GET /api/rooms/[code]` - 방 정보 조회
- `POST /api/rooms/[code]/join` - 방 참여
- `PUT /api/rooms/[code]/schedule` - 일정 업데이트
- `GET /api/rooms/debug` - 디버그 정보 (개발 환경만)

## 📅 향후 계획

- [ ] 데이터베이스 연동 (PostgreSQL/Supabase)
- [ ] WebSocket을 통한 실시간 업데이트
- [ ] 사용자 인증 기능
- [ ] 일정 내보내기 (Google Calendar 연동)
- [ ] 다양한 시간 단위 선택 (30분 단위)
- [ ] 날짜 범위 커스터마이징
- [ ] 카카오톡 공유 기능
- [ ] PWA 지원

## 🤝 기여하기

이슈 제보나 기능 제안은 GitHub Issues를 통해 해주세요.

## 📄 라이선스

MIT License
