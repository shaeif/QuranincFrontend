import { describe, expect, it } from 'vitest';
import { dateOfBirthProblem } from './signup-page';

describe('date of birth', () => {
  const today = new Date('2026-10-05T12:00:00Z');

  it('is required and must be a real, past date', () => {
    expect(dateOfBirthProblem('', today)).toBe('Enter your date of birth.');
    expect(dateOfBirthProblem('1990-02-30', today)).toBe('Enter a valid date of birth.');
    expect(dateOfBirthProblem('1850-01-01', today)).toBe('Enter a valid date of birth.');
    expect(dateOfBirthProblem('2027-01-01', today)).toContain('future');
    expect(dateOfBirthProblem('1995-06-15', today)).toBe('');
  });
});
