import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ReasonPromptModal, REASON_PROMPT_TEST_IDS } from '../ReasonPromptModal';

const TITLE = 'Request Revision';

describe('ReasonPromptModal', () => {
  const onCancel = jest.fn();
  const onConfirm = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders title and message when visible', () => {
    const { getByText } = render(
      <ReasonPromptModal
        visible
        title={TITLE}
        message="Please explain what changes you need."
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    );
    expect(getByText(TITLE)).toBeTruthy();
    expect(getByText('Please explain what changes you need.')).toBeTruthy();
  });

  it('resets the input each time the modal opens', () => {
    const { getByTestId, rerender } = render(
      <ReasonPromptModal visible title={TITLE} onCancel={onCancel} onConfirm={onConfirm} />
    );
    fireEvent.changeText(getByTestId(REASON_PROMPT_TEST_IDS.input), 'stale reason');

    rerender(
      <ReasonPromptModal visible={false} title={TITLE} onCancel={onCancel} onConfirm={onConfirm} />
    );
    rerender(<ReasonPromptModal visible title={TITLE} onCancel={onCancel} onConfirm={onConfirm} />);

    expect(getByTestId(REASON_PROMPT_TEST_IDS.input).props.value).toBe('');
  });

  it('calls onConfirm with the trimmed reason when required is satisfied', () => {
    const { getByTestId } = render(
      <ReasonPromptModal visible title={TITLE} onCancel={onCancel} onConfirm={onConfirm} />
    );
    fireEvent.changeText(getByTestId(REASON_PROMPT_TEST_IDS.input), '  Damaged ceiling  ');
    fireEvent.press(getByTestId(REASON_PROMPT_TEST_IDS.confirm));

    expect(onConfirm).toHaveBeenCalledWith('Damaged ceiling');
  });

  it('shows an inline error when confirming an empty required field', () => {
    const { getByTestId, getByText } = render(
      <ReasonPromptModal visible title={TITLE} onCancel={onCancel} onConfirm={onConfirm} />
    );
    fireEvent.press(getByTestId(REASON_PROMPT_TEST_IDS.confirm));

    expect(getByText('Please provide a reason')).toBeTruthy();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('clears the inline error once the user types after a failed confirm', () => {
    const { getByTestId, getByText, queryByText } = render(
      <ReasonPromptModal visible title={TITLE} onCancel={onCancel} onConfirm={onConfirm} />
    );
    fireEvent.press(getByTestId(REASON_PROMPT_TEST_IDS.confirm));
    expect(getByText('Please provide a reason')).toBeTruthy();

    // Typing after a failed confirm must clear the error even though touched
    // stays true — this is the state transition the pressable-button fix enables.
    fireEvent.changeText(getByTestId(REASON_PROMPT_TEST_IDS.input), 'Leaking pipe');
    expect(queryByText('Please provide a reason')).toBeNull();
  });

  it('does not confirm with whitespace-only input when required', () => {
    const { getByTestId } = render(
      <ReasonPromptModal visible title={TITLE} onCancel={onCancel} onConfirm={onConfirm} />
    );
    fireEvent.changeText(getByTestId(REASON_PROMPT_TEST_IDS.input), '   ');
    fireEvent.press(getByTestId(REASON_PROMPT_TEST_IDS.confirm));

    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('allows empty reason when required is false (optional reason)', () => {
    const { getByTestId } = render(
      <ReasonPromptModal
        visible
        title={TITLE}
        required={false}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    );
    fireEvent.press(getByTestId(REASON_PROMPT_TEST_IDS.confirm));

    expect(onConfirm).toHaveBeenCalledWith('');
  });

  it('calls onCancel when the cancel button is pressed', () => {
    const { getByTestId } = render(
      <ReasonPromptModal visible title={TITLE} onCancel={onCancel} onConfirm={onConfirm} />
    );
    fireEvent.press(getByTestId(REASON_PROMPT_TEST_IDS.cancel));

    expect(onCancel).toHaveBeenCalled();
  });

  it('disables both buttons while submitting', () => {
    const { getByTestId } = render(
      <ReasonPromptModal
        visible
        title={TITLE}
        submitting
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    );
    const cancel = getByTestId(REASON_PROMPT_TEST_IDS.cancel);
    const confirm = getByTestId(REASON_PROMPT_TEST_IDS.confirm);

    // TouchableOpacity doesn't expose a raw `disabled` host prop — RN's
    // pressability reflects it via accessibilityState on the underlying view.
    expect(cancel.props.accessibilityState.disabled).toBe(true);
    expect(confirm.props.accessibilityState.disabled).toBe(true);
  });
});
