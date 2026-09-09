import { mkdir, open, readFile, rename, rm, realpath } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { randomUUID } from 'node:crypto';
import { validateBoard } from '../src/core/board.ts';

/**
 * 한 서버만 저장 폴더를 소유한다. 명령을 직렬로 처리하고 새 스냅샷을 rename으로 반영한다.
 * 향후 DB 구현도 read/transaction 계약을 제공하면 서비스와 HTTP 계층을 유지할 수 있다.
 * 죽은 서버의 lock은 자동으로 지우지 않는다. PID 확인 후 명시적으로 복구해야 한다.
 */
export class FileStore {
  constructor(directory) { this.directory = directory; this.tail = Promise.resolve(); }
  async open() {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    this.directory = await realpath(this.directory);
    this.lockPath = join(this.directory, '.writer.lock');
    try { this.lock = await open(this.lockPath, 'wx', 0o600); }
    catch { throw new Error('저장 폴더를 다른 서버가 사용 중이거나 잠금 파일이 남아 있습니다. 실행 상태를 확인하세요.'); }
    try {
      await this.lock.writeFile(JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
      await mkdir(join(this.directory, 'artifacts'), { recursive: true, mode: 0o700 });
      try { this.state = JSON.parse(await readFile(join(this.directory, 'board.json'), 'utf8')); }
      catch (error) {
        if (error.code !== 'ENOENT') throw new Error('저장 데이터를 읽지 못했습니다. 기존 파일은 유지했습니다.');
        this.state = { schemaVersion: 1, revision: 0, workspaceId: randomUUID(), projects: [], ideas: [], proposals: [], artifacts: [], runs: [], requests: {} };
        await this.persist(this.state);
      }
      if (this.state.schemaVersion !== 1 || !Number.isInteger(this.state.revision)
        || !['projects', 'ideas', 'proposals', 'artifacts', 'runs'].every((key) => Array.isArray(this.state[key]))
        || !this.state.requests || typeof this.state.requests !== 'object' || Array.isArray(this.state.requests)
        || typeof this.state.workspaceId !== 'string') throw new Error('지원하지 않거나 손상된 저장 형식입니다.');
      validateBoard(this.state);
      return this;
    } catch (error) { await this.close(); throw error; }
  }
  read() { return structuredClone(this.state); }
  transaction(action) {
    const result = this.tail.then(async () => {
      const next = this.read();
      const result = await action(next);
      if (JSON.stringify(next) !== JSON.stringify(this.state)) {
        next.revision = this.state.revision + 1;
        validateBoard(next);
        await this.persist(next);
        this.state = next;
      }
      return result;
    });
    this.tail = result.catch(() => {});
    return result;
  }
  async persist(state) {
    const temporary = join(this.directory, `.board-${randomUUID()}.tmp`);
    try {
      const handle = await open(temporary, 'wx', 0o600);
      try { await handle.writeFile(JSON.stringify(state, null, 2)); await handle.sync(); }
      finally { await handle.close(); }
      await rename(temporary, join(this.directory, 'board.json'));
    }
    finally { await rm(temporary, { force: true }); }
  }
  async writeArtifact(id, extension, content) {
    const handle = await open(join(this.directory, 'artifacts', `${id}${extension}`), 'wx', 0o600);
    try { await handle.writeFile(content); await handle.sync(); } finally { await handle.close(); }
  }
  async readArtifact(artifact) {
    if (typeof artifact.file !== 'string' || basename(artifact.file) !== artifact.file || !/^artifact-[a-f0-9-]+\.[a-z]+$/.test(artifact.file)) throw new Error('저장 파일 이름이 올바르지 않습니다.');
    const root = await realpath(join(this.directory, 'artifacts'));
    const path = await realpath(join(root, artifact.file));
    if (path !== join(root, artifact.file)) throw new Error('결과물 폴더 밖의 파일은 읽을 수 없습니다.');
    return readFile(path, 'utf8');
  }
  async close() {
    await this.tail;
    if (this.lock) { await this.lock.close(); this.lock = undefined; await rm(this.lockPath, { force: true }); }
  }
}
