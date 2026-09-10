# 로컬 보드 명령

Node.js 22.18 이상을 사용한다. 설치한 스킬의 `scripts/board.mjs`는 외부 패키지가 필요 없다.
아래 `<cli>`는 `node <스킬 절대경로>/scripts/board.mjs`를 뜻한다. 프로젝트 연결 파일이 없는 작업에서는 모든 명령에 `--profile 이름` 또는 `--config 절대경로`를 붙인다.

## 연결 설정

현재 저장소의 무시된 `.prototype-board.local.json` 또는 `~/.config/prototype-board/profiles/이름.json`:

```json
{
  "baseUrl": "http://<보드 주소>:<보드 포트>",
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

반환된 `url`을 그대로 보고한다. 미정 사항은 기획 문서와 주제 상세에 남긴다. `status`는 읽기 전용이다. 기획 문서만 만드는 범위는 drafting·HTML을 생략할 수 있다.

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
