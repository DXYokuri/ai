import { createServer } from 'vite';

const port = Number(process.env.PORT ?? process.argv[2] ?? 5173);

const server = await createServer({
  server: {
    host: '127.0.0.1',
    port,
    strictPort: true
  }
});

await server.listen();

console.log(`Future UI Solar System Atlas: http://127.0.0.1:${port}/`);

process.on('SIGINT', async () => {
  await server.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await server.close();
  process.exit(0);
});

setInterval(() => undefined, 2 ** 31 - 1);
