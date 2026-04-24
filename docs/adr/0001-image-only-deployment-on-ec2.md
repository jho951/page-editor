# ADR 0001: EC2를 Image 실행 서버로 고정한다

- 상태: Accepted
- 날짜: 2026-04-24

## Context

기존에는 운영 서버에서 소스 코드를 직접 가져와 실행하는 방식도 선택지로 볼 수 있었습니다. 하지만 `editor-page`는 프론트엔드 앱이고, 운영 환경에서는 build/runtime 책임을 분리하는 편이 더 단순합니다.

현재 저장소에는 이미 아래 운영 자산이 존재합니다.

- Docker image build 설정
- `docker-compose`
- `.env` 예시 파일
- `nginx.conf`

이 구조를 기준으로 보면 운영 EC2는 소스 실행 서버보다 이미지 실행 서버로 두는 편이 일관성이 높습니다.

## Decision

운영 EC2는 앱 소스를 clone 하지 않습니다.

운영 배포는 아래 원칙을 따릅니다.

- `editor-page` 저장소는 Docker image build와 배포 템플릿을 관리합니다.
- 운영 EC2는 배포용 파일과 환경 변수만 보관합니다.
- 운영 EC2는 `docker compose pull && docker compose up -d` 방식으로 이미지를 실행합니다.
- 호스트 Nginx가 컨테이너 앞단 reverse proxy 역할을 맡습니다.

즉 운영 EC2는 "소스 실행 서버"가 아니라 "이미지 실행 서버"로 둡니다.

## Consequences

### 장점

- 운영 서버에 소스 코드와 빌드 도구를 둘 필요가 없습니다.
- 배포 절차가 `pull -> up`으로 단순해집니다.
- 빌드 실패와 런타임 실패의 경계가 명확해집니다.
- 운영 환경을 재현하거나 교체하기 쉬워집니다.

### 비용

- 이미지 빌드와 배포 파이프라인을 분리해 관리해야 합니다.
- `.env.production.example`, compose, nginx 설정이 실제 운영 정책과 계속 동기화되어야 합니다.
- EC2에서 임시 소스 수정으로 문제를 우회하는 방식은 허용하지 않습니다.

## Follow-up

- `docs/REQUIREMENTS.md`에 같은 정책을 운영 요구사항으로 유지합니다.
- README와 배포 스크립트 설명도 image-only 운영 모델과 충돌하지 않게 유지합니다.
- 운영 템플릿 파일 변경 시 ADR 결정과 상충하는지 검토합니다.
