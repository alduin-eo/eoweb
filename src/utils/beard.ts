import { Gender } from 'eolib';
import { MAX_HAIR_STYLE, MAX_MALE_HAIR_STYLE_CHOICE } from '@/consts';

// Beards are drawn into the male hair graphics (gfx009) rather than being a separate layer:
//   styles  1-20  regular hairstyles (both genders)
//   styles 21-40  styles 1-20 with a beard (male only)
//   styles 41-70  extra hairstyles that only exist with a beard (male only)
// The UI shows a "choice" (1-20 regular, 21-50 extra) plus a beard toggle and maps it here.
const BEARD_OFFSET = MAX_HAIR_STYLE;

export function hasBeardOption(gender: Gender): boolean {
  return gender === Gender.Male;
}

export function maxHairStyleChoice(gender: Gender): number {
  return hasBeardOption(gender) ? MAX_MALE_HAIR_STYLE_CHOICE : MAX_HAIR_STYLE;
}

// Extra hairstyles (choice 21-50) only exist with a beard; bald (0) has none.
export function isBeardForced(choice: number): boolean {
  return choice > MAX_HAIR_STYLE;
}

export function isBeardAvailable(gender: Gender, choice: number): boolean {
  return hasBeardOption(gender) && choice > 0;
}

export function toHairStyle(
  gender: Gender,
  choice: number,
  beard: boolean,
): number {
  if (!isBeardAvailable(gender, choice)) {
    return Math.min(choice, MAX_HAIR_STYLE);
  }

  if (isBeardForced(choice) || beard) {
    return choice + BEARD_OFFSET;
  }

  return choice;
}

export function fromHairStyle(hairStyle: number): {
  choice: number;
  beard: boolean;
} {
  if (hairStyle > MAX_HAIR_STYLE) {
    return { choice: hairStyle - BEARD_OFFSET, beard: true };
  }

  return { choice: hairStyle, beard: false };
}
