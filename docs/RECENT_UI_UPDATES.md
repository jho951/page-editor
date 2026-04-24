# Recent UI Updates

## 범위

이 문서는 `editor-page`의 최근 FE 변경 사항을 화면/동작 기준으로 정리합니다. 세부 구현 파일은 대표 경로만 적었습니다.

## 1. 전역 UI 인프라

- 커스텀 `ContextMenuHost`를 추가해 craft 스타일에 가까운 context menu를 공통 사용합니다.
  - 위치: `src/app/provider/ContextMenuHost.tsx`
- 커스텀 `ConfirmHost`를 추가해 시스템 `alert/confirm` 대신 앱 모달을 사용합니다.
  - 위치: `src/app/provider/ConfirmHost.tsx`
- 우측 하단 `ToastHost`를 추가해 삭제/오류 피드백을 일관되게 표시합니다.
  - 위치: `src/app/provider/ToastHost.tsx`
- 전역 UI 상태에 `contextMenu`, `confirm`, `toast`를 포함합니다.
  - 위치: `src/app/state/ui.slice.ts`

## 2. 타이포와 공통 스타일

- 글로벌 기본 폰트를 SF 계열 시스템 스택으로 변경했습니다.
  - 위치: `src/assets/styles/class.css`
- 에디터 기본 텍스트 크기를 아래 기준으로 통일했습니다.
  - paragraph: `1.6rem`
  - heading1: `2.2rem`
  - heading2: `2.0rem`
  - heading3: `1.8rem`
  - 위치: `src/features/editor/ui/block-editor/BlockEditor.module.css`
- 문서 상세, 홈, 휴지통의 메인 타이틀 크기를 `2.2rem` 기준으로 맞췄습니다.

## 3. 에디터

- 블록 편집기 좌측 rail 액션은 `Icon` 컴포넌트와 SVG 아이콘으로 통일했습니다.
- 블록 context menu는 트리거 왼쪽에 표시하고, 메뉴 바깥 클릭 시 닫힙니다.
- `Cmd/Ctrl + A`는 텍스트 입력 중일 때 브라우저/textarea의 기본 전체 선택을 유지합니다.
- `Cmd/Ctrl + S` 앱 저장 단축키는 제거해 브라우저 기본 동작을 막지 않습니다.
- 문서 상세 레이아웃 폭은 홈 화면 기준에 맞춰 확장했습니다.

## 4. 홈 화면

- 홈 상단은 `DocumentsPageHeader`를 사용합니다.
  - 제목: `전체 문서`
  - 보기 전환: `list / grid`
- 모바일에서는 제목과 토글이 한 줄 `space-between`으로 정렬되고, 토글 크기도 축소됩니다.
- 우측 상단 `+` 버튼으로 새 문서를 생성합니다.
- 문서 카드 우클릭 context menu를 지원합니다.
  - `새 문서`
  - `새 탭에서 열기`
  - `삭제`

## 5. 휴지통

- `/delete/:id` 상세 페이지는 직접 노출하지 않고 `/delete` 목록 중심으로 사용합니다.
- 휴지통 상단도 `DocumentsPageHeader`를 사용합니다.
  - 제목: `휴지통`
  - 부제: `5분 후 삭제됩니다`
- 카드/리스트 문서 항목 우클릭 시 context menu를 사용합니다.
  - `복구`
  - `완전 삭제`
- 완전 삭제 전에는 커스텀 confirm 모달을 띄우고, 성공 후에는 목록 refresh와 우측 하단 toast를 보여줍니다.

## 6. LNB

- 루트 섹션 이름을 `개인 페이지`에서 `모든 문서`로 변경했습니다.
- 루트 아이콘은 `allDocs.svg`를 사용합니다.
- 문서 기본 아이콘은 craft 느낌의 종이 프리뷰형 SVG로 교체했습니다.
- 인라인 우측 액션 UI를 제거하고 우클릭 context menu 중심으로 정리했습니다.
- 루트/노드 context menu에서 새 문서 생성, 새 탭 열기, 이동, 삭제 흐름을 사용합니다.
- 문서 drag-and-drop 이동을 지원합니다.
  - `before / after / inside`
  - 루트 가상 id는 이동 API 전에 `null` parent로 정규화합니다.

## 7. GNB / 모바일 내비게이션

- 문서 상세 GNB 우측 공유 버튼은 제거했습니다.
- 프로필 메뉴는 `로그아웃`만 유지합니다.
- 로그아웃 시 explain-page 시작 주소로 리다이렉트합니다.
- 모바일에서는 GNB 좌측 로고가 메뉴 트리거 역할을 합니다.
- 모바일 메뉴는 햄버거 드롭다운 대신 전체 화면 슬라이드 오버레이를 사용합니다.
  - 오버레이 안에 닫기 버튼과 현재 LNB를 렌더링합니다.
  - 모바일 헤더/오버레이의 로고 크기는 PC LNB 로고와 동일한 `40px` 기준입니다.

## 8. Not Found

- `not-found`는 explain-page 스타일의 타일형 404 화면으로 교체했습니다.
- 레이아웃은 중앙 정렬로 조정했고 전체 스케일은 약간 축소했습니다.

## 9. 관련 대표 파일

- `src/app/router/AppRouter.tsx`
- `src/app/provider/ContextMenuHost.tsx`
- `src/app/provider/ConfirmHost.tsx`
- `src/app/provider/ToastHost.tsx`
- `src/features/home/HomeView.tsx`
- `src/features/trash/TrashView.tsx`
- `src/features/document/ui/header/DocumentsPageHeader.tsx`
- `src/features/layout/ui/lnb/Lnb.tsx`
- `src/features/layout/ui/gnb/Gnb.tsx`
- `src/features/editor/ui/block-editor/BlockEditor.tsx`
