import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { loadEnvFile } from 'node:process';
import { createMockApi } from './app';
import { readMockConfig } from './config';

if (existsSync('.env')) loadEnvFile('.env');

const { port, options } = readMockConfig();
const server = createServer(createMockApi(options)).listen(port, '127.0.0.1', () => {
  console.info(`Mock API: http://127.0.0.1:${port}/api (fictional data; resets on restart)`);
});

server.on('error', (error: NodeJS.ErrnoException) => {
  console.error(`Mock API failed to start (${error.code ?? 'unknown error'}).`);
  process.exitCode = 1;
});

function shutdown(): void {
  server.close((error) => {
    process.exitCode = error ? 1 : 0;
  });
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
