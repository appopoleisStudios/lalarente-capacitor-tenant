import React from 'react';
import { Text } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { ModalSheet } from '../ModalSheet';

describe('ModalSheet', () => {
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
