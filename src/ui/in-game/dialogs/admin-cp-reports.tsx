import { useState } from 'preact/hooks';
import { Button } from '@/ui/components';
import { capitalize } from '@/utils';
import { ModerationForm } from './admin-cp-players';
import {
  Empty,
  ErrorLine,
  Field,
  Loading,
  Pill,
  Section,
  SelectInput,
  shortDate,
  TextArea,
  TextInput,
  useAdminCp,
  useAdminQuery,
} from './admin-cp-shared';

const STATUS_LABELS: Record<string, string> = {
  submitted: 'Submitted',
  under_review: 'Under review',
  info_requested: 'Info requested',
  resolved: 'Resolved',
  closed: 'Closed',
};

function statusPill(status: string) {
  const kind =
    status === 'submitted'
      ? 'bad'
      : status === 'resolved' || status === 'closed'
        ? 'neutral'
        : 'warn';
  return <Pill kind={kind}>{STATUS_LABELS[status] ?? status}</Pill>;
}

type ReportRow = {
  id: number;
  public_id: string;
  source: string;
  reported_name: string;
  reporter_name: string | null;
  category: string;
  status: string;
  assigned_to: string | null;
  created_at: string;
  attachments: number;
};

export function ReportsSection({
  selected,
  onSelect,
}: {
  selected: number | null;
  onSelect: (id: number | null) => void;
}) {
  if (selected)
    return <ReportDetail id={selected} onBack={() => onSelect(null)} />;
  return <ReportList onSelect={onSelect} />;
}

function ReportList({ onSelect }: { onSelect: (id: number) => void }) {
  const { session } = useAdminCp();
  const [status, setStatus] = useState('open');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const { data, error, loading, reload } = useAdminQuery<{
    reports: ReportRow[];
    page_size: number;
  }>('reports.list', { status, q: query, page }, [status, query, page]);
  return (
    <div class='flex flex-col gap-2'>
      <div class='flex flex-wrap items-end gap-1'>
        <Field label='Status' class='w-40'>
          <SelectInput
            value={status}
            onChange={(v) => {
              setStatus(v);
              setPage(0);
            }}
            options={[
              { value: 'open', label: 'Open (not resolved)' },
              { value: 'all', label: 'All' },
              ...session.report_statuses.map((s) => ({
                value: s,
                label: STATUS_LABELS[s] ?? s,
              })),
            ]}
          />
        </Field>
        <Field label='Player or report number' class='min-w-32 flex-1'>
          <TextInput
            value={q}
            onChange={setQ}
            onEnter={() => setQuery(q)}
            type='search'
            maxLength={32}
          />
        </Field>
        <Button variant={['xs', 'primary']} onClick={() => setQuery(q)}>
          Search
        </Button>
        {loading && <span class='loading loading-spinner loading-xs' />}
      </div>
      {error && <ErrorLine error={error} onRetry={reload} />}
      {!data && !error && <Loading />}
      {data && data.reports.length === 0 && <Empty>No reports match.</Empty>}
      {data && data.reports.length > 0 && (
        <div class='max-h-[50vh] overflow-auto'>
          <table class='table-zebra table-xs table'>
            <thead>
              <tr>
                <th>Report</th>
                <th>Reported</th>
                <th class='hidden sm:table-cell'>By</th>
                <th>Category</th>
                <th>Status</th>
                <th class='hidden sm:table-cell'>Filed</th>
              </tr>
            </thead>
            <tbody>
              {data.reports.map((r) => (
                <tr
                  key={r.id}
                  class='cursor-pointer hover:bg-base-content/10'
                  onClick={() => onSelect(r.id)}
                >
                  <td class='whitespace-nowrap'>
                    {r.public_id}{' '}
                    {r.source === 'game' ? (
                      <Pill kind='info'>game</Pill>
                    ) : (
                      <Pill>web</Pill>
                    )}
                    {r.attachments > 0 && (
                      <span title='Evidence attached'> 📎{r.attachments}</span>
                    )}
                  </td>
                  <td>{capitalize(r.reported_name)}</td>
                  <td class='hidden sm:table-cell'>
                    {r.reporter_name ? capitalize(r.reporter_name) : '—'}
                  </td>
                  <td>{r.category}</td>
                  <td>{statusPill(r.status)}</td>
                  <td class='hidden whitespace-nowrap sm:table-cell'>
                    {shortDate(r.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div class='flex justify-end gap-1'>
        <Button
          variant={['xs', 'ghost']}
          disabled={page === 0}
          onClick={() => setPage((p) => p - 1)}
        >
          ‹ Newer
        </Button>
        <Button
          variant={['xs', 'ghost']}
          disabled={(data?.reports.length ?? 0) < (data?.page_size ?? 25)}
          onClick={() => setPage((p) => p + 1)}
        >
          Older ›
        </Button>
      </div>
    </div>
  );
}

type ReportDetailData = {
  report: {
    id: number;
    public_id: string;
    source: string;
    reporter_name: string | null;
    reported_character_id: number | null;
    reported_name: string;
    reported_account_name: string | null;
    category: string;
    description: string;
    incident_at: string | null;
    map_id: number | null;
    x: number | null;
    y: number | null;
    status: string;
    assigned_to: string | null;
    public_response: string | null;
    created_at: string;
    updated_at: string;
  };
  attachments: {
    id: number;
    mime: string;
    size: number;
    created_at: string;
    url?: string;
  }[];
  link_minutes: number;
  notes: { author: string; note: string; created_at: string }[];
  actions: {
    action: string;
    reason: string;
    by: string;
    created_at: string;
    expires_at: string | null;
    details: string | null;
  }[];
  prior: {
    id: number;
    public_id: string;
    category: string;
    status: string;
    created_at: string;
  }[];
};

function ReportDetail({ id, onBack }: { id: number; onBack: () => void }) {
  const { session, act, openPlayer } = useAdminCp();
  const { data, error, reload } = useAdminQuery<ReportDetailData>(
    'reports.detail',
    { id },
    [id],
  );
  const [status, setStatus] = useState<string | null>(null);
  const [assigned, setAssigned] = useState<string | null>(null);
  const [response, setResponse] = useState<string | null>(null);
  const [note, setNote] = useState('');

  if (error && !data) return <ErrorLine error={error} onRetry={reload} />;
  if (!data) return <Loading what='Loading report' />;
  const r = data.report;
  const st = status ?? r.status;
  const as = assigned ?? r.assigned_to ?? '';
  const resp = response ?? r.public_response ?? '';
  return (
    <div class='flex flex-col gap-2'>
      <div class='flex flex-wrap items-center gap-1.5'>
        <Button variant={['xs', 'ghost']} onClick={onBack}>
          ‹ Reports
        </Button>
        <h3 class='font-semibold text-base'>Report {r.public_id}</h3>
        {statusPill(r.status)}
        {r.source === 'game' ? (
          <Pill kind='info'>in game</Pill>
        ) : (
          <Pill>website</Pill>
        )}
        <Button variant={['xs', 'ghost']} class='ml-auto' onClick={reload}>
          Refresh
        </Button>
      </div>
      <div class='grid grid-cols-1 gap-2 sm:grid-cols-2'>
        <Section title='Report'>
          <div class='flex flex-col gap-0.5 text-xs'>
            <div>
              <span class='text-base-content/60'>Reported: </span>
              {r.reported_character_id ? (
                <button
                  type='button'
                  class='font-semibold hover:underline'
                  onClick={() => openPlayer(r.reported_character_id!)}
                >
                  {capitalize(r.reported_name)}
                </button>
              ) : (
                <b>{capitalize(r.reported_name)}</b>
              )}
              {r.reported_account_name ? (
                <span class='text-base-content/50'>
                  {' '}
                  ({r.reported_account_name})
                </span>
              ) : null}
            </div>
            <div>
              <span class='text-base-content/60'>By: </span>
              {r.reporter_name
                ? capitalize(r.reporter_name)
                : 'website visitor'}
            </div>
            <div>
              <span class='text-base-content/60'>Category: </span>
              {r.category}
            </div>
            <div>
              <span class='text-base-content/60'>Filed: </span>
              {shortDate(r.created_at)}
              {r.incident_at ? ` · incident ${shortDate(r.incident_at)}` : ''}
            </div>
            {r.map_id != null && (
              <div>
                <span class='text-base-content/60'>Where: </span>map #{r.map_id}{' '}
                ({r.x}, {r.y})
              </div>
            )}
            <p class='mt-1 whitespace-pre-line rounded bg-base-content/5 p-1.5'>
              {r.description}
            </p>
          </div>
        </Section>
        <Section title={`Evidence (${data.attachments.length})`}>
          {data.attachments.length === 0 ? (
            <Empty>No attachments.</Empty>
          ) : (
            <div class='flex flex-wrap gap-1'>
              {data.attachments.map((a) =>
                a.url ? (
                  <a
                    key={a.id}
                    href={a.url}
                    target='_blank'
                    rel='noopener noreferrer'
                    title='Open full size'
                  >
                    <img
                      src={a.url}
                      alt={`Evidence ${a.id}`}
                      class='max-h-32 max-w-full rounded border border-base-content/20'
                      loading='lazy'
                    />
                  </a>
                ) : (
                  <span key={a.id} class='text-xs'>
                    #{a.id} {a.mime} ({Math.round(a.size / 1024)} KB) — open it
                    in the website panel
                  </span>
                ),
              )}
            </div>
          )}
          {data.attachments.some((a) => a.url) && (
            <div class='mt-1 text-[0.65rem] text-base-content/50'>
              Preview links expire after {data.link_minutes} minutes (Refresh
              for new ones).
            </div>
          )}
        </Section>
      </div>
      <div class='grid grid-cols-1 gap-2 sm:grid-cols-2'>
        <Section title='Status'>
          <div class='flex flex-col gap-1'>
            <div class='grid grid-cols-2 gap-1'>
              <Field label='Status'>
                <SelectInput
                  value={st}
                  onChange={setStatus}
                  options={session.report_statuses.map((s) => ({
                    value: s,
                    label: STATUS_LABELS[s] ?? s,
                  }))}
                />
              </Field>
              <Field label='Assigned to'>
                <TextInput
                  value={as}
                  onChange={setAssigned}
                  maxLength={32}
                  placeholder='staff name'
                />
              </Field>
            </div>
            <Field label='Response to the reporter (shown on the report status page)'>
              <TextArea value={resp} onChange={setResponse} maxLength={1000} />
            </Field>
            <div class='flex justify-end gap-1'>
              {r.status === 'submitted' && (
                <Button
                  variant={['xs', 'outline']}
                  onClick={() =>
                    act(
                      'reports.update',
                      {
                        id,
                        status: 'under_review',
                        assigned_to: as || session.name,
                        public_response: resp,
                      },
                      reload,
                    )
                  }
                >
                  Take it (under review)
                </Button>
              )}
              <Button
                variant={['xs', 'primary']}
                onClick={() =>
                  act(
                    'reports.update',
                    { id, status: st, assigned_to: as, public_response: resp },
                    reload,
                  )
                }
              >
                Save
              </Button>
            </div>
          </div>
        </Section>
        <Section title={`Staff notes (${data.notes.length})`}>
          <ul class='flex max-h-40 flex-col gap-1 overflow-auto text-xs'>
            {data.notes.map((n) => (
              <li
                key={n.created_at + n.author}
                class='rounded bg-base-content/5 p-1'
              >
                <span class='text-[0.65rem] text-base-content/50'>
                  {n.author} · {shortDate(n.created_at)}
                </span>
                <div class='whitespace-pre-line'>{n.note}</div>
              </li>
            ))}
          </ul>
          <div class='mt-1 flex flex-col gap-1'>
            <TextArea
              value={note}
              onChange={setNote}
              maxLength={2000}
              placeholder='Internal note (staff only, also visible on the website panel)'
            />
            <div class='flex justify-end'>
              <Button
                variant={['xs', 'primary']}
                disabled={!note.trim()}
                onClick={() =>
                  act('reports.note', { id, note }, () => {
                    setNote('');
                    reload();
                  })
                }
              >
                Add note
              </Button>
            </div>
          </div>
        </Section>
      </div>
      <Section
        title={`Act on ${capitalize(r.reported_name)} (linked to this report)`}
      >
        {r.reported_character_id ? (
          <ModerationForm
            characterId={r.reported_character_id}
            name={capitalize(r.reported_name)}
            reportId={id}
            onDone={reload}
          />
        ) : (
          <Empty>
            No character named “{r.reported_name}” exists, so there is nobody to
            act on.
          </Empty>
        )}
      </Section>
      <div class='grid grid-cols-1 gap-2 sm:grid-cols-2'>
        <Section title='Actions taken from this report'>
          {data.actions.length === 0 ? (
            <Empty>None yet.</Empty>
          ) : (
            <ul class='text-xs'>
              {data.actions.map((a) => (
                <li key={a.created_at + a.action}>
                  {shortDate(a.created_at)} <b>{a.action}</b> by {a.by}:{' '}
                  {a.reason}
                </li>
              ))}
            </ul>
          )}
        </Section>
        <Section title='Earlier reports about this player'>
          {data.prior.length === 0 ? (
            <Empty>None.</Empty>
          ) : (
            <ul class='text-xs'>
              {data.prior.map((p) => (
                <li key={p.id} class='flex justify-between gap-1'>
                  <span>
                    {p.public_id} {p.category}
                  </span>
                  {statusPill(p.status)}
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </div>
  );
}
