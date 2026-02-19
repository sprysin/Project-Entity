
import { CardType, Card, Attribute, EntityType } from './types';

export const BASE_CARDS: Card[] = [
  {
    instanceId: '',
    id: 'entity_01',
    name: 'Solstice Sentinel',
    type: CardType.ENTITY,
    level: 4,
    attribute: Attribute.LIGHT,
    entityType: EntityType.MECHANICAL,
    atk: 140,
    def: 110,
    effectText: 'ON NORMAL SUMMON: Gain 100 LP.',
    ownerId: ''
  },
  {
    instanceId: '',
    id: 'entity_02',
    name: 'High King',
    type: CardType.ENTITY,
    level: 5,
    attribute: Attribute.NORMAL,
    entityType: EntityType.WARRIOR,
    atk: 170,
    def: 50,
    effectText: 'ON SUMMON: Target 1 face-up monster on the field; it loses 20 ATK.',
    ownerId: ''
  },
  {
    instanceId: '',
    id: 'entity_03',
    name: 'Force Fire Sparker',
    type: CardType.ENTITY,
    level: 2,
    attribute: Attribute.FIRE,
    entityType: EntityType.DEMON,
    atk: 30,
    def: 150,
    effectText: 'ON NORMAL SUMMON: Deal 10 damage for each set Action/Condition on opponent\'s field.',
    ownerId: ''
  },
  {
    instanceId: '',
    id: 'entity_04',
    name: 'Void Caster',
    type: CardType.ENTITY,
    level: 3,
    attribute: Attribute.DARK,
    entityType: EntityType.MAGICIAN,
    atk: 100,
    def: 80,
    effectText: 'ON SUMMON: Add "Void Blast" from your Discard to your hand.',
    ownerId: ''
  },
  {
    instanceId: '',
    id: 'entity_05',
    name: 'High Voltage - Charged Dragon',
    type: CardType.ENTITY,
    level: 8,
    attribute: Attribute.ELECTRIC,
    entityType: EntityType.DRAGON,
    atk: 250,
    def: 190,
    effectText: 'ON FIELD: Discard 1 card; this card gains 10 ATK.',
    ownerId: ''
  },
  {
    instanceId: '',
    id: 'action_01',
    name: 'Void Blast',
    type: CardType.ACTION,
    level: 0,
    atk: 0,
    def: 0,
    effectText: 'Deal 50 damage to your opponent.',
    ownerId: ''
  },
  {
    instanceId: '',
    id: 'action_02',
    name: 'Quick recovery',
    type: CardType.ACTION,
    level: 0,
    atk: 0,
    def: 0,
    effectText: 'If opponent has Entity: Return Lv 3 or lower Entity from Discard to hand, gain 20 LP.',
    ownerId: ''
  },
  {
    instanceId: '',
    id: 'condition_01',
    name: 'Reinforcement',
    type: CardType.CONDITION,
    isLingering: true,
    level: 0,
    atk: 0,
    def: 0,
    effectText: 'Target Entity gains +20 ATK.',
    ownerId: ''
  },
  {
    instanceId: '',
    id: 'condition_02',
    name: 'Void Call',
    type: CardType.CONDITION,
    isLingering: false,
    level: 0,
    atk: 0,
    def: 0,
    effectText: 'Target 1 Set Action/Condition card; send it to the Void.',
    ownerId: ''
  }
];

export const createDeck = (playerId: string): Card[] => {
  const deck: Card[] = [];
  for (let i = 0; i < 40; i++) {
    const base = BASE_CARDS[i % BASE_CARDS.length];
    deck.push({ ...base, instanceId: `${playerId}_${i}_${Math.random()}`, ownerId: playerId });
  }
  return deck.sort(() => Math.random() - 0.5);
};