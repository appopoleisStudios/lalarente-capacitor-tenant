import { colors } from './colors';
import { typography } from './typography';
import { spacing } from './spacing';

export type Colors = typeof colors;
export type Typography = typeof typography;
export type Spacing = typeof spacing;

export interface Theme {
  colors: Colors;
  typography: Typography;
  spacing: Spacing;
}
