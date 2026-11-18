/**
 * CT7-050: on Android the tenant's "Add Comment" button (inspection report)
 * stayed under the keyboard — Android only scrolls the focused input into view.
 */
import fs from 'fs';
import path from 'path';
import { revealOffset, REVEAL_MARGIN } from '../useRevealAboveKeyboard';

describe('revealOffset (CT7-050)', () => {
  // edge-to-edge Android: the ScrollView frame is NOT shrunk by the keyboard
  const fullFrame = { y: 500, height: 1700 }; // bottom edge at 2200
  const keyboardTop = 1100;

  it('scrolls a block under the keyboard into view even when the frame is not resized', () => {
    // input 1050..1150 + button below → block 1050..1250
    expect(revealOffset({ y: 1050, height: 200 }, fullFrame, keyboardTop, 300)).toBe(
      300 + 150 + REVEAL_MARGIN
    );
  });

  it('uses the frame bottom when the window did shrink above the keyboard', () => {
    expect(revealOffset({ y: 900, height: 200 }, { y: 500, height: 500 }, 1500, 0)).toBe(
      100 + REVEAL_MARGIN
    );
  });

  it('leaves a block that is already visible alone', () => {
    expect(revealOffset({ y: 700, height: 200 }, fullFrame, keyboardTop, 300)).toBeNull();
  });

  it('scrolls when only the margin is missing', () => {
    expect(revealOffset({ y: 900, height: 195 }, fullFrame, keyboardTop, 0)).toBe(11);
  });
});

describe('InspectionScreen keeps "Add Comment" above the keyboard (CT7-050)', () => {
  const src = fs.readFileSync(
    path.resolve(__dirname, '../../../features/inspections/screens/InspectionScreen.tsx'),
    'utf8'
  );

  it('the comment input reports focus/blur and the input + button form the revealed block', () => {
    const block = src.slice(
      src.indexOf('<View ref={commentReveal.targetRef}'),
      src.indexOf('testID="inspection-tenant-comment-add"')
    );
    expect(block).toContain('testID="inspection-tenant-comment-input"');
    expect(block).toContain('onFocus={commentReveal.onFocus}');
    expect(block).toContain('onBlur={commentReveal.onBlur}');
  });

  it('the screen avoids the keyboard on Android too, so the ScrollView ends at it', () => {
    expect(src).toContain(
      "<KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>"
    );
  });

  it('the scroll view is driven by the hook', () => {
    expect(src).toContain('ref={commentReveal.scrollRef}');
    expect(src).toContain('onScroll={commentReveal.onScroll}');
  });
});
