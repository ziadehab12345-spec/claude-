/**
 * Environment validation, run once at startup.
 *
 * Without this, a missing AUTH_SECRET surfaces as a stack trace on whichever
 * page a customer happens to open first. Failing loudly at boot with a message
 * that names the variable is the difference between a five-minute fix and an
 * afternoon.
 */
const REQUIRED = ['DATABASE_URL', 'AUTH_SECRET'] as const;

export interface EnvProblem {
  variable: string;
  problem: string;
}

export function checkEnv(env: NodeJS.ProcessEnv = process.env): EnvProblem[] {
  const problems: EnvProblem[] = [];

  for (const key of REQUIRED) {
    if (!env[key]) problems.push({ variable: key, problem: 'is not set' });
  }

  if (env.AUTH_SECRET && env.AUTH_SECRET.length < 32) {
    problems.push({
      variable: 'AUTH_SECRET',
      problem: 'must be at least 32 characters — generate one with: openssl rand -base64 48',
    });
  }

  if (env.AUTH_SECRET?.startsWith('change-me')) {
    problems.push({ variable: 'AUTH_SECRET', problem: 'is still the placeholder from .env.example' });
  }

  if (env.DATABASE_URL && !/^postgres(ql)?:\/\//.test(env.DATABASE_URL)) {
    problems.push({ variable: 'DATABASE_URL', problem: 'must be a postgresql:// connection string' });
  }

  // A managed Postgres reached over the public internet must use TLS.
  if (
    env.NODE_ENV === 'production' &&
    env.DATABASE_URL &&
    !/localhost|127\.0\.0\.1/.test(env.DATABASE_URL) &&
    !/sslmode=/.test(env.DATABASE_URL)
  ) {
    problems.push({
      variable: 'DATABASE_URL',
      problem: 'should include ?sslmode=require when connecting to a remote database',
    });
  }

  return problems;
}

export function assertEnv(env: NodeJS.ProcessEnv = process.env): void {
  const problems = checkEnv(env);
  if (problems.length === 0) return;

  const lines = problems.map((p) => `  - ${p.variable} ${p.problem}`).join('\n');
  throw new Error(`Environment is not configured correctly:\n${lines}\n\nSee .env.example.`);
}
