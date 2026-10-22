import { useCallback, useState } from 'preact/hooks';
import { Button } from '@/ui/components';
import { capitalize } from '@/utils';
import {
  Empty,
  ErrorLine,
  Field,
  Loading,
  MapPicker,
  type MapRow,
  Pill,
  Section,
  SelectInput,
  TextInput,
  useAdminCp,
  useAdminQuery,
} from './admin-cp-shared';

type NpcRow = {
  id: number;
  name: string;
  level: number;
  hp: number;
  type: string;
  boss: boolean;
  child: boolean;
};
type OnlineRow = {
  character_id: number;
  name: string;
  map: number;
  map_name: string;
  x: number;
  y: number;
  is_bot: boolean;
};

function NpcSpawner() {
  const { request, act, confirm } = useAdminCp();
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<NpcRow[] | null>(null);
  const [npc, setNpc] = useState<NpcRow | null>(null);
  const [amount, setAmount] = useState('1');
  const [error, setError] = useState<string | null>(null);
  const search = useCallback(() => {
    setError(null);
    request<{ npcs: NpcRow[] }>('world.npcs', { q })
      .then((d) => setRows(d.npcs))
      .catch((e: Error) => setError(e.message));
  }, [q, request]);
  const n = Number(amount);
  return (
    <Section title='Spawn NPCs at my position'>
      {npc ? (
        <div class='flex items-center justify-between rounded bg-base-content/5 px-2 py-1 text-xs'>
          <span>
            #{npc.id} <b>{npc.name}</b> Lv {npc.level}, {npc.hp} HP{' '}
            {npc.boss && <Pill kind='bad'>boss</Pill>}{' '}
            {npc.child && <Pill kind='warn'>minion</Pill>}
          </span>
          <Button variant={['xs', 'ghost']} onClick={() => setNpc(null)}>
            Change
          </Button>
        </div>
      ) : (
        <div class='flex flex-col gap-1'>
          <div class='flex gap-1'>
            <TextInput
              value={q}
              onChange={setQ}
              onEnter={search}
              placeholder='NPC name or ID…'
              maxLength={32}
              type='search'
            />
            <Button variant={['xs', 'primary']} onClick={search}>
              Search
            </Button>
          </div>
          {error && <ErrorLine error={error} />}
          {rows && rows.length === 0 && <Empty>No NPCs found.</Empty>}
          {rows && rows.length > 0 && (
            <ul class='max-h-40 overflow-y-auto rounded-md bg-base-content/5'>
              {rows.map((r) => (
                <li key={r.id}>
                  <button
                    type='button'
                    class='flex w-full justify-between gap-2 px-2 py-1 text-left text-xs hover:bg-base-content/10'
                    onClick={() => {
                      setNpc(r);
                      setRows(null);
                    }}
                  >
                    <span class='truncate'>
                      <span class='text-base-content/50'>#{r.id}</span> {r.name}{' '}
                      {r.boss && <Pill kind='bad'>boss</Pill>}
                    </span>
                    <span class='text-base-content/50'>
                      Lv {r.level} · {r.type}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div class='mt-1 flex items-end gap-1'>
        <Field label='Amount (1–20)' class='w-24'>
          <TextInput value={amount} onChange={setAmount} type='number' />
        </Field>
        <Button
          variant={['xs', 'primary']}
          disabled={!npc || !(n >= 1 && n <= 20)}
          onClick={() =>
            npc &&
            confirm({
              title: `Spawn ${n} × ${npc.name}`,
              message:
                'They appear on your tile. Remove them later with “Remove staff-spawned NPCs”.',
              onConfirm: () =>
                act('world.spawn_npc', { npc_id: npc.id, amount: n }),
            })
          }
        >
          Spawn
        </Button>
      </div>
    </Section>
  );
}

function WhoIsWhere() {
  const { act, openPlayer } = useAdminCp();
  const { data, error, loading, reload } = useAdminQuery<{
    players: OnlineRow[];
  }>('players.online');
  const [bots, setBots] = useState(false);
  if (error) return <ErrorLine error={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const groups = new Map<string, OnlineRow[]>();
  for (const p of data.players.filter((p) => bots || !p.is_bot)) {
    const key = `#${p.map} ${p.map_name}`;
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }
  return (
    <Section
      title='Who is where'
      actions={
        <>
          <label class='flex cursor-pointer items-center gap-1 text-xs'>
            <input
              type='checkbox'
              class='checkbox checkbox-xs'
              checked={bots}
              onChange={(e) => setBots((e.target as HTMLInputElement).checked)}
            />
            bots
          </label>
          <Button variant={['xs', 'ghost']} onClick={reload}>
            {loading ? (
              <span class='loading loading-spinner loading-xs' />
            ) : (
              'Refresh'
            )}
          </Button>
        </>
      }
    >
      {groups.size === 0 ? (
        <Empty>Nobody online.</Empty>
      ) : (
        <div class='flex max-h-64 flex-col gap-1 overflow-auto'>
          {[...groups.entries()].map(([map, players]) => (
            <div key={map} class='rounded bg-base-content/5 p-1 text-xs'>
              <div class='font-semibold'>
                {map}{' '}
                <span class='font-normal text-base-content/50'>
                  ({players.length})
                </span>
              </div>
              <div class='flex flex-wrap gap-1'>
                {players.map((p) => (
                  <span
                    key={p.character_id}
                    class='inline-flex items-center gap-0.5 rounded bg-base-content/10 px-1'
                  >
                    <button
                      type='button'
                      class='hover:underline'
                      onClick={() => openPlayer(p.character_id)}
                    >
                      {capitalize(p.name)}
                    </button>
                    <button
                      type='button'
                      class='text-primary'
                      title='Teleport to them'
                      onClick={() =>
                        act('players.warp_to', { character_id: p.character_id })
                      }
                    >
                      ➜
                    </button>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

export function WorldSection() {
  const { act, confirm } = useAdminCp();
  const [map, setMap] = useState<MapRow | null>(null);
  const [x, setX] = useState('');
  const [y, setY] = useState('');
  const [magnitude, setMagnitude] = useState('4');
  return (
    <div class='flex flex-col gap-2'>
      <div class='grid grid-cols-1 gap-2 sm:grid-cols-2'>
        <Section title='Teleport me to a map'>
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
          <div class='mt-1 flex items-end gap-1'>
            <Field label='X' class='w-16'>
              <TextInput value={x} onChange={setX} type='number' />
            </Field>
            <Field label='Y' class='w-16'>
              <TextInput value={y} onChange={setY} type='number' />
            </Field>
            <Button
              variant={['xs', 'primary']}
              disabled={!map}
              onClick={() =>
                map &&
                act('world.warp_self', {
                  map: map.id,
                  x: x && y ? Number(x) : undefined,
                  y: x && y ? Number(y) : undefined,
                })
              }
            >
              Go
            </Button>
          </div>
        </Section>
        <NpcSpawner />
      </div>
      <Section title='Events on the server'>
        <div class='flex flex-wrap items-end gap-1'>
          <Field label='Quake strength' class='w-28'>
            <SelectInput
              value={magnitude}
              onChange={setMagnitude}
              options={[1, 2, 3, 4, 5, 6, 7, 8].map((m) => ({
                value: String(m),
                label: String(m),
              }))}
            />
          </Field>
          <Button
            variant={['xs', 'outline']}
            onClick={() =>
              confirm({
                title: 'Earthquake',
                message: `Every map shakes (strength ${magnitude}).`,
                onConfirm: () =>
                  act('world.event', {
                    event: 'quake',
                    magnitude: Number(magnitude),
                  }),
              })
            }
          >
            Quake
          </Button>
          <Button
            variant={['xs', 'outline']}
            onClick={() =>
              confirm({
                title: 'Evacuate this map',
                message:
                  'Starts the evacuation countdown on your current map; everyone on it is warped out.',
                danger: true,
                onConfirm: () => act('world.event', { event: 'evacuate' }),
              })
            }
          >
            Evacuate my map
          </Button>
          <Button
            variant={['xs', 'outline']}
            onClick={() => act('world.event', { event: 'global' })}
          >
            Toggle global chat
          </Button>
          <Button
            variant={['xs', 'outline']}
            onClick={() => act('world.event', { event: 'hide' })}
          >
            Hide / unhide me
          </Button>
          <Button
            variant={['xs', 'warning']}
            onClick={() =>
              confirm({
                title: 'Remove staff-spawned NPCs',
                message:
                  'Every NPC on your map that was spawned by staff disappears (no exp, no drops). Normal map spawns stay.',
                onConfirm: () => act('world.clear_npcs', {}),
              })
            }
          >
            Remove staff-spawned NPCs
          </Button>
        </div>
      </Section>
      <WhoIsWhere />
    </div>
  );
}
