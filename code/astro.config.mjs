import { defineConfig } from 'astro/config';

const apiPort = process.env.SLIDES_DEV_API_PORT;
const apiOrigin = apiPort && `http://127.0.0.1:${apiPort}`;

export default defineConfig({
  output: 'static',
  vite: {
    build: {
      // Mermaid's lazy-loaded ELK diagram layout engine chunk exceeds 500 kB on its own.
      chunkSizeWarningLimit: 1600,
    },
    optimizeDeps: {
      include: [
        'markdown-it', 'katex', 'highlight.js/lib/common', 'dompurify',
        'echarts/core', 'echarts/charts', 'echarts/components', 'echarts/renderers',
      ],
    },
    ...(apiOrigin ? {
      server: {
        strictPort: true,
        proxy: {
          '/api/': {
            target: apiOrigin,
            changeOrigin: true,
            configure(proxy) {
              proxy.on('proxyReq', (request, incoming) => {
                const { host, origin } = incoming.headers;
                if (host && /^(?:127\.0\.0\.1|localhost):\d+$/.test(host) && origin === `http://${host}`) {
                  request.setHeader('Origin', apiOrigin);
                }
              });
            },
          },
        },
      },
    } : {}),
  },
});
