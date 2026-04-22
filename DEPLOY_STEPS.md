# 배포 실행 단계 · 개발자 없이 따라하기

> 이 문서는 Cloudflare Pages로 굴업도 아카이브를 배포하는 **실제 클릭·복사·입력** 가이드입니다. 
> 총 소요 시간: 약 90분 ~ 2시간 (처음 하는 경우).
> 중간에 막히면 각 단계 하단의 "⚠️ 막히면" 참고.

---

## 📋 준비물 체크

- [ ] 이메일 (GitHub·Cloudflare·Resend 계정 3개 필요)
- [ ] 휴대폰 (2단계 인증용)
- [ ] Mac/Windows 어느 쪽이든 OK
- [ ] 이 폴더 전체 (`굴업도_프로젝트/`) — 이미 있음
- [ ] 30분 ~ 2시간 여유

---

## Phase 0 · 계정 만들기 (15분)

### 0-1. GitHub 계정
1. https://github.com/signup 접속
2. 이메일 + 비밀번호 입력, 가입
3. 이메일 인증 클릭
4. 좌측 메뉴 **Your repositories** 접근 가능한지 확인

### 0-2. Cloudflare 계정
1. https://dash.cloudflare.com/sign-up 접속
2. 이메일 + 비밀번호 입력, 가입
3. 이메일 인증 → 로그인
4. 좌측 메뉴에 **Workers & Pages** 보이는지 확인

### 0-3. GitHub Desktop 설치 (터미널 없이 Git 쓰기)
1. https://desktop.github.com 에서 다운로드
2. 설치 후 실행 → **Sign in to GitHub.com** → 위 계정으로 로그인

### 0-4. Node.js 설치 (D1 명령어용)
1. https://nodejs.org/ko → **LTS 버전** 다운로드 (20.x 이상)
2. 설치 (기본값으로 다음 계속)
3. 터미널 열기 (Mac: `Cmd+Space` → `Terminal`) → `node -v` 입력 → 버전 나오면 OK

---

## Phase 1 · GitHub에 코드 올리기 (15분)

### 1-1. 리포 생성
1. GitHub 로그인 → 우측 상단 **+** 클릭 → **New repository**
2. 입력:
   - **Repository name**: `gulupdo-archive`
   - **Description**: `굴업도 디지털 아카이브 — 뉴리프`
   - **Public** 선택 (무료 배포를 위해)
   - **Add README**, **Add .gitignore** 둘 다 **체크 안 함** (이미 있음)
3. **Create repository** 클릭

### 1-2. 로컬 폴더를 리포로 연결 (GitHub Desktop)
1. GitHub Desktop 열기
2. **File → Add Local Repository** 클릭
3. 경로 선택: `.../굴업도_프로젝트/03_웹_다큐멘터리` ← **이 폴더만**
4. "This directory doesn't appear to be a Git repository" 경고 → **create a repository** 클릭
5. 저장소 이름 `gulupdo-archive`, 나머지는 기본값 → **Create Repository**
6. 우측 상단 **Publish repository** 클릭 → **Keep this code private**는 체크 해제 → **Publish**

끝. 이제 `github.com/본인계정/gulupdo-archive` 에서 코드가 보입니다.

### ⚠️ 막히면
- GitHub Desktop이 "이미 Git repo"라고 하면 그냥 진행하면 됨
- 파일이 안 올라가면 `.gitignore`에 들어간 파일인지 확인 (`.dev.vars` 등은 정상적으로 제외됨)

---

## Phase 2 · Cloudflare Pages에 연결 (10분)

### 2-1. 리포 연결
1. Cloudflare 대시보드 → 좌측 **Workers & Pages** → **Create** 클릭
2. **Pages** 탭 선택 → **Connect to Git** 클릭
3. **Connect GitHub** → 권한 승인 → `gulupdo-archive` 선택 → **Begin setup**
4. 빌드 설정:
   - **Project name**: `gulupdo-archive`
   - **Production branch**: `main`
   - **Build command**: *(비워둠)*
   - **Build output directory**: `.` (점 하나)
5. **Save and Deploy** 클릭
6. 2~3분 후 `https://gulupdo-archive.pages.dev` 주소로 접속 → **사이트가 뜨는지 확인**

### ⚠️ 막히면
- 사이트에 폼 제출이 아직 동작 안 함 (백엔드 D1 미연결). 페이지만 뜨면 정상
- 이미지 안 뜨면 경로 확인 → `..` 상대경로 이슈일 수 있음 (이미 처리됨)

---

## Phase 3 · D1 데이터베이스 만들기 (15분)

### 3-1. Wrangler 로그인
터미널에서:
```bash
cd "이_파일이_있는_폴더의_절대경로"    # 03_웹_다큐멘터리/ 경로
npx wrangler login
```
- 브라우저가 자동으로 열림 → **Allow** 클릭
- 터미널로 돌아오면 "Successfully logged in"

### 3-2. D1 DB 생성
```bash
npx wrangler d1 create gulupdo-submissions
```
- 결과에 이런 줄이 나옴:
  ```
  [[d1_databases]]
  binding = "DB"
  database_name = "gulupdo-submissions"
  database_id = "abcd1234-5678-..."
  ```
- **`database_id` 값을 복사**

### 3-3. wrangler.toml에 붙여넣기
1. 텍스트 편집기로 `wrangler.toml` 열기
2. 아래 줄을 찾아서:
   ```
   database_id = "여기에_wrangler_d1_create_결과의_id_붙여넣기"
   ```
3. 방금 복사한 실제 ID로 교체:
   ```
   database_id = "abcd1234-5678-..."
   ```
4. 저장

### 3-4. 테이블 만들기
```bash
npx wrangler d1 execute gulupdo-submissions --file=schema.sql --remote
```
- `--remote` 플래그가 있어야 **실제 Cloudflare에 반영**됩니다
- "Executed 4 queries..." 메시지 나오면 성공

### 3-5. GitHub에 변경사항 푸시
GitHub Desktop:
1. 변경된 `wrangler.toml` 자동 감지
2. 좌하단 커밋 메시지 입력: `feat: D1 database_id 연결`
3. **Commit to main** → **Push origin**

### ⚠️ 막히면
- `wrangler: command not found` → `npx wrangler ...` 앞에 `npx` 붙이기
- "Error 10062: Already exists" → 이미 만들었다는 뜻. `npx wrangler d1 list`로 확인 후 ID만 복사해서 쓰기

---

## Phase 4 · Cloudflare에 D1 바인딩 + 환경변수 (15분)

### 4-1. D1 바인딩 연결
1. Cloudflare 대시보드 → **Workers & Pages** → **gulupdo-archive** 선택
2. **Settings** → **Functions** → 하단 **D1 database bindings**
3. **Add binding** 클릭
   - **Variable name**: `DB` (대문자)
   - **D1 database**: `gulupdo-submissions` 선택
4. **Save** 클릭

### 4-2. 환경변수 추가
같은 **Settings** 페이지에서 **Environment variables**:

1. **Add variable** 클릭 → 필수 항목부터:
   - **Variable name**: `IP_SALT`
   - **Value**: 터미널에서 `openssl rand -hex 32` 실행한 결과 (64자 랜덤 문자열)
   - **Type**: **Secret** (암호화)
   - **Save**

2. 나머지 **선택 항목**은 Phase 5·6에서 받은 값을 입력:
   - `TELEGRAM_BOT_TOKEN` (Phase 5)
   - `TELEGRAM_CHAT_ID` (Phase 5)
   - `RESEND_API_KEY` (Phase 6)
   - `RESEND_FROM` — 예: `뉴리프 <onboarding@resend.dev>` (Phase 6 완료 전 기본값)
   - `NOTIFY_EMAIL` — 운영진 수신 이메일 (Phase 6)

### 4-3. 재배포
- **Deployments** 탭 → 가장 최근 배포 우측 **⋯** → **Retry deployment**
- 또는 GitHub Desktop에서 뭐라도 수정 후 push → 자동 재배포

---

## Phase 5 · 텔레그램 봇 (5분, 선택)

운영진 채팅방에 신청이 뜨면 텔레그램에 자동 알림.

### 5-1. 봇 만들기
1. 텔레그램에서 [@BotFather](https://t.me/BotFather) 찾기 → **Start**
2. `/newbot` 입력
3. 봇 표시명: `NewLeaf Gulupdo Alert`
4. 봇 유저네임: `newleaf_gulupdo_alert_bot` (끝에 `_bot` 필수, 유일해야 함)
5. 응답에서 토큰 복사 (예: `1234567890:ABC-XYZ...`)

### 5-2. Chat ID 찾기
1. 운영진이 들어 있는 텔레그램 그룹 만들기 (또는 기존 그룹 사용)
2. 그룹에 위 봇 초대 → **관리자로 승격**
3. [@RawDataBot](https://t.me/RawDataBot)을 그룹에 초대 → 자동으로 메시지 나옴
4. 메시지에서 `"chat":{"id":-100xxxxxx` 부분의 숫자 복사 (마이너스 포함)
5. RawDataBot은 그룹에서 제거

### 5-3. Cloudflare 환경변수에 등록
- `TELEGRAM_BOT_TOKEN` = 5-1에서 받은 토큰
- `TELEGRAM_CHAT_ID` = 5-2의 숫자 (마이너스 포함)

---

## Phase 6 · Resend 이메일 (20분, 선택)

자동회신·운영진 알림 메일용. 이 단계를 건너뛰면 신청자에게 자동 회신 메일이 안 갑니다.

### 6-1. Resend 가입
1. https://resend.com → **Sign Up**
2. 이메일 인증 → 로그인

### 6-2. API Key 발급
1. 좌측 **API Keys** → **Create API Key**
2. 이름: `gulupdo-production`, 권한: **Sending access**
3. 생성된 키 복사 (한 번만 보임)
4. Cloudflare 환경변수 `RESEND_API_KEY`에 입력

### 6-3. 도메인 인증 (도메인 확정 후)
- 도메인 회의 끝나고 결정되면 이 단계 진행
- 그 전에는 Resend 기본 주소 `onboarding@resend.dev`로 테스트 발송 가능
- 도메인 인증하면 `contact@newleaf.kr` 같은 정식 주소로 발송 가능

**인증 방법** (도메인 확정 후):
1. Resend → **Domains** → **Add Domain** → `newleaf.kr` 입력
2. 보여지는 3개 DNS 레코드 (SPF·DKIM·DMARC) 복사
3. Cloudflare → **DNS** → **Records** → 3개 레코드 각각 추가
4. Resend 대시보드에서 **Verify** 클릭 (최대 24시간 소요)
5. 인증되면 `RESEND_FROM` 환경변수를 `뉴리프 <contact@newleaf.kr>` 식으로 변경

### 6-4. NOTIFY_EMAIL 설정
- 운영진 수신 메일 주소 (예: `contact@newleaf.kr` 또는 개인 gmail)
- Cloudflare 환경변수 `NOTIFY_EMAIL`에 입력

---

## Phase 7 · Cloudflare Web Analytics (3분, 선택)

### 7-1. 활성화
1. Cloudflare 대시보드 → **Analytics & Logs** → **Web Analytics**
2. **Add a site** → 사이트 입력 (예: `gulupdo-archive.pages.dev` 또는 도메인)
3. 발급된 스크립트 1줄 복사 (`<script defer src='https://static.cloudflareinsights.com...'>`)

### 7-2. index.html에 삽입
1. 텍스트 편집기로 `index.html` 열기
2. 맨 아래 `</body>` 바로 위에 복사한 스크립트 붙여넣기
3. 저장 → GitHub Desktop 커밋 + push → 자동 재배포
4. Cloudflare Web Analytics 대시보드에서 30분 후 첫 방문 확인

---

## Phase 8 · E2E 테스트 (15분)

### 8-1. 폼 제출 테스트
1. 배포 주소 (`https://gulupdo-archive.pages.dev`) 접속
2. 하단 **함께하기** 섹션까지 스크롤
3. 테스트 데이터 입력 → **뉴리프에 연결하기** 클릭
4. 확인:
   - [ ] "신청이 접수되었습니다" 알림이 뜸
   - [ ] 텔레그램 봇 그룹에 알림 도착 (Phase 5 했으면)
   - [ ] 입력한 이메일로 자동회신 메일 도착 (Phase 6 했으면)
   - [ ] `NOTIFY_EMAIL`로 운영진 알림 도착 (Phase 6 했으면)

### 8-2. D1에서 저장 확인
```bash
npx wrangler d1 execute gulupdo-submissions --remote \
  --command "SELECT id, created_at, name, email, methods FROM submissions ORDER BY id DESC LIMIT 5"
```

### 8-3. 모바일·다른 브라우저 테스트
- 스마트폰 Safari·Chrome
- 다른 PC Chrome·Edge
- 각각 스크롤·폼 제출 확인

### 8-4. 테스트 데이터 정리
```bash
npx wrangler d1 execute gulupdo-submissions --remote \
  --command "DELETE FROM submissions WHERE email LIKE '%test%'"
```

---

## Phase 9 · 커스텀 도메인 (도메인 확정 후, 5분)

### 9-1. DNS 설정
1. 도메인 등록처(가비아·Cloudflare Registrar 등)에서 네임서버를 Cloudflare로 변경 (이미 되어 있으면 skip)
2. Cloudflare 대시보드 → **gulupdo-archive** Pages 프로젝트 → **Custom domains** → **Set up a custom domain**
3. `gulupdo.newleaf.kr` 같은 원하는 주소 입력
4. 자동으로 DNS 레코드 추가됨 → **Activate**
5. 수 분 내 `https://gulupdo.newleaf.kr`로 접속 가능

---

## 📊 운영 모드 (배포 완료 후)

### 일상 모니터링
- **월 1회**: Cloudflare Web Analytics 대시보드에서 방문자 통계 확인
- **주 1회**: D1에서 최근 신청 목록 확인 (위 명령어 활용)
- **수시**: 텔레그램 알림으로 즉시 대응

### D1 데이터 엑셀 내려받기
```bash
npx wrangler d1 export gulupdo-submissions --remote --output=backup.sql
```
또는 SQL 쿼리로 CSV 변환:
```bash
npx wrangler d1 execute gulupdo-submissions --remote \
  --command "SELECT * FROM submissions ORDER BY created_at DESC" --json > submissions.json
```

### 내용 업데이트
- `index.html` 수정 → GitHub Desktop 커밋+push → 1~2분 후 자동 배포
- 사진 추가: `../01_현장사진/` 폴더에 저장 후 `index.html`에서 경로 참조

---

## 🆘 문제 해결

| 증상 | 원인 | 해결 |
|---|---|---|
| 폼 제출 시 "일시적 오류" | 환경변수 미설정 | Cloudflare 대시보드 → Environment variables → IP_SALT 확인 |
| 텔레그램 알림 안 옴 | 봇을 그룹 관리자로 승격 안 함 | 그룹 설정 → 봇을 관리자로 |
| 자동회신 메일 안 옴 | Resend 도메인 미인증 | 초기엔 `onboarding@resend.dev` 사용 OK |
| D1에 데이터 안 쌓임 | DB 바인딩 누락 | Cloudflare → Settings → Functions → D1 bindings 확인 |
| 사이트 배포 실패 | `Build output directory`를 `.`(점)으로 안 함 | Settings → Builds → 수정 |

---

## 📎 핵심 URL 빠른 참조

- GitHub 리포: `https://github.com/본인계정/gulupdo-archive`
- Cloudflare Pages: `https://gulupdo-archive.pages.dev`
- Cloudflare 대시보드: `https://dash.cloudflare.com`
- Resend: `https://resend.com/dashboard`
- 텔레그램 BotFather: `https://t.me/BotFather`

---

## ✅ 배포 완료 체크리스트

- [ ] GitHub 리포 public으로 공개
- [ ] Cloudflare Pages 자동 배포 확인
- [ ] D1 테이블 생성 + 바인딩 연결
- [ ] `IP_SALT` 환경변수 설정
- [ ] 텔레그램 봇 알림 작동
- [ ] Resend 자동회신 작동 (도메인 인증 전까지 `onboarding@resend.dev`로)
- [ ] Web Analytics 스크립트 삽입
- [ ] 모바일 E2E 테스트 통과
- [ ] 개인정보처리방침 `/privacy.html` 접속 확인
- [ ] 도메인 확정 시 커스텀 도메인 연결
- [ ] 운영진 권한 공유 (Cloudflare 팀 초대)
