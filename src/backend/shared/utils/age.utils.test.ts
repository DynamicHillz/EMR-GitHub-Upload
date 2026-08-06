import { ageInYears, ageGroup } from './age.utils';

describe('age.utils', () => {
  describe('ageInYears', () => {
    it('computes age in fractional years between two dates', () => {
      const dob = new Date(2020, 0, 1);
      const at = new Date(2026, 0, 1);
      expect(ageInYears(dob, at)).toBeCloseTo(6, 1);
    });
  });

  describe('ageGroup boundaries', () => {
    it.each([
      [0, '<1'],
      [0.99, '<1'],
      [1, '1-4'],
      [4.99, '1-4'],
      [5, '5-9'],
      [9.99, '5-9'],
      [10, '10-19'],
      [19.99, '10-19'],
      [20, '20-49'],
      [49.99, '20-49'],
      [50, '50+'],
      [80, '50+'],
    ])('classifies age %s as %s', (age, expected) => {
      expect(ageGroup(age as number)).toBe(expected);
    });
  });
});
