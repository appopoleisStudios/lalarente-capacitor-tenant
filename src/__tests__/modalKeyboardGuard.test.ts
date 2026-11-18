/**
 * CT7-047 regression guard. On Android an RN <Modal> window does not resize
 * for the keyboard, so a modal with text inputs and no KeyboardAvoidingView
 * hides its lower fields and its buttons behind the keyboard (build 11:
 * vendor "Add Service" — Base Price and the Add button unreachable while
 * typing). Every <Modal> in src/ that contains a TextInput must handle the
 * keyboard itself.
 */
import fs from 'fs';
import path from 'path';

const SRC = path.resolve(__dirname, '..');

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sourceFiles(full);
    return entry.name.endsWith('.tsx') ? [full] : [];
  });
}

function modalsWithoutKeyboardHandling(): string[] {
  const offenders: string[] = [];
  for (const file of sourceFiles(SRC)) {
    const src = fs.readFileSync(file, 'utf8');
    let from = 0;
    for (;;) {
      const start = src.indexOf('<Modal', from);
      if (start < 0) break;
      const end = src.indexOf('</Modal>', start);
      if (end < 0) break;
      const block = src.slice(start, end);
      if (block.includes('<TextInput') && !block.includes('KeyboardAvoidingView')) {
        const line = src.slice(0, start).split('\n').length;
        offenders.push(`${path.relative(SRC, file)}:${line}`);
      }
      from = end;
    }
  }
  return offenders;
}

describe('modals with text inputs handle the keyboard (CT7-047)', () => {
  it('every <Modal> containing a TextInput wraps its content in KeyboardAvoidingView', () => {
    expect(modalsWithoutKeyboardHandling()).toEqual([]);
  });
});
