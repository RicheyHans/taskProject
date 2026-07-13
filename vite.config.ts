import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 5173,
    open: true,
    // /api 요청을 로컬 Node 서버로 프록시한다(브라우저는 키를 직접 다루지 않음).
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
});
