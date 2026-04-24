# Requirements

## 목적

`editor-page` 저장소의 운영 역할과 배포 방식을 명확히 정의합니다.

## 운영 배포 원칙

- 이 저장소는 소스 실행 서버용 저장소가 아니라 배포용 이미지 산출 저장소로 사용합니다.
- 운영 EC2에는 앱 소스 코드를 clone 하지 않습니다.
- 운영 EC2는 배포용 파일과 환경 변수만 보관하고, Docker image를 pull 받아 실행합니다.
- 운영 배포는 `docker compose pull && docker compose up -d` 흐름을 기본으로 합니다.
- EC2 앞단에는 호스트 Nginx가 있고, Nginx가 컨테이너로 reverse proxy 합니다.

## 이 저장소의 역할

- Docker image build
- 배포용 템플릿 관리
- `docker-compose` 관리
- `.env.production.example` 관리
- `nginx.conf` 관리

## EC2의 역할

- 앱 레포 clone 안 함
- 배포용 파일만 보관
- `docker compose pull && up -d`
- Nginx가 컨테이너 앞단 프록시

## 기대 효과

- 운영 서버에서 소스 코드와 빌드 도구 의존성을 제거할 수 있습니다.
- 배포 절차가 image pull 기준으로 단순해집니다.
- 실행 환경과 빌드 환경의 책임이 분리됩니다.
- EC2는 "소스 실행 서버"가 아니라 "이미지 실행 서버"로 유지됩니다.

## 산출물 기준

- 이 저장소는 운영에서 필요한 compose, env 예시, nginx 설정, image build 설정을 함께 관리해야 합니다.
- 운영 서버는 이 저장소의 source tree를 실행하지 않고, 빌드된 이미지만 사용해야 합니다.
- 배포 자동화 또는 수동 배포 문서도 위 정책과 충돌하지 않아야 합니다.
