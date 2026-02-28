
export enum CardType {
  PAWN = 'PAWN',
  ACTION = 'ACTION',
  CONDITION = 'CONDITION'
}

export enum Phase {
  DRAW = 'DRAW',
  STANDBY = 'STANDBY',
  MAIN1 = 'MAIN1',
  BATTLE = 'BATTLE',
  MAIN2 = 'MAIN2',
  END = 'END'
}

export enum Position {
  ATTACK = 'ATTACK',
  DEFENSE = 'DEFENSE',
  HIDDEN = 'HIDDEN'
}


export enum Attribute {
  FIRE = 'FIRE',
  WATER = 'WATER',
  EARTH = 'EARTH',
  AIR = 'AIR',
  ELECTRIC = 'ELECTRIC',
  NORMAL = 'NORMAL',
  DARK = 'DARK',
  LIGHT = 'LIGHT'
}

export enum PawnType {
  WARRIOR = 'WARRIOR',
  MAGICIAN = 'MAGICIAN',
  DRAGON = 'DRAGON',
  MECHANICAL = 'MECHANICAL',
  DEMON = 'DEMON',
  ANGEL = 'ANGEL',
  PLANT = 'PLANT',
  FISH = 'FISH',
  BEAST = 'BEAST',
  ELEMENTAL = 'ELEMENTAL',
  PRIMAL = 'PRIMAL',
  AVION = 'AVION',
  UNDEAD = 'UNDEAD',
  BUG = 'BUG'
}

export type Level = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export interface Card {
  instanceId: string;
  id: string;
  name: string;
  type: CardType;
  level: Level;
  attribute?: Attribute;
  pawnType?: PawnType;
  isLingering?: boolean;
  atk: number;
  def: number;
  effectText: string;
  ownerId: string;
}

export interface PlacedCard {
  card: Card;
  position: Position;
  hasAttacked: boolean;
  hasChangedPosition: boolean;
  summonedTurn: number;
  isSetTurn: boolean;
  hasActivatedEffect?: boolean;
}

export interface Player {
  id: string;
  name: string;
  lp: number;
  deck: Card[];
  hand: Card[];
  discard: Card[];
  void: Card[];
  pawnZones: (PlacedCard | null)[];
  actionZones: (PlacedCard | null)[];
  normalSummonUsed: boolean;
  hiddenSummonUsed: boolean;
}

export interface PendingEffect {
  type: 'RESET_ATK';
  targetInstanceId: string;
  value: number;
  dueTurn: number;
}

export interface GameState {
  players: [Player, Player];
  activePlayerIndex: number;
  currentPhase: Phase;
  turnNumber: number;
  log: string[];
  winner: string | null;
  pendingEffects: PendingEffect[];
}

export type EffectResult = {
  newState: GameState;
  log: string;
  requireTarget?: 'pawn' | 'action' | 'any';
  requireDiscardSelection?: {
    playerIndex: number;
    filter: (c: Card) => boolean;
    title: string;
  };
  requireHandSelection?: {
    playerIndex: number;
    title: string;
  };
};

export interface CardContext {
  card: Card;
  playerIndex: number;
  target?: { playerIndex: number, type: 'pawn' | 'action', index: number };
  discardIndex?: number;
  handIndex?: number;
}

export interface IEffect {
  // Triggered when an Pawn is Normal Summoned or Set
  onSummon?(state: GameState, context: CardContext): EffectResult;

  // Triggered when a card is Tributed
  onTribute?(state: GameState, context: CardContext): EffectResult;

  // Triggered when an Effect is manually activated (Action key, or Pawn Ignition effect)
  onActivate?(state: GameState, context: CardContext): EffectResult;

  // Triggered during Phase changes (e.g. End Phase maintenance)
  onPhaseChange?(state: GameState, context: CardContext): EffectResult;

  // Static check if effect can be activated
  canActivate?(state: GameState, context: CardContext): boolean;
}
