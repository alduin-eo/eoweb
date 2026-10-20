import { HOST } from '@/consts';

type Config = {
  host: string;
  staticHost: boolean;
  title: string;
  creditsUrl: string;
  soundFont: string;
};

// Deployment target is fixed at build time: `VITE_DEPLOY_ENV=test pnpm build`.
// Production builds (the default) keep the compiled-in live server. Test builds
// never contain it and may only connect to the origin that served the page, so
// a test client can't reach the live game.

function sameOriginHost(): string {
  const scheme = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${scheme}//${window.location.host}/ws`;
}

export function isAllowedHost(url: string): boolean {
  if (import.meta.env.VITE_DEPLOY_ENV !== 'test') {
    return true;
  }

  try {
    const target = new URL(url);
    const scheme = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return target.protocol === scheme && target.host === window.location.host;
  } catch {
    return false;
  }
}

export function getDefaultConfig(): Config {
  if (import.meta.env.VITE_DEPLOY_ENV === 'test') {
    return {
      host: sameOriginHost(),
      staticHost: true,
      title: 'Alduin Online [TEST]',
      creditsUrl: 'https://alduin-online.com/credits.html',
      soundFont: 'TimGM6mb.sf2',
    };
  }

  return {
    host: HOST,
    staticHost: true,
    title: 'Alduin Online',
    creditsUrl: 'https://alduin-online.com/credits.html',
    soundFont: 'TimGM6mb.sf2',
  };
}

export async function loadConfig(): Promise<Config> {
  const config = getDefaultConfig();
  if (import.meta.env.VITE_DEPLOY_ENV !== 'test') {
    return config;
  }

  // Test deployments may override title etc. via /config.json, but the host
  // must stay on this origin and the host field stays hidden.
  try {
    const response = await fetch('/config.json', { cache: 'no-store' });
    if (response.ok) {
      Object.assign(config, await response.json());
    }
  } catch (err) {
    console.warn('Failed to load /config.json, using defaults', err);
  }

  if (!isAllowedHost(config.host)) {
    console.error(
      `Refusing non-test host ${config.host}; using ${sameOriginHost()}`,
    );
    config.host = sameOriginHost();
  }
  config.staticHost = true;
  return config;
}
