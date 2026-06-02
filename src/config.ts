import { HOST } from '@/consts';

type Config = {
  host: string;
  staticHost: boolean;
  title: string;
  creditsUrl: string;
  soundFont: string;
};

export function getDefaultConfig(): Config {
  return {
    host: HOST,
    staticHost: true,
    title: 'Alduin Online',
    creditsUrl: 'https://alduin-online.com/credits.html',
    soundFont: 'TimGM6mb.sf2',
  };
}

export async function loadConfig(): Promise<Config> {
  return getDefaultConfig();
}
