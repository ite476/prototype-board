# 프로토타입 보드

여러 화면 시안을 직접 살펴보고, 채택한 안과 개발 전에 확인할 내용을 모아두는 재사용 가능한 웹 프로그램입니다.

이 저장소에는 공통 기능과 가상의 예제만 둡니다. 실제 업무 자료, 조직별 설정, 인증정보, 실행 중 생성된 기록은 별도 저장 공간에서 관리합니다.

## 현재 할 수 있는 일

- 채팅의 기획 요청을 스킬·CLI·REST로 접수하고 Markdown·HTML 결과물 저장하기
- 접수·기획·화면 제작·검토 요청 기록을 작업 현황에서 확인하기
- 프로젝트 이름을 눌러 프로젝트를 바꾸기
- 공통 카드에서 주제와 실제 시안의 축소 미리보기 확인하기
- 한 주제의 여러 시안을 바꿔가며 직접 눌러보기
- 시안을 채택하고 통과 목록에서 다시 열기
- 채택을 취소하고 검토 목록으로 되돌리기
- 준비 항목을 확인하고 개발 준비 상태로 이동하기
- 설정, 데이터, 미리보기 컴포넌트, 저장 어댑터를 바꾸어 재사용하기

처음 실행하면 빈 보드입니다. 아래 연결 설정과 프로젝트 생성 후 기획을 접수할 수 있습니다. 가상 예제는 `?demo=1`에서 별도로 엽니다. 통과 목록은 시안 상세 화면에서 채택 버튼을 누르면 채워집니다.

## 로컬 실행

Node.js 22.18 이상이 필요합니다.

```sh
npm ci
npm run build
npm start
```

보드 주소와 포트는 `PROTOTYPE_BOARD_HOST`, `PROTOTYPE_BOARD_PORT`로 정합니다. 화면과 API를 같은 서버에서 제공합니다. 포트가 사용 중이면 다른 포트로 자동 이동하지 않습니다. 데이터 폴더는 `PROTOTYPE_BOARD_DATA_DIR`로 정하며, 생략하면 `~/.local/share/prototype-board/workspaces/personal`을 사용합니다.

`.env.example`을 복사해 실행 환경 설정 파일을 만들거나, `npm start -- --port <보드 포트> --host <바인딩 주소> --data-dir <데이터 폴더>`처럼 일회성 인자를 전달합니다. 실행한 터미널에서 Ctrl+C로 정상 종료하면 폴더 잠금을 해제합니다. 강제 종료 후 `.writer.lock`이 남았으면 기록된 PID·포트·명령을 확인하고 해당 서버가 종료됐다는 것을 확인한 뒤 복구해야 합니다. 자동으로 잠금을 지우지 않습니다.

UI 개발은 저장 서버를 켠 상태에서 `PROTOTYPE_BOARD_WEB_PORT=<웹 포트> PROTOTYPE_BOARD_API_ORIGIN=http://<보드 주소>:<보드 포트> npm run dev`로 실행합니다. Vite 프록시는 `PROTOTYPE_BOARD_API_ORIGIN`을 읽으므로 `vite.config.ts`를 수정할 필요가 없습니다. 브라우저 예제만 보려면 같은 웹 포트 설정으로 `npm run demo`를 사용합니다.

```sh
npm test
npm run build
```

화면 파일은 `dist/`에 생성됩니다. 실제 보드에는 Node 서버가 필요하며 정적 파일만 호스팅하면 저장 API가 동작하지 않습니다. 외부 API·지도·폰트·인증 서비스는 필요하지 않습니다.

### 채팅과 연결하기

서버를 시작한 뒤 `/health`의 `workspaceId`를 확인합니다. 현재 저장소의 `.prototype-board.local.json`이나 개인 설정 디렉터리의 프로필에 보드 주소·식별자·프로젝트를 저장합니다. 이 파일은 Git에 넣지 않습니다.

```json
{
  "baseUrl": "http://<보드 주소>:<보드 포트>",
  "workspaceId": "실행한 서버에서 확인한 값",
  "projectId": "personal"
}
```

```sh
npm run board -- doctor
npm run board -- project-create --file project.json
npm run board -- register --file request.json
```

프로젝트와 요청 JSON 예시는 [명령 설명](.agents/skills/prototype-board/references/commands.md)에 있습니다. 스킬 원본 [.agents/skills/prototype-board](.agents/skills/prototype-board/SKILL.md)를 개인 스킬 디렉터리에 등록하면 다음처럼 기획을 맡길 수 있습니다.

> `$prototype-board` 개인 보드에 이런 기획을 진행하려고 해. 기획 문서와 눌러볼 수 있는 화면 시안을 만들고 링크를 보고해줘.

표시 이름은 **프로토타입 보드**입니다. 현재 호출한 에이전트가 기획을 수행하며 별도 유료 모델을 자동 실행하지 않습니다. 저장소 연결이 없거나 보드가 다르면 내용을 보내지 않고 대상을 확인합니다.

### Docker로 실행

```sh
docker compose up --build -d
```

`PROTOTYPE_BOARD_PORT`로 컨테이너와 호스트 포트를 지정하고, `PROTOTYPE_BOARD_BIND_HOST`로 호스트 바인딩 주소를 지정합니다. `board-data` 볼륨에 파일을 보관합니다. 직접 실행하는 서버와 같은 포트를 동시에 사용하지 마세요. Docker는 선택 사항이고 DB나 Redis는 필요하지 않습니다. 볼륨을 삭제하면 기록도 지워집니다.

## 저장과 보장 범위

기본 보드는 **로컬 파일**에 기획·시안·검토 상태를 저장합니다. 같은 서버에 접속하는 CLI와 화면이 같은 데이터를 봅니다. 요청 중복을 막고, 오래된 검토 내용으로 새 기록을 덮어쓰면 충돌을 알립니다. 브라우저 저장은 `?demo=1` 예제에만 사용합니다.

현재는 로컬 사용자 한 명을 위한 초안입니다. 프로젝트 선택은 인증이나 자료 접근 권한을 대신하지 않습니다. 같은 컴퓨터의 프로그램은 API에 접근할 수 있습니다. 개인/회사 자료는 별도 데이터 폴더·서버·프로필을 사용하세요. 서버가 종료된 상태에서 데이터 폴더 전체를 복사하면 JSON과 연결된 결과물을 함께 백업할 수 있습니다.

아직 포함하지 않은 기능:

- 전체 CRUD UI·기획 수정/삭제·채택 변경 감사 이력
- DB 구현·대용량 최적화·여러 서버가 같은 폴더에 쓰기
- 사용자 인증·조직별 권한·자동 백업/복구
- React 소스 빌드/실행·외부 API를 사용하는 HTML
- 다른 작업의 자동 실행·전달·회신·비용 측정·실제 제품 개발/배포

저장한 HTML은 sandbox와 CSP로 보드 API·외부 통신·브라우저 저장소 접근을 제한합니다. 임의 코드를 안전하게 실행하는 완전한 보안 환경은 아닙니다. [기획 접수 절차](docs/agent-intake.md)와 [내부 구성](docs/architecture.md)을 참고하세요.

## 공통 기능 사용하기

`src/main.tsx`가 저장 API·화면 설정·미리보기를 연결하는 지점입니다. `src/index.ts`에서 공통 진입점과 데이터 타입을 가져올 수 있습니다.

```tsx
<PrototypeBoard
  config={boardConfig}
  initialData={boardData}
  repository={boardRepository}
  previews={previewRegistry}
/>
```

`src/examples/`는 삭제·교체 가능한 가상 예제입니다. 공통 컴포넌트와 데이터 규칙은 예제를 import하지 않습니다. 초기 형태는 소스 수준에서 재사용하는 React 프로그램이며, npm 패키지 배포는 아직 구성하지 않았습니다.

자세한 경계와 후속 작업은 [내부 구성](docs/architecture.md)을 참고하세요.

## 비공개 원본과 사용처

저장소의 기본 관리 방향은 비공개입니다. 공개 라이선스를 선택하거나 npm에 배포하는 절차는 이번 초기 구성에 포함하지 않았습니다.

사용처에서 이 프로그램을 fork하더라도 실제 작업 자료와 비밀 설정은 별도 보관합니다. private fork는 완전히 독립된 자료 보관 경계가 아닙니다. 원본 소유자는 같은 fork 연결망의 저장소를 읽을 수 있고, private 원본 삭제는 private fork에도 영향을 줄 수 있습니다. 조직으로의 private fork는 계정 요금제와 관리자 정책도 확인해야 합니다. [GitHub 공식 안내](https://docs.github.com/en/pull-requests/reference/forks)

자료를 원본 소유자와도 분리해야 하는 경우에는 공통 프로그램만 버전별로 가져오는 독립 저장소나 패키지 의존 방식을 검토합니다. Git 저장소의 공개 여부와 실행 중인 웹 화면의 접근 권한은 별개입니다.
