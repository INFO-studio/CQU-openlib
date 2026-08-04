import { describe, expect, it } from 'vite-plus/test';
import { rotationFromSteps } from '~/components/ui/image-preview';

describe('rotationFromSteps', () => {
  it('normalizes repeated quarter turns without accumulating full rotations', () => {
    expect([0, 1, 2, 3, 4].map(rotationFromSteps)).toEqual([
      0, 90, 180, -90, 0,
    ]);
    expect([0, -1, -2, -3, -4].map(rotationFromSteps)).toEqual([
      0, -90, 180, 90, 0,
    ]);
  });
});
