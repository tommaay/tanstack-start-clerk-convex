/**
 * Structured server logger (Winston).
 *
 * - Development: human-readable colored output with timestamps
 * - Production: JSON with `defaultMeta` for log aggregation (Vercel Log
 *   Drains, Axiom, Datadog, …) — outputs to stdout only
 *
 * Server-only. Winston is a Node library: import this module from server
 * functions, `.server()` middleware bodies, or Nitro server code only. Never
 * from components, route `head()` / `beforeLoad()`, or shared modules that the
 * client bundle imports. Browser code may use `console.error` in error
 * boundaries with a `biome-ignore` comment.
 *
 * Use `createChildLogger()` to attach request-scoped context (requestId,
 * userId) that appears in every subsequent log line.
 */
import { createLogger, format, transports } from 'winston';

const isDev = process.env.NODE_ENV !== 'production';

/**
 * JSON replacer that keeps `Error` details in structured metadata.
 *
 * `JSON.stringify(new Error("x"))` is `{}` because `message` and `stack` are
 * non-enumerable, so `logger.error("...", { error })` would log nothing useful.
 *
 * @param _key Property name (unused)
 * @param value Property value
 * @returns Serializable value
 */
function serializeErrors(_key: string, value: unknown): unknown {
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }
  if (typeof value === 'bigint') {
    return value.toString();
  }
  return value;
}

export const logger = createLogger({
  level: isDev ? 'debug' : 'info',
  defaultMeta: {
    service: 'tanstack-start-clerk-convex',
    environment: process.env.NODE_ENV || 'development',
  },
  format: isDev
    ? format.combine(
        format.colorize(),
        format.timestamp({ format: 'HH:mm:ss' }),
        format.printf(({ timestamp, level, message, ...meta }) => {
          const { service: _s, environment: _e, ...rest } = meta;
          const metaStr = Object.keys(rest).length
            ? ` ${JSON.stringify(rest, serializeErrors)}`
            : '';
          return `${timestamp} ${level}: ${message}${metaStr}`;
        }),
      )
    : format.combine(
        format.timestamp(),
        format.errors({ stack: true }),
        format.json({ replacer: serializeErrors }),
      ),
  transports: [new transports.Console()],
});

/**
 * Create a child logger with request-scoped context.
 * All logs from the child automatically include the provided fields.
 *
 * @example
 * ```ts
 * const reqLogger = createChildLogger({ requestId: crypto.randomUUID(), userId });
 * reqLogger.info("Post created", { postId });
 * // Output includes: requestId, userId, postId
 * ```
 */
export function createChildLogger(context: Record<string, unknown>) {
  return logger.child(context);
}
