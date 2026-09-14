// The fixed set of strategy nudges. One shows per committed guess and rotates.
// Fixed strings, never generated. Pure.

export const NUDGES: string[] = [
  "Track your turns as you walk. Count the lefts and rights.",
  "Notice where the sun sits when you set out.",
  "Pick a far landmark and keep it behind you.",
  "Say the direction out loud before you look.",
  "Picture the route as one line, not a list of streets.",
  "Feel which way the ground slopes. Hills hold their bearing.",
];

export function nudgeAt(index: number): string {
  const len = NUDGES.length;
  return NUDGES[((index % len) + len) % len];
}
