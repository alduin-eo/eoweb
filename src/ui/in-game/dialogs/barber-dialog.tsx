import {
  BigCoords,
  CharacterMapInfo,
  Direction,
  EquipmentMapInfo,
  Gender,
} from 'eolib';
import { useCallback, useEffect, useState } from 'preact/hooks';
import { FaCut } from 'react-icons/fa';
import {
  BARBER_BASE_COST,
  BARBER_COST_PER_LEVEL,
  MAX_HAIR_COLOR,
  MIN_HAIR_COLOR,
} from '@/consts';
import {
  Button,
  CharacterPreview,
  CycleInput,
  drawCharacterPreview,
} from '@/ui/components';
import { useClient, useLocale } from '@/ui/context';
import {
  fromHairStyle,
  hasBeardOption,
  isBeardAvailable,
  isBeardForced,
  maxHairStyleChoice,
  toHairStyle,
} from '@/utils';
import { DialogBase } from './dialog-base';

const DIRECTION_COUNT = 4;
const MIN_BARBER_HAIR_STYLE = 0;

function makeBarberPreview(
  playerId: number,
  source: CharacterMapInfo,
  hairStyle: number,
  hairColor: number,
  showHat: boolean,
): CharacterMapInfo {
  const info = new CharacterMapInfo();
  info.playerId = playerId;
  info.name = source.name;
  info.coords = new BigCoords();
  info.coords.x = 200;
  info.coords.y = 200;
  info.direction = source.direction;
  info.gender = source.gender;
  info.hairStyle = hairStyle;
  info.hairColor = hairColor;
  info.skin = source.skin;

  const equip = new EquipmentMapInfo();
  equip.boots = source.equipment.boots;
  equip.armor = source.equipment.armor;
  equip.hat = showHat ? source.equipment.hat : 0;
  equip.shield = source.equipment.shield;
  equip.weapon = source.equipment.weapon;
  info.equipment = equip;

  return info;
}

export function BarberDialog() {
  const client = useClient();
  const { locale } = useLocale();

  const previewId = client.playerId + 10000;

  const playerChar = client.getCharacterById(client.playerId);

  const gender = playerChar?.gender ?? Gender.Female;
  const [initialHair] = useState(() =>
    fromHairStyle(playerChar?.hairStyle ?? MIN_BARBER_HAIR_STYLE),
  );
  const [hairChoice, setHairChoice] = useState(initialHair.choice);
  const [beard, setBeard] = useState(initialHair.beard);
  const hairStyle = toHairStyle(gender, hairChoice, beard);
  const [hairColor, setHairColor] = useState(
    () => playerChar?.hairColor ?? MIN_HAIR_COLOR,
  );
  const [showHat, setShowHat] = useState(true);
  const [direction, setDirection] = useState<Direction>(Direction.Down);
  const [previewUrl, setPreviewUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    const source = client.getCharacterById(client.playerId);
    if (!source) return;

    const existing = client.nearby.characters.findIndex(
      (c) => c.playerId === previewId,
    );
    const fakeChar = makeBarberPreview(
      previewId,
      source,
      hairStyle,
      hairColor,
      showHat,
    );
    fakeChar.direction = direction;

    if (existing >= 0) {
      client.nearby.characters[existing] = fakeChar;
    } else {
      client.nearby.characters.push(fakeChar);
    }

    client.atlas.refreshAsync().then(() => {
      setPreviewUrl(drawCharacterPreview(client, previewId, direction));
    });

    return () => {
      client.nearby.characters = client.nearby.characters.filter(
        (c) => c.playerId !== previewId,
      );
    };
  }, [client, previewId, hairStyle, hairColor, showHat, direction]);

  useEffect(() => {
    const handlePurchased = () => {
      // Cleanup is handled by the dialog close via in-game container
    };
    client.barberController.subscribePurchased(handlePurchased);
    return () => {
      client.barberController.unsubscribePurchased(handlePurchased);
    };
  }, [client]);

  const rotatePreview = useCallback(() => {
    setDirection((d) => ((d + 1) % DIRECTION_COUNT) as Direction);
  }, []);

  const formatHairStyle = useCallback(
    (value: number) => (value === 0 ? locale.barber.bald : String(value)),
    [locale],
  );

  const cost = BARBER_BASE_COST + BARBER_COST_PER_LEVEL * client.level;

  const [goldOnHand, setGoldOnHand] = useState(
    () => client.inventoryController.goldAmount,
  );

  useEffect(() => {
    const handler = () => setGoldOnHand(client.inventoryController.goldAmount);
    client.inventoryController.subscribeInventoryChanged(handler);
    return () =>
      client.inventoryController.unsubscribeInventoryChanged(handler);
  }, [client]);

  const canAfford = goldOnHand >= cost;

  const handleBuy = useCallback(() => {
    client.barberController.confirmBuyHairStyle(hairStyle, hairColor);
  }, [client, hairStyle, hairColor]);

  return (
    <DialogBase id='barber' title={locale.barber.title} size='sm'>
      <div class='flex gap-4 p-2'>
        <button
          type='button'
          class='flex shrink-0 cursor-pointer items-center justify-center border-none bg-transparent p-0'
          onClick={rotatePreview}
        >
          <CharacterPreview previewUrl={previewUrl} alt='preview' />
        </button>

        <div class='flex min-w-0 flex-1 flex-col gap-3'>
          <CycleInput
            label={locale.barber.hairStyle}
            value={hairChoice}
            min={MIN_BARBER_HAIR_STYLE}
            max={maxHairStyleChoice(gender)}
            format={formatHairStyle}
            onChange={setHairChoice}
          />
          {hasBeardOption(gender) && (
            <label class='flex cursor-pointer items-center gap-2 text-sm'>
              <input
                type='checkbox'
                name='beard'
                class='checkbox checkbox-sm'
                checked={
                  isBeardForced(hairChoice) ||
                  (beard && isBeardAvailable(gender, hairChoice))
                }
                disabled={
                  isBeardForced(hairChoice) ||
                  !isBeardAvailable(gender, hairChoice)
                }
                onChange={(e) =>
                  setBeard((e.target as HTMLInputElement).checked)
                }
              />
              {locale.barber.beard}
            </label>
          )}
          <CycleInput
            label={locale.barber.hairColor}
            value={hairColor}
            min={MIN_HAIR_COLOR}
            max={MAX_HAIR_COLOR - 1}
            onChange={setHairColor}
          />
          <label class='flex cursor-pointer items-center gap-2 text-sm'>
            <input
              type='checkbox'
              class='checkbox checkbox-sm'
              checked={showHat}
              onChange={(e) =>
                setShowHat((e.target as HTMLInputElement).checked)
              }
            />
            {locale.barber.showHat}
          </label>

          <p class='text-base-content/60 text-xs'>
            {locale.barber.cost}:{' '}
            <span class='font-semibold text-base-content'>
              {cost.toLocaleString()}
            </span>{' '}
            {locale.shared.wordGold}
          </p>

          <Button
            variant={['sm', 'primary']}
            onClick={handleBuy}
            disabled={!canAfford}
          >
            <FaCut size={11} />
            {locale.barber.buy}
          </Button>
        </div>
      </div>
    </DialogBase>
  );
}
