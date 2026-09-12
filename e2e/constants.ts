/**
 * Shared e2e constants. Kept apart from `playwright.config.ts` so specs can
 * import them without re-running the config module.
 */

/** Storage state written by `global.setup.ts` for the `authenticated` project. */
export const AUTH_FILE = 'playwright/.clerk/user.json';
