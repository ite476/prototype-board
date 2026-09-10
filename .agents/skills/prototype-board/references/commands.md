# 로컬 보드 명령

Node.js 22.18 이상을 사용한다. 설치한 스킬의 `scripts/board.mjs`는 외부 패키지가 필요 없다.
아래 `<cli>`는 `node <스킬 절대경로>/scripts/board.mjs`를 뜻한다. 프로젝트 연결 파일이 없는 작업에서는 모든 명령에 `--profile 이름` 또는 `--config 절대경로`를 붙인다.

## 연결 설정

현재 저장소의 무시된 `.prototype-board.local.json` 또는 `~/.config/prototype-board/profiles/이름.json`:

```json
{
  "baseUrl": "http://127.0.0.1:5190",
  "workspaceId": "GET /health에서 확인한 값",
  "projectId": "personal",
  "runtimeDirectory": "/absolute/path/to/dedicated-worktree",
  "dataDirectory": "/absolute/path/to/local-data"
}
```

설정 파일과 저장 데이터는 Git에 넣지 않는다. 처음 실행한 서버의 `/health`로 식별자를 확인하고, 사용자가 의도한 데이터 폴더인지 확인한 뒤 설정한다. 값이 다르다고 자동으로 새 식별자로 바꾸지 않는다.

`<cli> doctor`에서 `ok: true`, `projectExists: true`를 확인한다. 새 프로젝트는 `<cli> project-create --file project.json`으로 만든다:

```json
{ "requestId": "project-personal-001", "id": "personal", "name": "개인 기획", "description": "직접 검토할 아이디어" }
```

## 접수 → 결과물 저장

`request.json`:

```json
{
  "requestId": "idea-unique-001",
  "title": "작업 흐름을 한눈에 보기",
  "summary": "맡긴 기획의 진행 상태와 결과물을 함께 확인합니다.",
  "brief": "누가 무엇을 확인해야 하는지, 기대 결과와 범위를 적습니다.",
  "questions": ["자동 작업 배분은 언제 도입할까요?"],
  "scope": "prototype",
  "actor": "현재 기획 작업"
}
```

```text
<cli> register --file request.json
<cli> event --run RUN_ID --status planning --message "기획을 정리합니다." --request-id unique-planning
<cli> artifact --idea IDEA_ID --run RUN_ID --kind plan --file plan.md --request-id unique-plan-file
<cli> event --run RUN_ID --status drafting --message "화면을 만듭니다." --request-id unique-drafting
<cli> artifact --idea IDEA_ID --run RUN_ID --kind html --file proposal-a.html --label A안 --title "작업 현황" --request-id unique-html-a
<cli> event --run RUN_ID --status review-ready --message "기획과 시안을 저장했습니다." --request-id unique-review
<cli> status --run RUN_ID
```

반환된 `url`은 현재 컴퓨터에서 확인할 로컬 검토 링크다. Jira 등 공유 문서에 그대로 복사하지 않는다. 외부 전달은 [첨부와 공유](product-comparison.md#첨부와-공유)를 따른다. 미정 사항은 기획 문서와 주제 상세에 남긴다. `status`는 읽기 전용이다. 기획 문서만 만드는 범위는 drafting·HTML을 생략할 수 있다.

Before/After는 같은 기능의 변경 전후를 담은 한 결과물로 저장한다. 경쟁하는 A·B안으로 나누지 않는다.

```text
<cli> artifact --idea IDEA_ID --run RUN_ID --kind html --file product-comparison.html --label "제품 적용 · Before/After" --title "기존 화면과 개선 시안 비교" --request-id unique-comparison
```

## 상태와 오류

- queued → planning → drafting → review-ready. planning 범위는 planning → review-ready도 가능하다.
- queued/planning/drafting → blocked 또는 cancelled. blocked → planning/drafting/cancelled.
- review-ready와 cancelled는 마지막 상태다. 재작업은 새 접수로 남긴다.
- 409 요청 식별자 충돌: 같은 ID로 다른 내용을 보내지 않는다.
- 409 검토 저장 충돌: 최신 보드를 다시 읽고 사용자의 의도를 재확인한다.
- 연결 실패: 설정된 포트와 프로세스·데이터 폴더를 확인한다. 다른 프로세스를 종료하지 않는다.
- 잠금 파일이 남음: 서버가 실제로 종료됐는지 확인한 뒤 사용자에게 복구를 제안한다. 자동 삭제하지 않는다.

REST는 GET `/health`, GET `/api/board`, POST `/api/projects`, POST `/api/ideas`, POST `/api/runs/:id/events`, POST `/api/ideas/:id/artifacts`, POST `/api/review`, GET `/api/artifacts/:id`를 제공한다.
POST에는 JSON, `X-Prototype-Board: 1`, `X-Prototype-Board-Workspace: 보드식별자`, `requestId`가 필요하다. HTML·Markdown 내용은 CLI가 파일에서 읽어 전송한다. 결과물 내용은 최대 500,000자, HTTP 요청은 최대 2MB다.

## 공통 기획과 여러 표현물 저장

공통 기획은 `plan.md`, 필요한 구조화 자료는 `core.json`, 연결 명세는 `adapter-manifest.json`으로 저장할 수 있다. 코어와 연결 명세는 `artifact --kind source`를 사용한다. 제품 HTML과 발표 HTML은 같은 idea/run에서 각각 `--kind html --label "제품 적용"`, `--label "발표용 흐름"`으로 추가한다. 이는 API에 새로운 종류를 추가하는 기능이 아니라 기존 저장 형식을 사용하는 작업 규칙이다.

현재 PPTX는 업로드 형식에 없다. 발표 HTML만 보드에 저장하고 PPTX는 별도 로컬 파일 링크로 전달한다. 보드에 저장되지 않은 파일은 URL을 만들어 전달하거나 업로드 완료로 보고하지 않는다.

## 새 업무용 프로필 구성

사용자가 프로필 생성을 명시하면 이름만 별도로 만든 개인 프로젝트가 아니라 저장 폴더와 실행 worktree도 분리한다. 설치된 CLI에는 profile-create 명령이 없으므로 새 설정 JSON을 작성한다. 기존 파일은 덮어쓰지 않는다.

준비한 포트가 비어 있는지 확인하고, 읽어 확인한 서버 코드를 전용 worktree에서 빌드해 해당 dataDirectory로 시작한다. 새 서버의 /health에서 받은 workspaceId를 설정에 기록한다. projectId는 실제 대상 프로젝트로 두고 doctor → 필요 시 project-create → doctor 순서로 확인한다. profile 이름이 회사명이더라도 개인 데이터 폴더를 가리키면 분리된 업무용 보드로 보지 않는다.
