import type { MockApiOptions } from './models';

export function readMockConfig(env: NodeJS.ProcessEnv = process.env): {
  port: number;
  options: MockApiOptions;
} {
  function integer(name: string, fallback: number, min: number, max: number): number {
    const raw = env[name];
    if (raw === undefined) return fallback;
    const value = Number(raw);
    if (!/^\d+$/.test(raw) || !Number.isSafeInteger(value) || value < min || value > max) {
      throw new Error(`${name} must be an integer between ${min} and ${max}.`);
    }
    return value;
  }

  return {
    port: integer('MOCK_API_PORT', 3000, 1, 65535),
    options: {
      accessTtlMs: integer('MOCK_ACCESS_TTL_SECONDS', 30, 1, 3600) * 1000,
      refreshTtlMs: integer('MOCK_REFRESH_TTL_SECONDS', 3600, 1, 86400) * 1000,
      latencyMs: integer('MOCK_LATENCY_MS', 150, 0, 5000),
      failListOnce: integer('MOCK_FAIL_LIST_ONCE', 0, 0, 1) === 1,
      failSaveOnce: integer('MOCK_FAIL_SAVE_ONCE', 0, 0, 1) === 1,
    },
  };
}
