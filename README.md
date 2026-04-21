# Editor Page

## 빠른 시작

```bash
npm install
npm run dev
```

기본 개발 서버 주소: `http://127.0.0.1:5173`

## Docker 실행

개발 모드(핫리로드):

```bash
./scripts/run.docker.sh dev up
```

- 주소: `http://127.0.0.1:5173`
- 컨테이너 내부 Vite 프록시 `/v1`, `/auth` 대상: `http://host.docker.internal:8080`
- `editor` 서비스에 dev compose 오버레이(`docker/docker-compose.dev.yml`)를 적용해 실행
- `up`은 detached 모드로 뜨고, 로그는 `./scripts/run.docker.sh dev logs`로 확인

배포 모드(정적 빌드 + Nginx):

```bash
./scripts/run.docker.sh prod up
```

- 주소: `http://127.0.0.1:8081`
- `editor` 서비스에 prod compose 오버레이(`docker/docker-compose.prod.yml`)를 적용해 실행
- `up`은 detached 모드로 뜨고, 로그는 `./scripts/run.docker.sh prod logs`로 확인

로컬 실행:

```bash
./scripts/run.local.sh dev
```

## 구조

- `src` 아래에 실행 코드를 모읍니다. 루트에는 설정 파일과 문서만 둡니다.
- `src/app`: 앱 진입부, 라우터, 전역 조립
- `src/assets`: 전역 스타일, 폰트, 아이콘
- `src/features`: 기능 단위 모듈
- `src/shared`: 공통 UI, util, hooks

### 페이지 레이어 규칙

- `src/app/pages`는 라우트 엔트리만 둡니다.
- 페이지 파일은 가능한 한 `return <SomeFeatureView />;` 수준의 얇은 래퍼로 유지합니다.
- 실제 화면 구현, 상태, 페이지별 스타일은 `src/features/*/ui/*View.tsx`로 둡니다.
- 예시:
  - `src/app/pages/home/HomePage.tsx`
  - `src/features/home/ui/HomeView.tsx`

### 스타일 규칙

- spacing, padding, height, 기본 폰트 같은 전역 토큰은 `src/assets/styles/class.css`에서 관리합니다.
- 기본 폰트는 `--base-font: 'Pretendard', sans-serif;`를 사용합니다.
- 화면 CSS에서는 하드코딩 값보다 `--space-*`, `--control-height-*`, `--layout-*` 같은 변수를 우선 사용합니다.
- 컴포넌트/화면 전용 스타일은 각 feature의 `*.module.css`에 둡니다.

### TypeScript 설정

- `tsconfig.json`: 프로젝트 참조 진입점입니다.
- `tsconfig.app.json`: 브라우저에서 실행되는 앱 코드용입니다.
  - `src`를 포함합니다.
  - DOM 타입과 React JSX 설정을 사용합니다.
  - `@app`, `@assets`, `@features`, `@shared` alias를 정의합니다.
- `tsconfig.node.json`: Node 환경에서 실행되는 설정 파일용입니다.
  - 현재는 `vite.config.ts`를 대상으로 합니다.
  - Node 타입을 사용합니다.

## 개발 환경

[`.env`](.env.example)

현재 로컬 MSA 기준 기본 gateway는 `http://127.0.0.1:8080` 이며, 프론트는 gateway의 `/v1/**` 공개 API를 호출합니다.

## API 연동 기준

- 기본 API base URL은 `VITE_GATEWAY_BASE_URL` 입니다.
- 로컬 기본값은 `http://127.0.0.1:8080` 입니다.
- 개발 서버에서 상대 경로로 호출할 경우 Vite proxy가 `/v1/**`, legacy `/auth/**`를 `VITE_API_PROXY_TARGET`으로 전달합니다.
- 문서 목록 계약:
  - `GET /v1/documents`
- 문서/블록 계약:
  - `GET /v1/documents/{documentId}`
  - `GET /v1/documents/{documentId}/blocks`
  - `PATCH /v1/documents/{documentId}`
  - `PATCH /v1/documents/{documentId}/trash`
  - `POST /v1/documents/{documentId}/restore`
  - `PATCH /v1/documents/{documentId}/visibility`
  - `POST /v1/editor-operations/documents/{documentId}/save`
  - `POST /v1/editor-operations/move`
- 응답 포맷은 배열 자체 또는 아래 래퍼 구조를 허용합니다.
  - `{ data }`
  - `{ items }`
  - `{ rows }`
  - `{ data: { items | rows | data } }`
- 서버가 없거나 응답이 실패하면 로컬 mock catalog로 자동 fallback 됩니다.

## 인증 흐름

```text
3000/signin
-> 8080/v1/auth/sso/start
-> GitHub
-> 8080/v1/login/oauth2/code/github
-> 5173/auth/callback
```

프론트는 아래 규칙을 따릅니다.

- GitHub 인증 정보를 직접 처리하지 않습니다.
- `/auth/callback` 에서 세션 쿠키가 이미 설정되어 있다고 가정합니다.
- `GET /v1/auth/me` 와 `POST /v1/auth/refresh` 로 로그인 상태를 확정합니다.
- SSO 시작은 `http://127.0.0.1:8080/v1/auth/sso/start` 같은 gateway 공개 경로를 사용합니다.
- 연동 계약 문서: [docs/AUTH_REDIRECT_CONTRACT.md](./docs/AUTH_REDIRECT_CONTRACT.md)
