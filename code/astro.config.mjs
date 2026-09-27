import { defineConfig } from 'astro/config';

const apiPort = process.env.SLIDES_DEV_API_PORT;
const apiOrigin = apiPort && `http://127.0.0.1:${apiPort}`;

export default defineConfig({
  output: 'static',
  ...(apiOrigin ? {
    vite: {
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
    },
  } : {}),
});
