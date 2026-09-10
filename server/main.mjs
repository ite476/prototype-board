import { parseArgs } from 'node:util';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from './http.mjs';

// 포트·바인딩 주소는 실행 환경이 정한다. 값을 생략해 다른 서버를 덮어쓰거나 임의 포트로 이동하지 않는다.
const { values } = parseArgs({ options: { port: { type: 'string' }, 'data-dir': { type: 'string' }, host: { type: 'string' } } });
const portValue = values.port ?? process.env.PROTOTYPE_BOARD_PORT;
if (!portValue) throw new Error('PROTOTYPE_BOARD_PORT 또는 --port가 필요합니다. 실행 환경의 보드 포트를 지정하세요.');
const port = Number(portValue);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('보드 포트는 1~65535 사이의 정수여야 합니다.');
const host = values.host ?? process.env.PROTOTYPE_BOARD_HOST;
if (!host) throw new Error('PROTOTYPE_BOARD_HOST 또는 --host가 필요합니다. 실행 환경의 바인딩 주소를 지정하세요.');
const directory = resolve(values['data-dir'] ?? process.env.PROTOTYPE_BOARD_DATA_DIR ?? `${homedir()}/.local/share/prototype-board/workspaces/personal`);
const dist = fileURLToPath(new URL('../dist', import.meta.url));
const runtime = await startServer({ directory, dist, port, host, publicOrigin: process.env.PROTOTYPE_BOARD_PUBLIC_ORIGIN });
console.log(JSON.stringify({ service: 'prototype-board', url: runtime.origin, directory, workspaceId: runtime.service.board().workspaceId }));
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => runtime.close().then(() => process.exit(0), (error) => { console.error(error.message); process.exit(1); }));
