/**
 * CT7-010: Cancel / back on Edit Property always navigated to the Properties
 * tab, skipping the Property Detail the owner came from. Back must return to
 * the previous screen and use the Properties tab only when there is none.
 */
import fs from 'fs';
import path from 'path';

const SRC = fs
  .readFileSync(path.resolve(__dirname, '..', 'EditPropertyScreen.tsx'), 'utf8')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

describe('Edit Property back (CT7-010)', () => {
  it('goBackToProperties goes back when it can, else to the Properties tab', () => {
    expect(SRC).toMatch(
      /const goBackToProperties = \(\) => \{\s*if \(router\.canGoBack\(\)\) \{\s*router\.back\(\);\s*\} else \{\s*router\.navigate\('\/\(owner\)\/properties' as never\);\s*\}\s*\};/
    );
  });

  it('the back arrow and post-save OK both use goBackToProperties', () => {
    expect(SRC).toMatch(/<AnimatedButton onPress=\{goBackToProperties\}/);
    expect(SRC).toMatch(/\{ text: 'OK', onPress: \(\) => goBackToProperties\(\) \}/);
  });

  it('no other path jumps straight to the Properties tab', () => {
    expect(SRC.match(/router\.(navigate|replace|push)\('\/\(owner\)\/properties'/g)).toHaveLength(
      1
    );
  });
});
