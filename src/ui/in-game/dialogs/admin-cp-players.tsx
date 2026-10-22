import { useState } from 'preact/hooks';
import { Button, ItemIcon, Tabs } from '@/ui/components';
import { capitalize } from '@/utils';
import {
  className,
  DURATIONS,
  durationLabel,
  Empty,
  ErrorLine,
  Field,
  Loading,
  MapPicker,
  Pill,
  type PlayerRow,
  Section,
  SelectInput,
  STAFF_LEVELS,
  shortDate,
  TextArea,
  TextInput,
  useAdminCp,
  useAdminQuery,
} from './admin-cp-shared';

type OnlineRow = {
  character_id: number;
  name: string;
  level: number;
  class: number;
  admin_level: number;
  map: number;
  map_name: string;
  x: number;
  y: number;
  is_bot: boolean;
  hidden: boolean;
};

export function PlayersSection({
  selected,
  onSelect,
}: {
  selected: number | null;
  onSelect: (id: number | null) => void;
}) {
  if (selected)
    return (
      <PlayerDetail characterId={selected} onBack={() => onSelect(null)} />
    );
  return <PlayerList onSelect={onSelect} />;
}

function PlayerList({ onSelect }: { onSelect: (id: number) => void }) {
  const { session, request } = useAdminCp();
  const [mode, setMode] = useState<'online' | 'search'>('online');
  const [q, setQ] = useState('');
  const [includeBots, setIncludeBots] = useState(false);
  const [results, setResults] = useState<PlayerRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const online = useAdminQuery<{ players: OnlineRow[] }>('players.online');

  const search = () => {
    setError(null);
    setMode('search');
    request<{ players: PlayerRow[] }>('players.search', {
      q,
      include_bots: includeBots,
    })
      .then((d) => setResults(d.players))
      .catch((e: Error) => setError(e.message));
  };

  const shown = (online.data?.players ?? []).filter(
    (p) => includeBots || !p.is_bot,
  );

  return (
    <div class='flex flex-col gap-2'>
      <div class='flex flex-wrap items-center gap-1'>
        <div class='min-w-40 flex-1'>
          <TextInput
            value={q}
            onChange={setQ}
            onEnter={search}
            placeholder='Search any player or account (online or offline)…'
            maxLength={32}
            type='search'
            autofocus
          />
        </div>
        <Button variant={['xs', 'primary']} onClick={search}>
          Search
        </Button>
        <label class='flex cursor-pointer items-center gap-1 text-xs'>
          <input
            type='checkbox'
            class='checkbox checkbox-xs'
            checked={includeBots}
            onChange={(e) =>
              setIncludeBots((e.target as HTMLInputElement).checked)
            }
          />
          Bots
        </label>
      </div>
      <Tabs
        style='border'
        size='xs'
        activeId={mode}
        onSelect={(id) => setMode(id as 'online' | 'search')}
        items={[
          { id: 'online', label: `Online now (${shown.length})` },
          {
            id: 'search',
            label: `Search results${results ? ` (${results.length})` : ''}`,
          },
        ]}
      />
      {error && <ErrorLine error={error} />}
      {mode === 'search' &&
        (results == null ? (
          <Empty>
            Type a name and press Search. Leave it empty to list everyone.
          </Empty>
        ) : results.length === 0 ? (
          <Empty>No players match “{q}”.</Empty>
        ) : (
          <PlayerTable
            rows={results.map((p) => ({ ...p, is_bot: Boolean(p.is_bot) }))}
            onSelect={onSelect}
            classLabel={(id) => className(session, id)}
          />
        ))}
      {mode === 'online' &&
        (online.error ? (
          <ErrorLine error={online.error} onRetry={online.reload} />
        ) : !online.data ? (
          <Loading />
        ) : shown.length === 0 ? (
          <Empty>Nobody is online.</Empty>
        ) : (
          <PlayerTable
            rows={shown.map((p) => ({ ...p, online: true }))}
            onSelect={onSelect}
            classLabel={(id) => className(session, id)}
          />
        ))}
    </div>
  );
}

function PlayerTable({
  rows,
  onSelect,
  classLabel,
}: {
  rows: {
    character_id: number;
    name: string;
    level: number;
    class: number;
    admin_level: number;
    map: number;
    map_name?: string;
    x: number;
    y: number;
    is_bot: boolean;
    online?: boolean;
    account?: string;
  }[];
  onSelect: (id: number) => void;
  classLabel: (id: number) => string;
}) {
  return (
    <div class='max-h-[50vh] overflow-auto'>
      <table class='table-zebra table-xs table'>
        <thead>
          <tr>
            <th>Name</th>
            <th class='hidden sm:table-cell'>Account</th>
            <th>Lv</th>
            <th class='hidden sm:table-cell'>Class</th>
            <th>Location</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr
              key={p.character_id}
              class='cursor-pointer hover:bg-base-content/10'
              onClick={() => onSelect(p.character_id)}
            >
              <td class='font-semibold'>
                {capitalize(p.name)}
                {p.admin_level > 0 && (
                  <span class='ml-1'>
                    <Pill kind='info'>
                      {STAFF_LEVELS[p.admin_level] ?? `staff ${p.admin_level}`}
                    </Pill>
                  </span>
                )}
                {p.is_bot && (
                  <span class='ml-1'>
                    <Pill>bot</Pill>
                  </span>
                )}
              </td>
              <td class='hidden sm:table-cell'>{p.account ?? ''}</td>
              <td>{p.level}</td>
              <td class='hidden sm:table-cell'>{classLabel(p.class)}</td>
              <td class='whitespace-nowrap'>
                {p.map_name ? `${p.map_name} ` : ''}
                <span class='text-base-content/50'>
                  #{p.map} ({p.x},{p.y})
                </span>
              </td>
              <td>
                {p.online ? (
                  <Pill kind='ok'>online</Pill>
                ) : (
                  <Pill>offline</Pill>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------- player page ----------

type Item = { id: number; amount: number; name: string; graphic: number };
type Detail = {
  character: {
    character_id: number;
    name: string;
    account_id: number;
    level: number;
    experience: number;
    class: number;
    admin_level: number;
    map: number;
    map_name: string | null;
    x: number;
    y: number;
    home: string;
    title: string | null;
    gold_bank: number;
    karma: number;
    usage_minutes: number;
    created_at: string;
    partner: string | null;
    guild: string | null;
    hp?: number;
    max_hp?: number;
  };
  online: boolean;
  account: {
    id: number;
    name: string;
    email: string;
    real_name: string;
    location: string;
    created_at: string;
    is_bot: number;
  } | null;
  characters: {
    id: number;
    name: string;
    level: number;
    admin_level: number;
  }[];
  last_login: string | null;
  ban: { minutes: number; since: string } | null;
  mute: {
    reason: string;
    by: string;
    since: string;
    until: string | null;
  } | null;
  warnings: {
    id: number;
    category: string;
    reason: string;
    by: string;
    created_at: string;
    delivered_at: string | null;
    acknowledged_at: string | null;
    revoked_at: string | null;
    revoked_by: string | null;
  }[];
  history: {
    id: number;
    action: string;
    reason: string;
    by: string;
    created_at: string;
    expires_at: string | null;
    details: string | null;
    report: string | null;
  }[];
  adjustments: {
    item_id: number;
    delta: number;
    before: number;
    after: number;
    reason: string;
    by: string;
    created_at: string;
  }[];
  reports: {
    id: number;
    public_id: string;
    category: string;
    status: string;
    created_at: string;
  }[];
  inventory: Item[];
  bank: Item[];
  equipment: { slot: string; id: number; name: string; graphic: number }[];
};

type DetailTab =
  | 'overview'
  | 'moderation'
  | 'warnings'
  | 'history'
  | 'inventory'
  | 'teleport'
  | 'character';

function PlayerDetail({
  characterId,
  onBack,
}: {
  characterId: number;
  onBack: () => void;
}) {
  const { session } = useAdminCp();
  const [tab, setTab] = useState<DetailTab>('overview');
  const { data, error, loading, reload } = useAdminQuery<Detail>(
    'players.detail',
    { character_id: characterId },
    [characterId],
  );

  if (error && !data) return <ErrorLine error={error} onRetry={reload} />;
  if (!data) return <Loading what='Loading player' />;
  const c = data.character;
  const name = capitalize(c.name);
  return (
    <div class='flex flex-col gap-2'>
      <div class='flex flex-wrap items-center gap-1.5'>
        <Button variant={['xs', 'ghost']} onClick={onBack}>
          ‹ Players
        </Button>
        <h3 class='font-semibold text-base'>{name}</h3>
        {data.online ? <Pill kind='ok'>online</Pill> : <Pill>offline</Pill>}
        {c.admin_level > 0 && (
          <Pill kind='info'>{STAFF_LEVELS[c.admin_level]}</Pill>
        )}
        {data.account?.is_bot ? <Pill>bot</Pill> : null}
        {data.ban && (
          <Pill kind='bad'>banned{data.ban.minutes ? '' : ' (permanent)'}</Pill>
        )}
        {data.mute && <Pill kind='warn'>muted</Pill>}
        {data.warnings.some((w) => !w.acknowledged_at && !w.revoked_at) && (
          <Pill kind='warn'>warning pending</Pill>
        )}
        <span class='ml-auto'>
          {loading && <span class='loading loading-spinner loading-xs' />}
        </span>
        <Button variant={['xs', 'ghost']} onClick={reload}>
          Refresh
        </Button>
      </div>
      <Tabs
        style='border'
        size='xs'
        activeId={tab}
        onSelect={(id) => setTab(id as DetailTab)}
        items={[
          { id: 'overview', label: 'Overview' },
          { id: 'moderation', label: 'Moderation' },
          { id: 'warnings', label: `Warnings (${data.warnings.length})` },
          { id: 'history', label: 'History' },
          { id: 'inventory', label: 'Inventory' },
          { id: 'teleport', label: 'Teleport' },
          { id: 'character', label: 'Character' },
        ]}
      />
      {tab === 'overview' && <Overview data={data} />}
      {tab === 'moderation' && <Moderation data={data} onDone={reload} />}
      {tab === 'warnings' && <Warnings data={data} onDone={reload} />}
      {tab === 'history' && <History data={data} />}
      {tab === 'inventory' && <Inventory data={data} />}
      {tab === 'teleport' && <Teleport data={data} onDone={reload} />}
      {tab === 'character' && (
        <CharacterTab data={data} session={session} onDone={reload} />
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: preact.ComponentChildren }) {
  return (
    <div class='flex justify-between gap-2 border-base-content/5 border-b py-0.5 text-xs'>
      <span class='text-base-content/60'>{k}</span>
      <span class='truncate text-right'>{v ?? '—'}</span>
    </div>
  );
}

function Overview({ data }: { data: Detail }) {
  const { session, openPlayer } = useAdminCp();
  const c = data.character;
  return (
    <div class='grid grid-cols-1 gap-2 sm:grid-cols-2'>
      <Section title='Character'>
        <Row
          k='Level'
          v={`${c.level} (${c.experience.toLocaleString()} exp)`}
        />
        <Row k='Class' v={className(session, c.class)} />
        <Row
          k='Location'
          v={`${c.map_name ?? ''} #${c.map} (${c.x}, ${c.y})`}
        />
        {c.max_hp != null && <Row k='HP' v={`${c.hp} / ${c.max_hp}`} />}
        <Row k='Home' v={c.home} />
        <Row k='Title' v={c.title} />
        <Row k='Guild' v={c.guild} />
        <Row k='Partner' v={c.partner} />
        <Row k='Gold in bank' v={c.gold_bank.toLocaleString()} />
        <Row k='Karma' v={c.karma} />
        <Row k='Played' v={`${Math.round(c.usage_minutes / 60)} h`} />
        <Row k='Created' v={shortDate(c.created_at)} />
      </Section>
      <div class='flex flex-col gap-2'>
        <Section title='Account'>
          <Row k='Account' v={data.account?.name} />
          <Row k='Email' v={data.account?.email} />
          <Row
            k='Name / location'
            v={[data.account?.real_name, data.account?.location]
              .filter(Boolean)
              .join(', ')}
          />
          <Row k='Created' v={shortDate(data.account?.created_at)} />
          <Row k='Last login' v={shortDate(data.last_login)} />
          <Row
            k='Ban'
            v={
              data.ban
                ? data.ban.minutes
                  ? `${durationLabel(String(data.ban.minutes))} since ${shortDate(data.ban.since)}`
                  : 'permanent'
                : 'none'
            }
          />
          <Row
            k='Mute'
            v={
              data.mute
                ? `until ${data.mute.until ? shortDate(data.mute.until) : 'lifted'} (${data.mute.reason})`
                : 'none'
            }
          />
        </Section>
        <Section title='Characters on this account'>
          {data.characters.map((ch) => (
            <button
              type='button'
              key={ch.id}
              class={`flex w-full justify-between rounded px-1 py-0.5 text-left text-xs hover:bg-base-content/10 ${ch.id === c.character_id ? 'font-semibold text-primary' : ''}`}
              onClick={() => openPlayer(ch.id)}
            >
              <span>{capitalize(ch.name)}</span>
              <span class='text-base-content/50'>Lv {ch.level}</span>
            </button>
          ))}
        </Section>
        {data.reports.length > 0 && (
          <Section title='Reports about this player'>
            {data.reports.map((r) => (
              <Row
                key={r.id}
                k={`${r.public_id} ${r.category}`}
                v={
                  <Pill
                    kind={
                      r.status === 'resolved' || r.status === 'closed'
                        ? 'neutral'
                        : 'warn'
                    }
                  >
                    {r.status}
                  </Pill>
                }
              />
            ))}
          </Section>
        )}
      </div>
    </div>
  );
}

/** Reason + optional fields, then a confirmed request. Reused by report actions. */
export function ModerationForm({
  characterId,
  name,
  reportId,
  onDone,
}: {
  characterId: number;
  name: string;
  reportId?: number;
  onDone: () => void;
}) {
  const { session, act, confirm } = useAdminCp();
  const [action, setAction] = useState('warn');
  const [reason, setReason] = useState('');
  const [minutes, setMinutes] = useState('1440');
  const [category, setCategory] = useState(
    session.warning_categories[0] ?? 'Other',
  );

  const actions = [
    { value: 'warn', label: 'Warn (shown in game until acknowledged)' },
    { value: 'mute', label: 'Mute (server-side chat)' },
    { value: 'unmute', label: 'Unmute' },
    { value: 'kick', label: 'Kick (disconnect)' },
    { value: 'ban', label: 'Ban the account' },
    { value: 'unban', label: 'Unban' },
    { value: 'unstick', label: 'Unstick (move to the rescue point)' },
    { value: 'revoke_sessions', label: 'Revoke remembered logins' },
  ];
  const label = actions.find((a) => a.value === action)?.label ?? action;
  const danger = ['ban', 'kick', 'mute'].includes(action);
  const timed = action === 'ban' || action === 'mute';

  const submit = () =>
    confirm({
      title: `${label.split(' (')[0]}: ${name}`,
      message: `${timed ? `Duration: ${durationLabel(minutes)}\n` : ''}${action === 'warn' ? `Category: ${category}\n` : ''}Reason: ${reason}`,
      confirmLabel: label.split(' (')[0],
      danger,
      onConfirm: () =>
        act(
          'players.action',
          {
            character_id: characterId,
            action,
            reason,
            category,
            minutes: timed ? (minutes ? Number(minutes) : null) : undefined,
            report_id: reportId,
          },
          () => {
            setReason('');
            onDone();
          },
        ),
    });

  return (
    <div class='flex flex-col gap-1.5'>
      <div class='grid grid-cols-1 gap-1.5 sm:grid-cols-2'>
        <Field label='Action'>
          <SelectInput value={action} onChange={setAction} options={actions} />
        </Field>
        {timed && (
          <Field label='Duration'>
            <SelectInput
              value={minutes}
              onChange={setMinutes}
              options={DURATIONS}
            />
          </Field>
        )}
        {action === 'warn' && (
          <Field label='Category'>
            <SelectInput
              value={category}
              onChange={setCategory}
              options={session.warning_categories.map((c) => ({
                value: c,
                label: c,
              }))}
            />
          </Field>
        )}
      </div>
      <Field
        label={
          action === 'warn'
            ? 'Message shown to the player'
            : 'Reason (kept in the moderation history)'
        }
      >
        <TextArea
          value={reason}
          onChange={setReason}
          maxLength={1000}
          placeholder='Required'
        />
      </Field>
      <div class='flex justify-end'>
        <Button
          variant={['xs', danger ? 'error' : 'primary']}
          disabled={!reason.trim()}
          onClick={submit}
        >
          {label.split(' (')[0]}
        </Button>
      </div>
    </div>
  );
}

function Moderation({ data, onDone }: { data: Detail; onDone: () => void }) {
  const { act, confirm } = useAdminCp();
  const [resetReason, setResetReason] = useState('');
  const [temporary, setTemporary] = useState<{
    account: string;
    password: string;
  } | null>(null);
  const c = data.character;
  const name = capitalize(c.name);
  return (
    <div class='grid grid-cols-1 gap-2 sm:grid-cols-2'>
      <Section title='Moderate'>
        <ModerationForm
          characterId={c.character_id}
          name={name}
          onDone={onDone}
        />
      </Section>
      <div class='flex flex-col gap-2'>
        <Section title='Quick actions (online players)'>
          <div class='flex flex-wrap gap-1'>
            {(['jail', 'free', 'freeze', 'unfreeze'] as const).map(
              (command) => (
                <Button
                  key={command}
                  variant={['xs', 'outline']}
                  disabled={!data.online}
                  onClick={() =>
                    confirm({
                      title: `${capitalize(command)} ${name}`,
                      message: `Run $${command} on ${name}?`,
                      onConfirm: () =>
                        act(
                          'players.command',
                          { character_id: c.character_id, command },
                          onDone,
                        ),
                    })
                  }
                >
                  {capitalize(command)}
                </Button>
              ),
            )}
          </div>
          {!data.online && (
            <div class='mt-1 text-[0.65rem] text-base-content/50'>
              These need the player online.
            </div>
          )}
        </Section>
        <Section title='Reset password'>
          {temporary ? (
            <div class='flex flex-col gap-1 text-xs'>
              <span>
                New temporary password for account <b>{temporary.account}</b>{' '}
                (shown once, not stored anywhere):
              </span>
              <code class='select-all rounded bg-base-content/10 px-2 py-1 font-mono text-sm'>
                {temporary.password}
              </code>
              <span class='text-base-content/60'>
                Give it to the player through a trusted channel. They were
                signed out everywhere.
              </span>
              <Button
                variant={['xs', 'ghost']}
                onClick={() => setTemporary(null)}
              >
                Done
              </Button>
            </div>
          ) : (
            <div class='flex flex-col gap-1'>
              <TextInput
                value={resetReason}
                onChange={setResetReason}
                maxLength={1000}
                placeholder='Reason (required)'
              />
              <div class='flex justify-end'>
                <Button
                  variant={['xs', 'warning']}
                  disabled={!resetReason.trim()}
                  onClick={() =>
                    confirm({
                      title: `Reset the password of ${data.account?.name}`,
                      message:
                        'A temporary password is created and shown to you once. The player is signed out everywhere.',
                      confirmLabel: 'Reset password',
                      danger: true,
                      onConfirm: () =>
                        act(
                          'players.reset_password',
                          { character_id: c.character_id, reason: resetReason },
                          (d) => {
                            setTemporary({
                              account: String(d.account),
                              password: String(d.temporary_password),
                            });
                            setResetReason('');
                            onDone();
                          },
                        ),
                    })
                  }
                >
                  Reset password
                </Button>
              </div>
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}

function Warnings({ data, onDone }: { data: Detail; onDone: () => void }) {
  const { act, confirm } = useAdminCp();
  if (data.warnings.length === 0)
    return <Empty>No warnings on this account.</Empty>;
  return (
    <div class='flex flex-col gap-1'>
      {data.warnings.map((w) => (
        <div
          key={w.id}
          class={`rounded-md bg-base-content/5 p-2 text-xs ${w.revoked_at ? 'opacity-60' : ''}`}
        >
          <div class='flex flex-wrap items-center gap-1'>
            <b>#{w.id}</b> {w.category}
            {w.revoked_at ? (
              <Pill>revoked by {w.revoked_by}</Pill>
            ) : w.acknowledged_at ? (
              <Pill kind='ok'>acknowledged {shortDate(w.acknowledged_at)}</Pill>
            ) : w.delivered_at ? (
              <Pill kind='warn'>shown, not acknowledged</Pill>
            ) : (
              <Pill kind='warn'>pending (next login)</Pill>
            )}
            <span class='ml-auto text-base-content/50'>
              {shortDate(w.created_at)} by {w.by}
            </span>
          </div>
          <div class='mt-0.5 whitespace-pre-line'>{w.reason}</div>
          {!w.revoked_at && (
            <div class='mt-1 flex justify-end'>
              <Button
                variant={['xs', 'ghost']}
                onClick={() =>
                  confirm({
                    title: `Revoke warning #${w.id}`,
                    message:
                      'It stays in the history, marked revoked, and is no longer shown in game.',
                    confirmLabel: 'Revoke',
                    onConfirm: () =>
                      act(
                        'players.action',
                        {
                          character_id: data.character.character_id,
                          action: 'revoke_warning',
                          warning_id: w.id,
                          reason: 'Revoked in the in-game Admin CP',
                        },
                        onDone,
                      ),
                  })
                }
              >
                Revoke
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function History({ data }: { data: Detail }) {
  return (
    <div class='flex flex-col gap-2'>
      <Section title='Moderation history (shared with the website panel)'>
        {data.history.length === 0 ? (
          <Empty>No actions on record.</Empty>
        ) : (
          <div class='max-h-64 overflow-auto'>
            <table class='table-zebra table-xs table'>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Action</th>
                  <th>Reason</th>
                  <th>By</th>
                  <th>Until</th>
                </tr>
              </thead>
              <tbody>
                {data.history.map((h) => (
                  <tr key={h.id}>
                    <td class='whitespace-nowrap'>{shortDate(h.created_at)}</td>
                    <td>
                      {h.action}
                      {h.details ? (
                        <span class='text-base-content/50'> {h.details}</span>
                      ) : null}
                    </td>
                    <td class='max-w-56 truncate' title={h.reason}>
                      {h.reason}
                      {h.report ? (
                        <span class='text-base-content/50'> ({h.report})</span>
                      ) : null}
                    </td>
                    <td>{h.by}</td>
                    <td class='whitespace-nowrap'>{shortDate(h.expires_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
      <Section title='Item and gold adjustments by staff'>
        {data.adjustments.length === 0 ? (
          <Empty>None.</Empty>
        ) : (
          <table class='table-xs table'>
            <tbody>
              {data.adjustments.map((a) => (
                <tr key={a.created_at + a.item_id}>
                  <td class='whitespace-nowrap'>{shortDate(a.created_at)}</td>
                  <td>
                    item #{a.item_id} {a.delta > 0 ? `+${a.delta}` : a.delta} (
                    {a.before} → {a.after})
                  </td>
                  <td class='max-w-48 truncate' title={a.reason}>
                    {a.reason}
                  </td>
                  <td>{a.by}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
    </div>
  );
}

function ItemGrid({ items }: { items: Item[] }) {
  if (items.length === 0) return <Empty>Empty.</Empty>;
  return (
    <ul class='grid grid-cols-1 gap-0.5 sm:grid-cols-2'>
      {items.map((i) => (
        <li
          key={i.id}
          class='flex items-center gap-2 rounded bg-base-content/5 px-1.5 py-0.5 text-xs'
        >
          <span class='flex h-6 w-6 shrink-0 items-center justify-center'>
            <ItemIcon graphicId={i.graphic} alt='' class='max-h-6 max-w-6' />
          </span>
          <span class='truncate'>{i.name}</span>
          <span class='ml-auto font-semibold'>{i.amount.toLocaleString()}</span>
        </li>
      ))}
    </ul>
  );
}

function Inventory({ data }: { data: Detail }) {
  return (
    <div class='flex flex-col gap-2'>
      <div class='text-[0.65rem] text-base-content/50'>
        {data.online
          ? 'Live view (the player is online).'
          : 'Saved state (the player is offline).'}{' '}
        Use Items & Economy to give or remove items.
      </div>
      <Section title='Equipped'>
        {data.equipment.length === 0 ? (
          <Empty>Nothing equipped.</Empty>
        ) : (
          <ItemGrid
            items={data.equipment.map((e) => ({
              id: e.id,
              amount: 1,
              name: `${e.slot}: ${e.name}`,
              graphic: e.graphic,
            }))}
          />
        )}
      </Section>
      <Section title={`Inventory (${data.inventory.length})`}>
        <ItemGrid items={data.inventory} />
      </Section>
      <Section title={`Bank (${data.bank.length})`}>
        <ItemGrid items={data.bank} />
      </Section>
    </div>
  );
}

function Teleport({ data, onDone }: { data: Detail; onDone: () => void }) {
  const { act, confirm } = useAdminCp();
  const c = data.character;
  const name = capitalize(c.name);
  const [map, setMap] = useState<{
    id: number;
    name: string;
    width: number;
    height: number;
  } | null>(null);
  const [x, setX] = useState('');
  const [y, setY] = useState('');
  const [reason, setReason] = useState('');
  return (
    <div class='grid grid-cols-1 gap-2 sm:grid-cols-2'>
      <Section title='Now'>
        <div class='flex flex-col gap-1'>
          <Button
            variant={['xs', 'primary']}
            disabled={!data.online}
            onClick={() =>
              act('players.warp_to', { character_id: c.character_id })
            }
          >
            Teleport me to {name}
          </Button>
          <Button
            variant={['xs', 'outline']}
            disabled={!data.online}
            onClick={() =>
              confirm({
                title: `Bring ${name} to you`,
                message: `${name} is warped to your position.`,
                onConfirm: () =>
                  act(
                    'players.bring',
                    { character_id: c.character_id },
                    onDone,
                  ),
              })
            }
          >
            Bring {name} to me
          </Button>
          {!data.online && (
            <div class='text-[0.65rem] text-base-content/50'>
              Needs the player online. Moving to a map works offline too.
            </div>
          )}
        </div>
      </Section>
      <Section title='Move to a map'>
        <div class='flex flex-col gap-1'>
          {map ? (
            <div class='flex items-center justify-between rounded bg-base-content/5 px-2 py-1 text-xs'>
              <span>
                #{map.id} {map.name} ({map.width}×{map.height})
              </span>
              <Button variant={['xs', 'ghost']} onClick={() => setMap(null)}>
                Change
              </Button>
            </div>
          ) : (
            <MapPicker onPick={setMap} />
          )}
          <div class='grid grid-cols-2 gap-1'>
            <Field label='X (empty = centre)'>
              <TextInput value={x} onChange={setX} type='number' />
            </Field>
            <Field label='Y'>
              <TextInput value={y} onChange={setY} type='number' />
            </Field>
          </div>
          <TextInput
            value={reason}
            onChange={setReason}
            maxLength={1000}
            placeholder='Reason (required)'
          />
          <div class='flex justify-end'>
            <Button
              variant={['xs', 'primary']}
              disabled={!map || !reason.trim()}
              onClick={() =>
                map &&
                confirm({
                  title: `Move ${name}`,
                  message: `To map #${map.id} ${map.name}${x && y ? ` (${x}, ${y})` : ' (centre)'}.`,
                  onConfirm: () =>
                    act(
                      'players.warp',
                      {
                        character_id: c.character_id,
                        map: map.id,
                        x: x && y ? Number(x) : undefined,
                        y: x && y ? Number(y) : undefined,
                        reason,
                      },
                      () => {
                        setReason('');
                        onDone();
                      },
                    ),
                })
              }
            >
              Move
            </Button>
          </div>
        </div>
      </Section>
    </div>
  );
}

function CharacterTab({
  data,
  session,
  onDone,
}: {
  data: Detail;
  session: { owner: boolean; classes: string[] };
  onDone: () => void;
}) {
  const { act, confirm } = useAdminCp();
  const c = data.character;
  const name = capitalize(c.name);
  const [property, setProperty] = useState('title');
  const [value, setValue] = useState('');
  const properties = [
    { value: 'title', label: 'Title' },
    { value: 'home', label: 'Home town' },
    { value: 'class', label: 'Class (number)' },
    { value: 'gender', label: 'Gender (0 female, 1 male)' },
    { value: 'hairstyle', label: 'Hair style' },
    { value: 'haircolor', label: 'Hair colour' },
    { value: 'skin', label: 'Skin' },
    ...(session.owner
      ? [{ value: 'admin', label: 'Staff level (owner only)' }]
      : []),
  ];
  return (
    <Section title='Change a property ($set, player must be online)'>
      <div class='grid grid-cols-1 gap-1 sm:grid-cols-[12rem_1fr_auto] sm:items-end'>
        <Field label='Property'>
          <SelectInput
            value={property}
            onChange={(p) => {
              setProperty(p);
              setValue('');
            }}
            options={properties}
          />
        </Field>
        <Field label='Value'>
          {property === 'admin' ? (
            <SelectInput
              value={value}
              onChange={setValue}
              options={[
                { value: '', label: 'Choose…' },
                ...STAFF_LEVELS.map((l, i) => ({
                  value: String(i),
                  label: `${i} ${l}`,
                })),
              ]}
            />
          ) : property === 'class' ? (
            <SelectInput
              value={value}
              onChange={setValue}
              options={[
                { value: '', label: 'Choose…' },
                ...session.classes.map((l, i) => ({
                  value: String(i + 1),
                  label: l,
                })),
              ]}
            />
          ) : (
            <TextInput value={value} onChange={setValue} maxLength={32} />
          )}
        </Field>
        <Button
          variant={['xs', property === 'admin' ? 'error' : 'primary']}
          disabled={!data.online || value === ''}
          onClick={() =>
            confirm({
              title: `Change ${name}`,
              message: `${property} = ${value}${property === 'admin' ? '\nThis changes who can use staff commands and this panel.' : ''}`,
              danger: property === 'admin',
              onConfirm: () =>
                act(
                  'players.set',
                  { character_id: c.character_id, property, value },
                  onDone,
                ),
            })
          }
        >
          Apply
        </Button>
      </div>
      {!data.online && (
        <div class='mt-1 text-[0.65rem] text-base-content/50'>
          The player must be online.
        </div>
      )}
    </Section>
  );
}
