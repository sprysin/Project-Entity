
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
  AQUATIC = 'AQUATIC',
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
  tributedByAction?: boolean;
}

export interface PlacedCard {
  card: Card;
  position: Position;
  hasAttacked: boolean;
  hasChangedPosition: boolean;
  summonedTurn: number;
  isSetTurn: boolean;
  hasActivatedEffect?: boolean;
  nextBattleAttacks?: number;
  attacksRemaining?: number;
}

export interface Player {
  id: string;
  name: string;
  lp: number;
  deck: Card[];
  initialDeck: Card[];
  hand: Card[];
  discard: Card[];
  void: Card[];
  pawnZones: (PlacedCard | null)[];
  actionZones: (PlacedCard | null)[];
  normalSummonUsed: boolean;
  hiddenSummonUsed: boolean;
  activatedHardOncePerTurns: string[];
}

export interface PendingEffect {
  type: 'RESET_ATK' | 'RESET_DEF';
  targetInstanceId: string;
  value: number;
  dueTurn: number;
}

export interface GameState {
  response?: { priority: number; passes: number; reason: string; ready?: boolean };
  chain?: ChainLink[];
  deferredAction?: { kind: 'phase' } | { kind: 'attack'; attackerId: string; targetId: string | 'direct' };
  players: [Player, Player];
  activePlayerIndex: number;
  currentPhase: Phase;
  turnNumber: number;
  log: string[];
  winner: string | null;
  pendingEffects: PendingEffect[];
}

export type CardTarget = {
  playerIndex: number;
  type: 'pawn' | 'action';
  index: number;
};

export type CardFilter = (card: Card) => boolean;

export interface CardSelectionRequest {
  playerIndex: number;
  title?: string;
  filter: CardFilter;
}

export interface HandSelectionRequest {
  filter?: CardFilter;
  playerIndex: number;
  title?: string;
}

export interface TributeSelectionRequest extends HandSelectionRequest {
  count: number;
  filter?: CardFilter;
}

export type EffectTrigger = 'summon' | 'activate' | 'phase' | 'field_activate';
export type TargetSelectMode = 'attack' | 'tribute' | 'effect' | 'place_pawn' | 'place_action' | null;
export type TargetSelectType = 'pawn' | 'action' | 'any';
export type TargetSelectPosition = 'hidden' | 'faceup' | 'both';

export type EffectResult = {
  newState: GameState;
  halted?: boolean;
  requireTarget?: TargetSelectType;
  requireTargetPosition?: TargetSelectPosition;
  requireDiscardSelection?: CardSelectionRequest;
  requireHandSelection?: HandSelectionRequest;
  requireDeckSelection?: CardSelectionRequest;
  requireEffectTribute?: TributeSelectionRequest;
};

export interface CardContext {
  execution?: 'costs' | 'resolve';
  tributeCards?: Card[];
  card: Card;
  playerIndex: number;
  target?: CardTarget;
  discardIndex?: number;
  handIndex?: number;
  deckIndex?: number;
  tributeIndices?: number[];
}

export interface IEffect {
  /** Only explicitly quick Pawn effects may respond outside normal ignition timing. */
  timing?: 'main' | 'quick';
  // Triggered when an Pawn is Normal Summoned or Set
  onSummon?(state: GameState, context: CardContext): EffectResult;

  // Triggered when a card is Tributed
  onTribute?(state: GameState, context: CardContext): EffectResult;

  // Triggered when an Effect is manually activated (Action key, or Pawn Ignition effect)
  onActivate?(state: GameState, context: CardContext): EffectResult;

  // Triggered when a Lingering Action is activated while already face-up on the field
  onFieldActivate?(state: GameState, context: CardContext): EffectResult;

  // Triggered during Phase changes (e.g. End Phase maintenance)
  onPhaseChange?(state: GameState, context: CardContext): EffectResult;

  // Static check if effect can be activated
  canActivate?(state: GameState, context: CardContext): boolean;
}

export interface ChainLink {
  context: CardContext;
  trigger: EffectTrigger;
  targetId?: string;
  discardId?: string;
  deckId?: string;
}

export type OpponentMode = 'self' | 'ai';
