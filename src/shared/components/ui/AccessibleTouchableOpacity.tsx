import React from 'react';
import {
  TouchableOpacity,
  TouchableOpacityProps,
  StyleSheet,
  ViewStyle,
} from 'react-native';

/**
 * Minimum touch target size per WCAG / Apple HIG / Android Material Design.
 * All interactive elements should be at least 44x44 dp.
 */
const MIN_TOUCH_SIZE = 44;

interface AccessibleTouchableOpacityProps extends TouchableOpacityProps {
  /** Required for icon-only buttons; optional if children contain text. */
  accessibilityLabel?: string;
  /** Hint that describes the result of the action. */
  accessibilityHint?: string;
}

/**
 * A drop-in replacement for TouchableOpacity that:
 * 1. Enforces a minimum 44x44 dp touch target (WCAG AAA)
 * 2. Requires accessibilityLabel on icon-only buttons
 * 3. Sets accessibilityRole="button" by default
 *
 * Use this for all tappable elements that aren't already covered by the
 * shared `Button` component.
 */
export const AccessibleTouchableOpacity: React.FC<
  AccessibleTouchableOpacityProps
> = ({
  style,
  activeOpacity = 0.7,
  accessibilityLabel,
  accessibilityHint,
  accessibilityRole = 'button',
  children,
  ...props
}) => {
  const hasVisibleText = hasTextChildren(children);

  const mergedStyle: ViewStyle = StyleSheet.flatten([
    { minHeight: MIN_TOUCH_SIZE, minWidth: MIN_TOUCH_SIZE },
    // If the element is an icon-only button and doesn't enforce its own size,
    // add padding to reach the minimum touch target.
    style as ViewStyle,
  ]);

  // If there's no visible text and no label, warn in dev
  if (!hasVisibleText && !accessibilityLabel && __DEV__) {
    console.warn(
      '[AccessibleTouchableOpacity] Icon-only button without accessibilityLabel. ' +
        'Add accessibilityLabel for screen reader support.',
    );
  }

  return (
    <TouchableOpacity
      style={mergedStyle}
      activeOpacity={activeOpacity}
      accessible={true}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      {...props}
    >
      {children}
    </TouchableOpacity>
  );
};

/**
 * Shallow check: does the children tree contain a non-empty string child?
 * This helps determine if the button has visible text (and thus doesn't
 * strictly need an explicit accessibilityLabel).
 */
function hasTextChildren(
  children: React.ReactNode,
): boolean {
  return (
    React.Children.toArray(children).some((child) => {
      if (typeof child === 'string' && child.trim().length > 0) return true;
      if (typeof child === 'number') return true;
      // Recurse into fragments and nested views
      if (React.isValidElement<{children?: React.ReactNode}>(child) && child.props.children) {
        return hasTextChildren(child.props.children);
      }
      return false;
    })
  );
}
