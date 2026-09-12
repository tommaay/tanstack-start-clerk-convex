/**
 * Server-side environment variable access.
 *
 * Server-only: `process.env` is not populated in the client bundle, so never
 * call this from code that also runs in the browser (route `head()`,
 * `beforeLoad()`, components). Read the value inside a server function and
 * return it instead. Client-safe values use `import.meta.env.VITE_*`.
 */

/**
 * Read a required environment variable or fail fast with a clear message.
 *
 * @param name Variable name as it appears in `.env.example`
 * @returns The non-empty value
 */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}
