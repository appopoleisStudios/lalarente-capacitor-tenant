import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { ModalSheet } from '../ModalSheet';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, bottom: 48, left: 0, right: 0 }),
}));

describe('ModalSheet', () => {
  it('keeps its last row above the Android navigation bar (bottom inset)', () => {
    const { getByTestId } = render(
      <ModalSheet visible onClose={jest.fn()} title="Sheet">
        <Text>Content</Text>
      </ModalSheet>
    );
    expect(StyleSheet.flatten(getByTestId('modal-sheet').props.style).paddingBottom).toBe(48);
  });

  it("adds a caller's paddingBottom to the inset instead of replacing it", () => {
    const { getByTestId } = render(
      <ModalSheet visible onClose={jest.fn()} title="Sheet" style={{ paddingBottom: 16 }}>
        <Text>Content</Text>
      </ModalSheet>
    );
    expect(StyleSheet.flatten(getByTestId('modal-sheet').props.style).paddingBottom).toBe(64);
  });

  it('keeps the inset when the caller sets paddingBottom: 0', () => {
    const { getByTestId } = render(
      <ModalSheet visible onClose={jest.fn()} title="Sheet" style={{ paddingBottom: 0 }}>
        <Text>Content</Text>
      </ModalSheet>
    );
    expect(StyleSheet.flatten(getByTestId('modal-sheet').props.style).paddingBottom).toBe(48);
  });

  it('renders nothing when not visible', () => {
    const { queryByText } = render(
      <ModalSheet visible={false} onClose={jest.fn()} title="Test">
        <>{'Content'}</>
      </ModalSheet>
    );
    expect(queryByText('Test')).toBeNull();
  });

  it('renders title and content when visible', () => {
    const { getByText } = render(
      <ModalSheet visible={true} onClose={jest.fn()} title="Modal Title">
        <Text>Modal Content</Text>
      </ModalSheet>
    );
    expect(getByText('Modal Title')).toBeTruthy();
    expect(getByText('Modal Content')).toBeTruthy();
  });

  it('does not call onClose on mount', () => {
    const handler = jest.fn();
    render(
      <ModalSheet visible={true} onClose={handler} title="Title">
        <>{'Content'}</>
      </ModalSheet>
    );
    expect(handler).not.toHaveBeenCalled();
  });

  it('renders without title when not provided', () => {
    const { getByText } = render(
      <ModalSheet visible={true} onClose={jest.fn()}>
        <Text>Content</Text>
      </ModalSheet>
    );
    expect(getByText('Content')).toBeTruthy();
  });
});
