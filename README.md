# Editor Page

## 빠른 시작

```bash
npm install
npm run dev
```

기본 개발 서버 주소: `http://localhost:5174`
로그인 시작 프론트 기본값: `http://localhost:3000`
인증 완료 후 최종 이동 기본값: `http://localhost:5174`

## Docker 실행

개발 모드(핫리로드):

```bash
./scripts/run.docker.sh dev up
```

- 주소: `http://localhost:5174`
- 컨테이너 내부 Vite 프록시 `/v1`, `/auth` 대상: `http://host.docker.internal:8080`
- `editor` 서비스에 dev compose 오버레이(`docker/docker-compose.dev.yml`)를 적용해 실행
- `up`은 detached 모드로 뜨고, 로그는 `./scripts/run.docker.sh dev logs`로 확인

운영 모드(Nginx runtime, image-only):

```bash
# 미리 빌드된 이미지를 pull한 뒤 실행
EDITOR_PAGE_IMAGE=123456789012.dkr.ecr.ap-northeast-2.amazonaws.com/prod-editor-page:latest \
./scripts/run.docker.sh prod up
```

- 주소: `http://localhost:8081`
- `editor` 서비스에 prod compose 오버레이(`docker/docker-compose.prod.yml`)를 적용해 실행
- prod `up`은 호스트 빌드를 하지 않고 `docker pull` 후 실행
- 로그는 `./scripts/run.docker.sh prod logs`로 확인

운영 이미지 로컬 빌드 검증:

```bash
EDITOR_PAGE_IMAGE=editor-page:local ./scripts/run.docker.sh prod build
```

- 빌드 전용 compose: `docker/docker-compose.build.yml`
- 운영 실행 compose: `docker/docker-compose.prod.yml`
- CI/CD는 `docker/docker-compose.build.yml`로 이미지를 빌드해 ECR에 push하고, 운영 서버는 `docker/docker-compose.prod.yml`로 이미지를 pull합니다.

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
- 기본 폰트는 SF 계열 시스템 스택 `-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Segoe UI", sans-serif`를 사용합니다.
- 화면 CSS에서는 하드코딩 값보다 `--space-*`, `--control-height-*`, `--layout-*` 같은 변수를 우선 사용합니다.
- 컴포넌트/화면 전용 스타일은 각 feature의 `*.module.css`에 둡니다.

## 최근 UI/UX 변경

- 모바일 GNB는 로고를 메뉴 트리거로 사용하고, LNB는 전체 화면 슬라이드 오버레이로 열립니다.
- 홈/휴지통 목록 상단 헤더는 공용 `DocumentsPageHeader`로 통합되어 모바일에서도 제목과 보기 토글이 한 줄 `space-between` 레이아웃을 공유합니다.
- 문서 목록, 휴지통 목록, LNB 노드, 블록 편집기에서 context menu 중심 조작을 사용합니다.
- 휴지통 상세 라우트 `/delete/:id`는 노출하지 않고, `/delete` 목록에서 복구/완전 삭제를 처리합니다.
- 완전 삭제는 커스텀 confirm 모달과 우측 하단 toast를 사용합니다.
- 최근 상세 변경 내역은 [docs/RECENT_UI_UPDATES.md](./docs/RECENT_UI_UPDATES.md) 에 정리합니다.

## 운영 문서

- 운영 요구사항: [docs/REQUIREMENTS.md](./docs/REQUIREMENTS.md)
- 배포 정책 ADR: [docs/adr/0001-image-only-deployment-on-ec2.md](./docs/adr/0001-image-only-deployment-on-ec2.md)

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

현재 로컬 MSA 기준 기본 gateway는 `http://localhost:8080` 이며, 프론트는 gateway의 `/v1/**` 공개 API를 호출합니다.

운영 Docker 실행에는 아래 값도 사용합니다.

- `EDITOR_PAGE_IMAGE`
- `EDITOR_PAGE_PROD_PORT`

## API 연동 기준

- 기본 API base URL은 `VITE_GATEWAY_BASE_URL` 입니다.
- 로컬 기본값은 `http://localhost:8080` 입니다.
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
-> 5174/auth/callback
-> 5174
```

프론트는 아래 규칙을 따릅니다.

- GitHub 인증 정보를 직접 처리하지 않습니다.
- `/auth/callback` 에서 세션 쿠키가 이미 설정되어 있다고 가정합니다.
- `GET /v1/auth/me` 와 `POST /v1/auth/refresh` 로 로그인 상태를 확정합니다.
- SSO 시작은 `http://localhost:8080/v1/auth/sso/start` 같은 gateway 공개 경로를 사용합니다.
- 연동 계약 문서: [docs/AUTH_REDIRECT_CONTRACT.md](./docs/AUTH_REDIRECT_CONTRACT.md)
