/**
 * Lightweight logger wrapper so we can control what prints in production.
 * - debug/info will only log when __DEV__ is true.
 * - warn/error always log since they indicate actionable problems.
 */

const IS_DEV = typeof __DEV__ !== 'undefined' && __DEV__;

export type Logger = {
  debug: (...args: any[]) => void;
  info: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  error: (...args: any[]) => void;
};

export function getLogger(tag?: string): Logger {
  const prefix = tag ? `[${tag}]` : '';

  return {
    debug: (...args: any[]) => {
      if (!IS_DEV) return;
      // eslint-disable-next-line no-console
      console.log(prefix, ...args);
    },
    info: (...args: any[]) => {
      if (!IS_DEV) return;
      // eslint-disable-next-line no-console
      console.info(prefix, ...args);
    },
    warn: (...args: any[]) => {
      // eslint-disable-next-line no-console
      console.warn(prefix, ...args);
    },
    error: (...args: any[]) => {
      // eslint-disable-next-line no-console
      console.error(prefix, ...args);
    }
  };
}

export default getLogger;
