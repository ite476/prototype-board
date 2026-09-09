import { parseArgs } from 'node:util';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from './http.mjs';

// 실행 위치에 따라 다른 저장 폴더가 생기지 않도록 기본 경로를 홈 기준으로 고정한다.
const { values } = parseArgs({ options: { port: { type: 'string', default: '5190' }, 'data-dir': { type: 'string' }, host: { type: 'string', default: '127.0.0.1' } } });
const port = Number(values.port);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('포트는 1~65535 사이의 정수여야 합니다.');
const directory = resolve(values['data-dir'] ?? `${homedir()}/.local/share/prototype-board/workspaces/personal`);
const dist = fileURLToPath(new URL('../dist', import.meta.url));
const runtime = await startServer({ directory, dist, port, host: values.host });
console.log(JSON.stringify({ service: 'prototype-board', url: runtime.origin, directory, workspaceId: runtime.service.board().workspaceId }));
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => runtime.close().then(() => process.exit(0), (error) => { console.error(error.message); process.exit(1); }));
