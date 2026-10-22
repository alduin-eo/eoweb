import { useEffect, useState } from 'preact/hooks';
import { Button } from '@/ui/components';
import {
  Empty,
  ErrorLine,
  Field,
  formatUptime,
  Loading,
  Pill,
  Section,
  SelectInput,
  Stat,
  shortDate,
  TextInput,
  useAdminCp,
  useAdminQuery,
} from './admin-cp-shared';

type LogLine = { at: string; level: string; target: string; message: string };

type Overview = {
  status: string;
  version: string;
  uptime_seconds: number | null;
  players_online: number;
  bots_online: number;
  max_players: number;
  bot_manager: { desired: number; paused: number; heartbeat: string } | null;
  maintenance: boolean;
  open_reports: number;
  warnings_since_start: number;
  errors_since_start: number;
  recent_errors: LogLine[];
  stats: {
    cpu_percent: number | null;
    rss_mb: number | null;
    memory_limit_mb: number | null;
    host_mem_total_mb: number | null;
    host_mem_available_mb: number | null;
    load_average: number[];
    cpus: number | null;
  };
  restart: {
    at: string;
    seconds_left: number;
    message: string;
    by: string;
  } | null;
};

const REFRESH_MS = 15_000;

function Meter({
  label,
  percent,
  text,
}: {
  label: string;
  percent: number | null;
  text: string;
}) {
  const p = percent == null ? 0 : Math.max(0, Math.min(100, percent));
  const tone =
    p > 85
      ? 'progress-error'
      : p > 60
        ? 'progress-warning'
        : 'progress-success';
  return (
    <div class='min-w-0'>
      <div class='flex justify-between text-[0.65rem] text-base-content/60 uppercase'>
        <span>{label}</span>
        <span class='normal-case'>{text}</span>
      </div>
      <progress class={`progress h-1.5 w-full ${tone}`} value={p} max={100} />
    </div>
  );
}

function AnnounceForm() {
  const { act, confirm } = useAdminCp();
  const [message, setMessage] = useState('');
  return (
    <div class='flex gap-1'>
      <TextInput
        value={message}
        onChange={setMessage}
        maxLength={200}
        placeholder='Message to every player…'
      />
      <Button
        variant={['xs', 'primary']}
        disabled={!message.trim()}
        onClick={() =>
          confirm({
            title: 'Send announcement',
            message: `Every online player will see:\n“${message.trim()}”`,
            confirmLabel: 'Announce',
            onConfirm: () =>
              act('server.announce', { message }, () => setMessage('')),
          })
        }
      >
        Announce
      </Button>
    </div>
  );
}

function RestartControls({
  restart,
  onChange,
}: {
  restart: Overview['restart'];
  onChange: () => void;
}) {
  const { act, confirm } = useAdminCp();
  const [minutes, setMinutes] = useState('10');
  const [message, setMessage] = useState('');
  if (restart) {
    return (
      <div class='flex flex-wrap items-center justify-between gap-2 rounded-md bg-warning/15 p-2 text-xs'>
        <span>
          Restart scheduled for <b>{restart.at}</b> (
          {formatUptime(restart.seconds_left)} left) by {restart.by}
          {restart.message ? ` — “${restart.message}”` : ''}
        </span>
        <Button
          variant={['xs', 'warning']}
          onClick={() =>
            confirm({
              title: 'Cancel the restart',
              message: 'Players are told the restart was cancelled.',
              confirmLabel: 'Cancel restart',
              onConfirm: () => act('server.restart_cancel', {}, onChange),
            })
          }
        >
          Cancel restart
        </Button>
      </div>
    );
  }
  return (
    <div class='grid grid-cols-1 gap-1 sm:grid-cols-[8rem_1fr_auto] sm:items-end'>
      <Field label='Restart in'>
        <SelectInput
          value={minutes}
          onChange={setMinutes}
          options={['1', '2', '5', '10', '15', '30', '60'].map((m) => ({
            value: m,
            label: `${m} min`,
          }))}
        />
      </Field>
      <Field label='Reason shown to players (optional)'>
        <TextInput
          value={message}
          onChange={setMessage}
          maxLength={120}
          placeholder='e.g. Server update'
        />
      </Field>
      <Button
        variant={['xs', 'error']}
        onClick={() =>
          confirm({
            title: 'Schedule a server restart',
            message: `Players get countdown warnings, then the server saves everyone and restarts in ${minutes} minute(s). Everyone is disconnected for a few seconds.`,
            confirmLabel: 'Schedule restart',
            danger: true,
            onConfirm: () =>
              act(
                'server.restart_schedule',
                { minutes: Number(minutes), message },
                onChange,
              ),
          })
        }
      >
        Schedule restart
      </Button>
    </div>
  );
}

export function DashboardSection({
  goTo,
}: {
  goTo: (section: string) => void;
}) {
  const { data, error, loading, reload } = useAdminQuery<Overview>('overview');
  useEffect(() => {
    const t = setInterval(reload, REFRESH_MS);
    return () => clearInterval(t);
  }, [reload]);

  if (error && !data) return <ErrorLine error={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const s = data.stats;
  const memPercent =
    s.rss_mb != null && s.memory_limit_mb
      ? (s.rss_mb / s.memory_limit_mb) * 100
      : null;
  const hostUsed =
    s.host_mem_total_mb && s.host_mem_available_mb != null
      ? ((s.host_mem_total_mb - s.host_mem_available_mb) /
          s.host_mem_total_mb) *
        100
      : null;
  return (
    <div class='flex flex-col gap-2'>
      <div class='grid grid-cols-2 gap-1.5 sm:grid-cols-4'>
        <Stat
          label='Server'
          value={
            <span class='flex items-center gap-1'>
              <Pill kind='ok'>online</Pill>
              {data.maintenance && <Pill kind='warn'>maintenance</Pill>}
            </span>
          }
          hint={`v${data.version}`}
        />
        <Stat label='Uptime' value={formatUptime(data.uptime_seconds)} />
        <Stat
          label='Players'
          value={`${data.players_online}`}
          hint={`max ${data.max_players}`}
        />
        <Stat
          label='Bots'
          value={`${data.bots_online}${data.bot_manager ? ` / ${data.bot_manager.desired}` : ''}`}
          hint={data.bot_manager?.paused ? 'paused' : 'target'}
        />
      </div>
      <Section
        title='Resources'
        actions={loading && <span class='loading loading-spinner loading-xs' />}
      >
        <div class='grid grid-cols-1 gap-2 sm:grid-cols-3'>
          <Meter
            label='Server CPU'
            percent={s.cpu_percent}
            text={s.cpu_percent == null ? '—' : `${s.cpu_percent}% of 1 core`}
          />
          <Meter
            label='Server memory'
            percent={memPercent}
            text={
              s.rss_mb == null
                ? '—'
                : `${s.rss_mb} MB${s.memory_limit_mb ? ` / ${s.memory_limit_mb} MB` : ''}`
            }
          />
          <Meter
            label='Host memory'
            percent={hostUsed}
            text={
              s.host_mem_total_mb
                ? `${Math.round(hostUsed ?? 0)}% of ${Math.round(s.host_mem_total_mb / 1024)} GB`
                : '—'
            }
          />
        </div>
        <div class='mt-1 text-[0.65rem] text-base-content/50'>
          Load average {s.load_average.join(' / ') || '—'} on {s.cpus ?? '?'}{' '}
          CPUs
        </div>
      </Section>
      <div class='grid grid-cols-1 gap-2 sm:grid-cols-2'>
        <Section title='Attention'>
          <ul class='flex flex-col gap-1 text-xs'>
            <li class='flex justify-between'>
              <span>Open player reports</span>
              <Button
                variant={['xs', data.open_reports ? 'warning' : 'ghost']}
                onClick={() => goTo('reports')}
              >
                {data.open_reports}
              </Button>
            </li>
            <li class='flex justify-between'>
              <span>Errors / warnings since start</span>
              <Button
                variant={['xs', data.errors_since_start ? 'error' : 'ghost']}
                onClick={() => goTo('server')}
              >
                {data.errors_since_start} / {data.warnings_since_start}
              </Button>
            </li>
          </ul>
          {data.recent_errors.length > 0 && (
            <ul class='mt-1 max-h-24 overflow-y-auto text-[0.65rem] text-error'>
              {data.recent_errors.map((l) => (
                <li key={l.at + l.message} class='truncate' title={l.message}>
                  {l.at.slice(11, 19)} {l.message}
                </li>
              ))}
            </ul>
          )}
        </Section>
        <Section title='Announcement'>
          <AnnounceForm />
        </Section>
      </div>
      <Section title='Server restart'>
        <RestartControls restart={data.restart} onChange={reload} />
      </Section>
    </div>
  );
}

type AuditRow = {
  id: number;
  action: string;
  by: string;
  status: number;
  result: string | null;
  created_at: string;
  account: string | null;
  character: string | null;
};

const STATUS: Record<number, ['ok' | 'warn' | 'bad' | 'neutral', string]> = {
  0: ['neutral', 'queued'],
  1: ['warn', 'running'],
  2: ['ok', 'done'],
  3: ['bad', 'failed'],
};

function AuditLog() {
  const [page, setPage] = useState(0);
  const { data, error, loading, reload } = useAdminQuery<{ rows: AuditRow[] }>(
    'server.audit',
    { page },
    [page],
  );
  return (
    <Section
      title='Staff actions (website + in game)'
      actions={
        <>
          <Button
            variant={['xs', 'ghost']}
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            ‹ Newer
          </Button>
          <Button
            variant={['xs', 'ghost']}
            disabled={(data?.rows.length ?? 0) < 50}
            onClick={() => setPage((p) => p + 1)}
          >
            Older ›
          </Button>
          <Button variant={['xs', 'ghost']} onClick={reload}>
            Refresh
          </Button>
        </>
      }
    >
      {error && <ErrorLine error={error} onRetry={reload} />}
      {loading && !data && <Loading />}
      {data && data.rows.length === 0 && <Empty>No staff actions yet.</Empty>}
      {data && data.rows.length > 0 && (
        <div class='max-h-72 overflow-auto'>
          <table class='table-zebra table-xs table'>
            <thead>
              <tr>
                <th>When</th>
                <th>Action</th>
                <th>Target</th>
                <th>By</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => {
                const [kind, label] = STATUS[r.status] ?? [
                  'neutral',
                  String(r.status),
                ];
                return (
                  <tr key={r.id}>
                    <td class='whitespace-nowrap'>{shortDate(r.created_at)}</td>
                    <td>{r.action}</td>
                    <td>{r.character ?? r.account ?? '—'}</td>
                    <td>{r.by}</td>
                    <td class='max-w-48 truncate' title={r.result ?? ''}>
                      <Pill kind={kind}>{label}</Pill> {r.result}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

function Logs() {
  const [level, setLevel] = useState('ERROR');
  const { data, error, loading, reload } = useAdminQuery<{
    logs: LogLine[];
    warnings: number;
    errors: number;
  }>('server.logs');
  const lines = (data?.logs ?? []).filter(
    (l) => level === 'ALL' || l.level === level,
  );
  return (
    <Section
      title='Recent warnings & errors'
      actions={
        <>
          <SelectInput
            value={level}
            onChange={setLevel}
            class='w-24'
            options={[
              { value: 'ERROR', label: 'Errors' },
              { value: 'WARN', label: 'Warnings' },
              { value: 'ALL', label: 'Both' },
            ]}
          />
          <Button variant={['xs', 'ghost']} onClick={reload}>
            Refresh
          </Button>
        </>
      }
    >
      {error && <ErrorLine error={error} onRetry={reload} />}
      {loading && !data && <Loading />}
      {data && (
        <>
          <div class='mb-1 text-[0.65rem] text-base-content/50'>
            Since the server started: {data.errors} errors, {data.warnings}{' '}
            warnings (last 200 kept).
          </div>
          {lines.length === 0 ? (
            <Empty>Nothing to show.</Empty>
          ) : (
            <ul class='max-h-64 overflow-auto font-mono text-[0.65rem]'>
              {lines.map((l, i) => (
                <li
                  key={`${l.at}-${i}`}
                  class={l.level === 'ERROR' ? 'text-error' : 'text-warning'}
                >
                  <span class='text-base-content/50'>{l.at.slice(5, 19)}</span>{' '}
                  {l.message}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Section>
  );
}

export function ServerSection() {
  const { act, confirm } = useAdminCp();
  const overview = useAdminQuery<Overview>('overview');
  const maintenance = overview.data?.maintenance ?? false;
  return (
    <div class='flex flex-col gap-2'>
      <Section title='Maintenance mode'>
        <div class='flex flex-wrap items-center justify-between gap-2 text-xs'>
          <span>
            {maintenance ? (
              <Pill kind='warn'>ON</Pill>
            ) : (
              <Pill kind='ok'>off</Pill>
            )}{' '}
            While on, only staff can log in (players already online stay).
          </span>
          <Button
            variant={['xs', maintenance ? 'success' : 'warning']}
            disabled={!overview.data}
            onClick={() =>
              confirm({
                title: maintenance
                  ? 'Turn maintenance off'
                  : 'Turn maintenance on',
                message: maintenance
                  ? 'Everyone can log in again.'
                  : 'New logins are refused for everyone except staff.',
                danger: !maintenance,
                onConfirm: () =>
                  act(
                    'server.maintenance',
                    { enabled: !maintenance },
                    overview.reload,
                  ),
              })
            }
          >
            {maintenance ? 'Turn off' : 'Turn on'}
          </Button>
        </div>
      </Section>
      <Section title='Server restart'>
        {overview.data ? (
          <RestartControls
            restart={overview.data.restart}
            onChange={overview.reload}
          />
        ) : (
          <Loading />
        )}
      </Section>
      <Logs />
      <AuditLog />
    </div>
  );
}
