import { useEffect, useState } from 'preact/hooks';
import { Button } from '@/ui/components';
import { capitalize } from '@/utils';
import {
  Empty,
  ErrorLine,
  Field,
  Loading,
  Pill,
  Section,
  Stat,
  shortDate,
  TextInput,
  useAdminCp,
  useAdminQuery,
} from './admin-cp-shared';

type BotStatus = {
  manager: {
    desired: number;
    paused: number;
    heartbeat: string;
    summary: string;
  } | null;
  manager_alive: boolean;
  online: number;
  accounts: number;
  max: number;
  bots: {
    name: string;
    account: string;
    personality: string;
    level: number;
    map: number;
    x: number;
    y: number;
    activity: string;
    goal: string;
    online: number;
    updated_at: string;
  }[];
  commands: {
    id: number;
    command: string;
    arg: string;
    by: string;
    result: string | null;
    processed_at: string | null;
  }[];
};

export function BotsSection() {
  const { act, confirm } = useAdminCp();
  const { data, error, loading, reload } =
    useAdminQuery<BotStatus>('bots.status');
  const [target, setTarget] = useState('');
  const [count, setCount] = useState('5');
  const [filter, setFilter] = useState('');
  const [onlineOnly, setOnlineOnly] = useState(true);

  useEffect(() => {
    const t = setInterval(reload, 10_000);
    return () => clearInterval(t);
  }, [reload]);
  useEffect(() => {
    if (data?.manager && target === '') setTarget(String(data.manager.desired));
  }, [data, target]);

  if (error && !data) return <ErrorLine error={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const m = data.manager;
  const send = (command: string, extra: Record<string, unknown> = {}) =>
    act('bots.control', { command, ...extra }, () => setTimeout(reload, 1200));
  const n = Number(count);
  const t = Number(target);
  const bots = data.bots.filter(
    (b) =>
      (!onlineOnly || b.online) &&
      (!filter ||
        b.name.includes(filter.toLowerCase()) ||
        b.activity?.toLowerCase().includes(filter.toLowerCase())),
  );

  return (
    <div class='flex flex-col gap-2'>
      <div class='grid grid-cols-2 gap-1.5 sm:grid-cols-4'>
        <Stat
          label='Online'
          value={`${data.online} / ${m?.desired ?? '?'}`}
          hint='online / target'
        />
        <Stat
          label='Bot accounts'
          value={data.accounts}
          hint={`max ${data.max} at once`}
        />
        <Stat
          label='Manager'
          value={
            data.manager_alive ? (
              <Pill kind='ok'>running</Pill>
            ) : (
              <Pill kind='bad'>not responding</Pill>
            )
          }
          hint={m ? `heartbeat ${m.heartbeat.slice(11)}` : ''}
        />
        <Stat
          label='Activity'
          value={
            m?.paused ? (
              <Pill kind='warn'>paused</Pill>
            ) : (
              <Pill kind='ok'>playing</Pill>
            )
          }
        />
      </div>
      {m?.summary && (
        <pre class='whitespace-pre-wrap rounded bg-base-content/5 p-1.5 text-[0.65rem] text-base-content/70'>
          {m.summary}
        </pre>
      )}
      <div class='grid grid-cols-1 gap-2 sm:grid-cols-2'>
        <Section title='Population'>
          <div class='flex items-end gap-1'>
            <Field label={`Target (0–${data.max})`} class='w-24'>
              <TextInput value={target} onChange={setTarget} type='number' />
            </Field>
            <Button
              variant={['xs', 'primary']}
              disabled={!Number.isInteger(t) || t < 0 || t > data.max}
              onClick={() =>
                confirm({
                  title: 'Set bot target',
                  message: `The manager logs bots in or out until ${t} are online (about one login every 12 s).`,
                  onConfirm: () => send('on', { count: t }),
                })
              }
            >
              Set target
            </Button>
          </div>
          <div class='mt-1.5 flex items-end gap-1'>
            <Field label='Count' class='w-20'>
              <TextInput value={count} onChange={setCount} type='number' />
            </Field>
            <Button
              variant={['xs', 'outline']}
              disabled={!(n >= 1)}
              onClick={() => send('add', { count: n })}
            >
              + Spawn {n || ''}
            </Button>
            <Button
              variant={['xs', 'outline']}
              disabled={!(n >= 1)}
              onClick={() =>
                confirm({
                  title: `Disconnect ${n} bot(s)`,
                  message:
                    'They log out gracefully; their accounts and progress are kept.',
                  onConfirm: () => send('remove', { count: n }),
                })
              }
            >
              − Disconnect {n || ''}
            </Button>
          </div>
        </Section>
        <Section title='Fleet'>
          <div class='flex flex-wrap gap-1'>
            {m?.paused ? (
              <Button
                variant={['xs', 'success']}
                onClick={() => send('resume')}
              >
                Resume bots
              </Button>
            ) : (
              <Button variant={['xs', 'warning']} onClick={() => send('pause')}>
                Pause bots
              </Button>
            )}
            <Button
              variant={['xs', 'error']}
              onClick={() =>
                confirm({
                  title: 'Turn all bots off',
                  message:
                    'Target 0: every bot logs out gracefully. Accounts and progress are kept; set a target later to bring them back.',
                  danger: true,
                  onConfirm: () => send('off'),
                })
              }
            >
              All off
            </Button>
          </div>
          <div class='mt-1 text-[0.65rem] text-base-content/50'>
            Pause: online bots stay logged in but stand still and stop acting
            (use before risky maintenance). The manager keeps the target:
            disconnected bots are logged back in automatically.
          </div>
        </Section>
      </div>
      <Section
        title={`Bots (${bots.length})`}
        actions={
          <>
            <label class='flex cursor-pointer items-center gap-1 text-xs'>
              <input
                type='checkbox'
                class='checkbox checkbox-xs'
                checked={onlineOnly}
                onChange={(e) =>
                  setOnlineOnly((e.target as HTMLInputElement).checked)
                }
              />
              online
            </label>
            <div class='w-32'>
              <TextInput
                value={filter}
                onChange={setFilter}
                placeholder='Filter…'
                type='search'
              />
            </div>
            {loading && <span class='loading loading-spinner loading-xs' />}
          </>
        }
      >
        {bots.length === 0 ? (
          <Empty>No bots match.</Empty>
        ) : (
          <div class='max-h-72 overflow-auto'>
            <table class='table-zebra table-xs table'>
              <thead>
                <tr>
                  <th>Bot</th>
                  <th>Lv</th>
                  <th class='hidden sm:table-cell'>Type</th>
                  <th>Doing</th>
                  <th class='hidden sm:table-cell'>Where</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {bots.map((b) => (
                  <tr key={b.account}>
                    <td>
                      {capitalize(b.name)}{' '}
                      {b.online ? null : <Pill>offline</Pill>}
                    </td>
                    <td>{b.level}</td>
                    <td class='hidden sm:table-cell'>{b.personality}</td>
                    <td class='max-w-44 truncate' title={b.goal}>
                      {b.activity}
                    </td>
                    <td class='hidden whitespace-nowrap sm:table-cell'>
                      #{b.map} ({b.x},{b.y})
                    </td>
                    <td>
                      {b.online ? (
                        <Button
                          variant={['xs', 'ghost']}
                          onClick={() => send('relog', { name: b.name })}
                        >
                          Relog
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
      <Section title='Recent bot commands'>
        {data.commands.length === 0 ? (
          <Empty>None.</Empty>
        ) : (
          <ul class='text-[0.65rem]'>
            {data.commands.map((c) => (
              <li key={c.id} class='flex justify-between gap-2'>
                <span>
                  {c.command} {c.arg}{' '}
                  <span class='text-base-content/50'>by {c.by}</span>
                </span>
                <span class='text-base-content/60'>
                  {c.processed_at
                    ? `${c.result} · ${shortDate(c.processed_at)}`
                    : 'waiting…'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
