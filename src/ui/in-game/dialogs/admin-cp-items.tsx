import { useState } from 'preact/hooks';
import { Button, ItemIcon } from '@/ui/components';
import { capitalize } from '@/utils';
import {
  Field,
  ItemPicker,
  type ItemRow,
  Pill,
  PlayerPicker,
  type PlayerRow,
  Section,
  TextInput,
  useAdminCp,
} from './admin-cp-shared';

const GOLD: ItemRow = {
  id: 1,
  name: 'Gold',
  graphic: 1,
  type: 'Gold',
  alduin: false,
};

export function ItemsSection({ preset }: { preset?: PlayerRow | null }) {
  const { session, act, confirm, openPlayer } = useAdminCp();
  const [player, setPlayer] = useState<PlayerRow | null>(preset ?? null);
  const [item, setItem] = useState<ItemRow | null>(null);
  const [amount, setAmount] = useState('1');
  const [reason, setReason] = useState('');
  const alduin: ItemRow | null = session.alduin_item_id
    ? {
        id: session.alduin_item_id,
        name: 'Alduin',
        graphic: 0,
        type: 'General',
        alduin: true,
      }
    : null;

  const n = Number(amount);
  const isAlduin = item?.alduin || (alduin !== null && item?.id === alduin.id);
  const amountOk =
    Number.isInteger(n) &&
    n >= 1 &&
    n <= (isAlduin ? session.alduin_max_amount : session.max_item_amount);
  const blocked = isAlduin && !session.owner;
  const ready = player && item && amountOk && reason.trim() && !blocked;

  const run = (direction: 'give' | 'remove') => {
    if (!player || !item) return;
    const who = capitalize(player.name);
    confirm({
      title: `${direction === 'give' ? 'Give' : 'Remove'} ${n.toLocaleString()} ${item.name}`,
      message: `${direction === 'give' ? 'To' : 'From'} ${who}${player.online ? ' (online, applied live)' : ' (offline, saved to the character)'}.\nReason: ${reason}${isAlduin ? '\n\nAlduin is a real-money item. This is recorded with before/after balances.' : ''}`,
      confirmLabel: direction === 'give' ? 'Give' : 'Remove',
      danger: direction === 'remove' || isAlduin,
      onConfirm: () =>
        act(
          'items.adjust',
          {
            character_id: player.character_id,
            item_id: item.id,
            amount: n,
            direction,
            reason,
          },
          () => setReason(''),
        ),
    });
  };

  return (
    <div class='flex flex-col gap-2'>
      <div class='grid grid-cols-1 gap-2 sm:grid-cols-2'>
        <Section title='1. Player'>
          {player ? (
            <div class='flex items-center justify-between gap-2 rounded bg-base-content/5 px-2 py-1 text-xs'>
              <button
                type='button'
                class='truncate text-left font-semibold hover:underline'
                onClick={() => openPlayer(player.character_id)}
              >
                {capitalize(player.name)}{' '}
                <span class='font-normal text-base-content/50'>
                  ({player.account})
                </span>
              </button>
              {player.online ? (
                <Pill kind='ok'>online</Pill>
              ) : (
                <Pill>offline</Pill>
              )}
              <Button variant={['xs', 'ghost']} onClick={() => setPlayer(null)}>
                Change
              </Button>
            </div>
          ) : (
            <PlayerPicker onPick={setPlayer} />
          )}
        </Section>
        <Section title='2. Item'>
          <div class='mb-1 flex flex-wrap gap-1'>
            <Button
              variant={['xs', item?.id === 1 ? 'primary' : 'outline']}
              onClick={() => setItem(GOLD)}
            >
              Gold
            </Button>
            {alduin && (
              <Button
                variant={['xs', isAlduin ? 'primary' : 'outline']}
                onClick={() => setItem(alduin)}
              >
                Alduin {session.owner ? '' : '(owner only)'}
              </Button>
            )}
          </div>
          {item ? (
            <div class='flex items-center gap-2 rounded bg-base-content/5 px-2 py-1 text-xs'>
              {item.graphic > 0 && (
                <span class='flex h-6 w-6 items-center justify-center'>
                  <ItemIcon
                    graphicId={item.graphic}
                    alt=''
                    class='max-h-6 max-w-6'
                  />
                </span>
              )}
              <span class='truncate font-semibold'>{item.name}</span>
              <span class='text-base-content/40'>#{item.id}</span>
              <Button
                variant={['xs', 'ghost']}
                class='ml-auto'
                onClick={() => setItem(null)}
              >
                Change
              </Button>
            </div>
          ) : (
            <ItemPicker onPick={setItem} />
          )}
        </Section>
      </div>
      <Section title='3. Amount and reason'>
        <div class='grid grid-cols-1 gap-1 sm:grid-cols-[8rem_1fr] sm:items-end'>
          <Field
            label={`Amount (max ${(isAlduin ? session.alduin_max_amount : session.max_item_amount).toLocaleString()})`}
          >
            <TextInput value={amount} onChange={setAmount} type='number' />
          </Field>
          <Field label='Reason (kept with the adjustment)'>
            <TextInput
              value={reason}
              onChange={setReason}
              maxLength={1000}
              placeholder='Required, e.g. compensation for bug #12'
            />
          </Field>
        </div>
        {blocked && (
          <div class='mt-1 text-error text-xs'>
            Alduin can only be changed by owner accounts (server setting
            [admin_cp] owner_accounts).
          </div>
        )}
        {!amountOk && amount !== '' && (
          <div class='mt-1 text-error text-xs'>
            Enter a whole number in range.
          </div>
        )}
        <div class='mt-2 flex justify-end gap-1'>
          <Button
            variant={['xs', 'outline']}
            disabled={!ready}
            onClick={() => run('remove')}
          >
            Remove from player
          </Button>
          <Button
            variant={['xs', 'primary']}
            disabled={!ready}
            onClick={() => run('give')}
          >
            Give to player
          </Button>
        </div>
      </Section>
      <div class='text-[0.65rem] text-base-content/50'>
        Online players see the change immediately; offline characters are
        changed while their account is locked against logging in. Every change
        is recorded (Players › History) and appears in the website panel.
      </div>
    </div>
  );
}
