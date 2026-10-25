import { Attribute } from '../../types';

/** Display palette shared by card badges, the rulebook, and field effects. */
export const attributeColors: Record<Attribute, string> = {
  [Attribute.FIRE]: '#C65D50',
  [Attribute.WATER]: '#5187B0',
  [Attribute.EARTH]: '#987047',
  [Attribute.AIR]: '#55A58C',
  [Attribute.ELECTRIC]: '#D9B13B',
  [Attribute.NORMAL]: '#cbd0d8',
  [Attribute.DARK]: '#7652AD',
  [Attribute.LIGHT]: '#ffe89a',
};
