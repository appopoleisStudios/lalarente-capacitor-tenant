// Shared by the Add / Edit Property CT7-009 tests: the rendered remove-photo
// controls with the styles actually applied to them.
import { StyleSheet, type ViewStyle } from 'react-native';
import type { RenderResult } from '@testing-library/react-native';

type ReactTestInstance = ReturnType<RenderResult['getByText']>;

export function removeControls(screen: RenderResult, testID: string) {
  return screen.queryAllByTestId(testID).map((button: ReactTestInstance) => {
    // the visible red circle: the host View that wraps the "×"
    let circle: ReactTestInstance | null = screen
      .getAllByText('×')
      .find((t) => isInside(t, button))!.parent;
    while (circle && !(circle.type === 'View' && flat(circle).width !== undefined)) {
      circle = circle.parent;
    }
    return { button, position: flat(button), size: circle ? flat(circle) : {} };
  });
}

function flat(node: ReactTestInstance): ViewStyle {
  return StyleSheet.flatten(node.props.style) ?? {};
}

function isInside(node: ReactTestInstance, ancestor: ReactTestInstance) {
  for (let n: ReactTestInstance | null = node; n; n = n.parent) if (n === ancestor) return true;
  return false;
}
