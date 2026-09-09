import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * 개발 화면의 주소와 API 주소는 실행 환경에서 주입한다. 저장 서버는 별도로 npm start로 실행한다.
 * 환경 변수가 없으면 Vite 기본값을 사용하되, API 프록시는 임의의 보드로 연결하지 않는다.
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const webPort = env.PROTOTYPE_BOARD_WEB_PORT ? Number(env.PROTOTYPE_BOARD_WEB_PORT) : undefined;
  if (webPort !== undefined && (!Number.isInteger(webPort) || webPort < 1 || webPort > 65535)) throw new Error('PROTOTYPE_BOARD_WEB_PORT는 1~65535 정수여야 합니다.');
  const apiOrigin = env.PROTOTYPE_BOARD_API_ORIGIN;
  const proxy = apiOrigin ? { '/api': { target: apiOrigin, changeOrigin: true, configure(proxyServer: { on: (event: string, listener: (request: { setHeader: (name: string, value: string) => void }) => void) => void }) {
    const targetOrigin = new URL(apiOrigin).origin;
    proxyServer.on('proxyReq', (request) => request.setHeader('origin', targetOrigin));
  } } } : undefined;
  const web = { host: env.PROTOTYPE_BOARD_WEB_HOST || undefined, port: webPort, strictPort: env.PROTOTYPE_BOARD_STRICT_PORT === 'true', proxy };
  return { plugins: [react()], server: web, preview: { ...web, proxy: undefined } };
});
