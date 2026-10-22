import { createContext } from 'preact';
import { useCallback, useContext, useEffect, useState } from 'preact/hooks';
import type { AdminCpSession } from '@/controllers';
import { Button, ItemIcon } from '@/ui/components';
import { UI_BLUR, UI_MODAL_BG } from '@/ui/consts';
import { useClient } from '@/ui/context';
import { capitalize } from '@/utils';

// ---------- context ----------

export type ConfirmRequest = {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
};

type AdminCpContextValue = {
  session: AdminCpSession;
  request: <T = unknown>(
    op: string,
    params?: Record<string, unknown>,
  ) => Promise<T>;
  /** run an action: success → toast + optional callback, failure → toast with the server's reason */
  act: (
    op: string,
    params: Record<string, unknown>,
    onDone?: (data: { message?: string } & Record<string, unknown>) => void,
  ) => Promise<boolean>;
  confirm: (request: ConfirmRequest) => void;
  notify: (message: string, kind?: 'ok' | 'error') => void;
  /** jump to a player's page from anywhere in the panel */
  openPlayer: (characterId: number) => void;
};

export const AdminCpContext = createContext<AdminCpContextValue | null>(null);

export function useAdminCp(): AdminCpContextValue {
  const value = useContext(AdminCpContext);
  if (!value) throw new Error('useAdminCp outside the Admin CP');
  return value;
}

/** Load data from the server; reload() re-runs it. */
export function useAdminQuery<T>(
  op: string,
  params: Record<string, unknown> = {},
  deps: unknown[] = [],
) {
  const { request } = useAdminCp();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    request<T>(op, params)
      .then((d) => {
        if (!alive) return;
        setData(d);
        setError(null);
      })
      .catch((e: Error) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [op, tick, ...deps]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, loading, reload };
}

// ---------- layout ----------

export function Section({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: preact.ComponentChildren;
  children: preact.ComponentChildren;
}) {
  return (
    <section class='rounded-md border border-base-content/10 bg-base-200/40 p-2'>
      <div class='mb-1.5 flex items-center justify-between gap-2'>
        <h3 class='font-semibold text-primary text-xs uppercase tracking-wide'>
          {title}
        </h3>
        {actions && <div class='flex items-center gap-1'>{actions}</div>}
      </div>
      {children}
    </section>
  );
}

export function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: preact.ComponentChildren;
  hint?: string;
}) {
  return (
    <div class='min-w-0 rounded-md bg-base-content/5 px-2 py-1.5'>
      <div class='truncate text-[0.65rem] text-base-content/60 uppercase'>
        {label}
      </div>
      <div class='truncate font-semibold text-sm'>{value}</div>
      {hint && (
        <div class='truncate text-[0.65rem] text-base-content/50'>{hint}</div>
      )}
    </div>
  );
}

export function Pill({
  kind = 'neutral',
  children,
}: {
  kind?: 'ok' | 'warn' | 'bad' | 'info' | 'neutral';
  children: preact.ComponentChildren;
}) {
  const cls = {
    ok: 'badge-success',
    warn: 'badge-warning',
    bad: 'badge-error',
    info: 'badge-info',
    neutral: 'badge-ghost',
  }[kind];
  return (
    <span class={`badge badge-xs ${cls} whitespace-nowrap`}>{children}</span>
  );
}

export function Loading({ what = 'Loading' }: { what?: string }) {
  return (
    <div class='flex items-center gap-2 p-3 text-base-content/60 text-xs'>
      <span class='loading loading-spinner loading-xs' />
      {what}…
    </div>
  );
}

export function ErrorLine({
  error,
  onRetry,
}: {
  error: string;
  onRetry?: () => void;
}) {
  return (
    <div class='alert alert-error alert-soft flex justify-between p-2 text-xs'>
      <span>{error}</span>
      {onRetry && (
        <Button variant={['xs', 'ghost']} onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}

export function Empty({ children }: { children: preact.ComponentChildren }) {
  return <div class='p-2 text-base-content/50 text-xs italic'>{children}</div>;
}

// ---------- form fields (focus sets client.typing so keys don't move the character) ----------

function useTypingGuard() {
  const client = useClient();
  return {
    onFocus: () => {
      client.typing = true;
    },
    onBlur: () => {
      client.typing = false;
    },
  };
}

export function Field({
  label,
  children,
  class: className = '',
}: {
  label: string;
  children: preact.ComponentChildren;
  class?: string;
}) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: the control is passed in as children
    <label class={`flex min-w-0 flex-col gap-0.5 ${className}`}>
      <span class='text-[0.65rem] text-base-content/60 uppercase'>{label}</span>
      {children}
    </label>
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
  maxLength,
  type = 'text',
  onEnter,
  autofocus,
  class: className = '',
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  type?: 'text' | 'number' | 'search';
  onEnter?: () => void;
  autofocus?: boolean;
  class?: string;
}) {
  const guard = useTypingGuard();
  return (
    <input
      class={`input input-xs w-full ${className}`}
      type={type}
      value={value}
      placeholder={placeholder}
      maxLength={maxLength}
      autofocus={autofocus}
      onInput={(e) => onChange((e.target as HTMLInputElement).value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && onEnter) {
          e.preventDefault();
          onEnter();
        }
      }}
      {...guard}
    />
  );
}

export function TextArea({
  value,
  onChange,
  placeholder,
  maxLength = 1000,
  rows = 2,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  rows?: number;
}) {
  const guard = useTypingGuard();
  return (
    <textarea
      class='textarea textarea-xs w-full'
      value={value}
      rows={rows}
      placeholder={placeholder}
      maxLength={maxLength}
      onInput={(e) => onChange((e.target as HTMLTextAreaElement).value)}
      {...guard}
    />
  );
}

export function SelectInput({
  value,
  onChange,
  options,
  class: className = '',
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  class?: string;
}) {
  const guard = useTypingGuard();
  return (
    <select
      class={`select select-xs w-full ${className}`}
      value={value}
      onChange={(e) => onChange((e.target as HTMLSelectElement).value)}
      {...guard}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/** Mute/ban durations in minutes ('' = permanent). */
export const DURATIONS = [
  { value: '60', label: '1 hour' },
  { value: '360', label: '6 hours' },
  { value: '1440', label: '1 day' },
  { value: '4320', label: '3 days' },
  { value: '10080', label: '7 days' },
  { value: '43200', label: '30 days' },
  { value: '', label: 'Permanent' },
];

export function durationLabel(minutes: string): string {
  return DURATIONS.find((d) => d.value === minutes)?.label ?? `${minutes} min`;
}

// ---------- confirmation modal ----------

export function ConfirmModal({
  request,
  onClose,
}: {
  request: ConfirmRequest;
  onClose: () => void;
}) {
  return (
    <div
      class='absolute inset-0 z-10 flex items-center justify-center bg-black/40 p-3'
      role='presentation'
      onClick={(e) => e.stopPropagation()}
    >
      <div
        class={`w-full max-w-sm rounded-lg border border-base-content/20 p-3 shadow-lg ${UI_MODAL_BG} ${UI_BLUR}`}
        role='alertdialog'
        aria-modal='true'
        aria-label={request.title}
      >
        <h3 class='font-semibold text-sm'>{request.title}</h3>
        <p class='mt-1 whitespace-pre-line text-xs'>{request.message}</p>
        <div class='mt-3 flex justify-end gap-2'>
          <Button variant={['xs', 'ghost']} onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={['xs', request.danger ? 'error' : 'primary']}
            onClick={() => {
              onClose();
              request.onConfirm();
            }}
          >
            {request.confirmLabel ?? 'Confirm'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------- pickers ----------

export type PlayerRow = {
  character_id: number;
  name: string;
  level: number;
  class: number;
  admin_level: number;
  map: number;
  map_name?: string;
  x: number;
  y: number;
  account_id: number;
  account: string;
  is_bot: number;
  online: boolean;
};

export function className(session: AdminCpSession, id: number): string {
  return session.classes[id - 1] ?? (id ? `Class ${id}` : 'Peasant');
}

export const STAFF_LEVELS = [
  'Player',
  'Spy',
  'Light Guide',
  'Guardian',
  'Game Master',
  'High Game Master',
];

/** Search players by name or account; calls onPick with the chosen row. */
export function PlayerPicker({
  onPick,
  placeholder = 'Player or account name…',
  includeBots = false,
}: {
  onPick: (player: PlayerRow) => void;
  placeholder?: string;
  includeBots?: boolean;
}) {
  const { request } = useAdminCp();
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<PlayerRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(() => {
    setError(null);
    request<{ players: PlayerRow[] }>('players.search', {
      q,
      include_bots: includeBots,
    })
      .then((d) => setRows(d.players))
      .catch((e: Error) => setError(e.message));
  }, [q, includeBots, request]);

  return (
    <div class='flex flex-col gap-1'>
      <div class='flex gap-1'>
        <TextInput
          value={q}
          onChange={setQ}
          onEnter={search}
          placeholder={placeholder}
          maxLength={32}
          type='search'
        />
        <Button variant={['xs', 'primary']} onClick={search}>
          Search
        </Button>
      </div>
      {error && <ErrorLine error={error} />}
      {rows && rows.length === 0 && <Empty>No players found.</Empty>}
      {rows && rows.length > 0 && (
        <ul class='max-h-40 overflow-y-auto rounded-md bg-base-content/5'>
          {rows.map((p) => (
            <li key={p.character_id}>
              <button
                type='button'
                class='flex w-full items-center justify-between gap-2 px-2 py-1 text-left text-xs hover:bg-base-content/10'
                onClick={() => {
                  onPick(p);
                  setRows(null);
                }}
              >
                <span class='truncate'>
                  {capitalize(p.name)}{' '}
                  <span class='text-base-content/50'>
                    ({p.account}) Lv {p.level}
                  </span>
                </span>
                {p.online ? (
                  <Pill kind='ok'>online</Pill>
                ) : (
                  <Pill>offline</Pill>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export type ItemRow = {
  id: number;
  name: string;
  graphic: number;
  type: string;
  alduin: boolean;
};

export function ItemPicker({ onPick }: { onPick: (item: ItemRow) => void }) {
  const { request } = useAdminCp();
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<ItemRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(() => {
    setError(null);
    request<{ items: ItemRow[] }>('items.search', { q })
      .then((d) => setRows(d.items))
      .catch((e: Error) => setError(e.message));
  }, [q, request]);

  return (
    <div class='flex flex-col gap-1'>
      <div class='flex gap-1'>
        <TextInput
          value={q}
          onChange={setQ}
          onEnter={search}
          placeholder='Item name or ID…'
          maxLength={32}
          type='search'
        />
        <Button variant={['xs', 'primary']} onClick={search}>
          Search
        </Button>
      </div>
      {error && <ErrorLine error={error} />}
      {rows && rows.length === 0 && <Empty>No items found.</Empty>}
      {rows && rows.length > 0 && (
        <ul class='grid max-h-44 grid-cols-1 overflow-y-auto rounded-md bg-base-content/5 sm:grid-cols-2'>
          {rows.map((item) => (
            <li key={item.id}>
              <button
                type='button'
                class='flex w-full items-center gap-2 px-2 py-1 text-left text-xs hover:bg-base-content/10'
                onClick={() => {
                  onPick(item);
                  setRows(null);
                }}
              >
                <span class='flex h-6 w-6 shrink-0 items-center justify-center'>
                  <ItemIcon
                    graphicId={item.graphic}
                    alt=''
                    class='max-h-6 max-w-6'
                  />
                </span>
                <span class='truncate'>{item.name}</span>
                <span class='ml-auto text-base-content/40'>#{item.id}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export type MapRow = {
  id: number;
  name: string;
  width: number;
  height: number;
};

export function MapPicker({ onPick }: { onPick: (map: MapRow) => void }) {
  const { request } = useAdminCp();
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<MapRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(() => {
    setError(null);
    request<{ maps: MapRow[] }>('world.maps', { q })
      .then((d) => setRows(d.maps))
      .catch((e: Error) => setError(e.message));
  }, [q, request]);

  return (
    <div class='flex flex-col gap-1'>
      <div class='flex gap-1'>
        <TextInput
          value={q}
          onChange={setQ}
          onEnter={search}
          placeholder='Map name or ID…'
          maxLength={32}
          type='search'
        />
        <Button variant={['xs', 'primary']} onClick={search}>
          Search
        </Button>
      </div>
      {error && <ErrorLine error={error} />}
      {rows && rows.length === 0 && <Empty>No maps found.</Empty>}
      {rows && rows.length > 0 && (
        <ul class='max-h-40 overflow-y-auto rounded-md bg-base-content/5'>
          {rows.map((m) => (
            <li key={m.id}>
              <button
                type='button'
                class='flex w-full items-center justify-between gap-2 px-2 py-1 text-left text-xs hover:bg-base-content/10'
                onClick={() => {
                  onPick(m);
                  setRows(null);
                }}
              >
                <span class='truncate'>
                  <span class='text-base-content/50'>#{m.id}</span>{' '}
                  {m.name || '(unnamed)'}
                </span>
                <span class='text-base-content/40'>
                  {m.width}×{m.height}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------- formatting ----------

export function formatUptime(seconds: number | null | undefined): string {
  if (seconds == null) return '—';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return d ? `${d}d ${h}h ${m}m` : h ? `${h}h ${m}m` : `${m}m`;
}

export function shortDate(value: string | null | undefined): string {
  return value ? value.slice(0, 16) : '—';
}
