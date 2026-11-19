/**
 * CT7-059: selected amenity / service chips read "Prepaid Water_electricity"
 * and "Bbq" — `value.replace('_', ' ')` replaces only the first underscore.
 */
import { optionLabel } from '../optionLabel';

const OPTIONS = [
  { value: 'bbq', label: 'BBQ' },
  { value: 'prepaid_water_electricity', label: 'Prepaid Water/Electricity' },
];

describe('optionLabel (CT7-059)', () => {
  it("uses the option's own label", () => {
    expect(optionLabel('bbq', OPTIONS)).toBe('BBQ');
    expect(optionLabel('prepaid_water_electricity', OPTIONS)).toBe('Prepaid Water/Electricity');
  });

  it('formats an unknown (custom) value, replacing every underscore', () => {
    expect(optionLabel('rooftop_deck_view', OPTIONS)).toBe('Rooftop Deck View');
    expect(optionLabel('Rooftop Deck', OPTIONS)).toBe('Rooftop Deck');
  });
});

describe('no first-underscore-only replace in the app (CT7-059 guard)', () => {
  const fs = jest.requireActual('fs') as typeof import('fs');
  const path = jest.requireActual('path') as typeof import('path');
  const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
  const files = (dir: string): string[] =>
    fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
      const rel = path.join(dir, e.name);
      if (e.isDirectory()) return e.name === '__tests__' ? [] : files(rel);
      return /\.tsx?$/.test(e.name) ? [rel] : [];
    });

  it("no .replace('_', …) with a string pattern — use /_/g", () => {
    const offenders = ['src', 'app']
      .flatMap(files)
      .filter((rel) =>
        /\.replace\(\s*(['"])_\1\s*,/.test(fs.readFileSync(path.join(ROOT, rel), 'utf8'))
      );
    expect(offenders).toEqual([]);
  });
});
