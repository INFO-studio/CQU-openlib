import type { Mn } from '~/types/mdast';

const removePositionRecursion = (input: unknown): unknown => {
  if (input === null || input === undefined) {
    return input;
  }

  if (Array.isArray(input)) {
    return input.map(removePositionRecursion);
  }

  if (typeof input === 'object') {
    return Object.fromEntries(
      Object.entries(input)
        .filter(([key]) => key !== 'position')
        .map(([key, value]) => [key, removePositionRecursion(value)]),
    );
  }

  return input;
};
const removePosition = (input: Mn) => removePositionRecursion(input) as Mn;

export default removePosition;
