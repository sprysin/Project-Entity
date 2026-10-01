import { Attribute } from '../../types';

/** Display palette shared by the rulebook and attribute-driven field effects. */
export const attributeColors: Record<Attribute, string> = {
  [Attribute.FIRE]: '#ef5b4f',
  [Attribute.WATER]: '#4d9cff',
  [Attribute.EARTH]: '#b7793f',
  [Attribute.AIR]: '#8bdcf5',
  [Attribute.ELECTRIC]: '#f4d44d',
  [Attribute.NORMAL]: '#cbd0d8',
  [Attribute.DARK]: '#9a6ad8',
  [Attribute.LIGHT]: '#ffe89a',
};
