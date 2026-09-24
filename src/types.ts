
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
  FACE_UP = 'FACE_UP',
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
export enum PawnSubtype { SWITCH = 'Switch' }

export interface Card {
  instanceId: string;
  id: string;
  name: string;
  type: CardType;
  level: Level;
  attribute?: Attribute;
  pawnType?: PawnType;
  pawnSubtype?: PawnSubtype;
  switchMandatory?: boolean;
  isLingering?: boolean;
  /** Attach subtype for Actions/Conditions; mutually exclusive with isLingering. */
  isAttached?: boolean;
  /** This Attach card remains attached when its target turns face-down. */
  survivesTargetFlip?: boolean;
  atk: number;
  def: number;
  effectText: string;
  ownerId: string;
  tributedByAction?: boolean;
}

export interface PlacedCard {
  returnToOwnerEndPhase?: boolean;
  attachedToInstanceId?: string;
  attachmentStatBonuses?: { sourceInstanceId: string; atk: number; def: number }[];
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
  deckName?: string;
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
  delta?: number;
  dueTurn: number;
}

export interface GameState {
  pendingFrontline?: { sourceId: string; playerIndex: number }[];
  pendingSwitches?: { card: Card; playerIndex: number }[];
  drawProgress?: { turn: number; remaining: number };
  response?: { priority: number; passes: number; reason: string; ready?: boolean };
  chain?: ChainLink[];
  resolvingChain?: { total: number; current: number; cardName: string };
  deferredAction?: { kind: 'phase' | 'end' } | { kind: 'attack'; attackerId: string; targetId: string | 'direct' };
  players: [Player, Player];
  activePlayerIndex: number;
  currentPhase: Phase;
  turnNumber: number;
  damageEvents?: { card: Card; playerIndex: number; amount: number; kind: 'battle' | 'effect' }[];
  /** Pending private reveals. The viewer dismisses each event after inspecting it. */
  peekEvents?: PeekEvent[];
  log: string[];
  winner: string | null;
  /** Draw remains terminal through winner; this flag distinguishes it from a player name. */
  isDraw?: boolean;
  resultReason?: 'lp' | 'empty_deck';
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
  prompt?: string;
  filter: CardFilter;
}

export interface HandSelectionRequest {
  filter?: CardFilter;
  playerIndex: number;
  title?: string;
  prompt?: string;
}

export type ShuffleLocation = 'hand' | 'field' | 'discard';
export interface ShuffleSelectionRequest {
  playerIndex: number;
  location: ShuffleLocation;
  count: number;
  target: boolean;
  filter: CardFilter;
}

export interface PeekSelectionRequest {
  /** The player whose hand supplies the card and who makes the selection. */
  playerIndex: number;
  /** The only player allowed to see the selected card. */
  viewerPlayerIndex: number;
  title?: string;
  prompt?: string;
}

export interface PeekEvent {
  id: string;
  card: Card;
  ownerPlayerIndex: number;
  viewerPlayerIndex: number;
}

export interface TributeSelectionRequest extends HandSelectionRequest {
  count: number;
  filter?: CardFilter;
}

export type EffectTrigger = 'summon' | 'switch' | 'activate' | 'phase' | 'field_activate' | 'discard' | 'tribute';
export type TargetSelectMode = 'attack' | 'tribute' | 'effect' | 'place_pawn' | 'place_action' | null;
export type TargetSelectType = 'pawn' | 'action' | 'any';
export type TargetSelectPosition = 'hidden' | 'faceup' | 'both';
export type TargetSelectScope = 'active' | 'opponent' | 'both';

export type EffectResult = {
  newState: GameState;
  halted?: boolean;
  requireTarget?: TargetSelectType;
  requireTargetPosition?: TargetSelectPosition;
  requireTargetScope?: TargetSelectScope;
  requireTargetFilter?: (card: Card) => boolean;
  requireTargetIndex?: number;
  requireDiscardSelection?: CardSelectionRequest;
  requireHandSelection?: HandSelectionRequest;
  requirePeekSelection?: PeekSelectionRequest;
  requireDeckSelection?: CardSelectionRequest;
  requireEffectTribute?: TributeSelectionRequest;
  requireShuffleSelection?: ShuffleSelectionRequest;
};

export interface CardContext {
  execution?: 'costs' | 'resolve';
  tributeCards?: Card[];
  card: Card;
  playerIndex: number;
  target?: CardTarget;
  targets?: CardTarget[];
  discardIndex?: number;
  handIndex?: number;
  peekIndex?: number;
  deckIndex?: number;
  tributeIndices?: number[];
  shuffleIndices?: number[];
}

export interface IEffect {
  /** Only explicitly quick Pawn effects may respond outside normal ignition timing. */
  timing?: 'main' | 'quick';
  /** Let an effect resolve its remaining instructions when one selected target has left the field. */
  allowMissingTargets?: boolean;
  // Triggered when an Pawn is Normal Summoned or Set
  onSummon?(state: GameState, context: CardContext): EffectResult;
  onSwitch?(state: GameState, context: CardContext): EffectResult;
  onBattleDestroy?(state: GameState, context: CardContext & { destroyedCard: Card }): EffectResult;

  // Triggered when a card is Tributed
  onTribute?(state: GameState, context: CardContext): EffectResult;

  // Triggered when this card is discarded from the hand by a card cost.
  onDiscard?(state: GameState, context: CardContext): EffectResult;

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
  targetIds?: (string | undefined)[];
  discardId?: string;
  deckId?: string;
  peekCardId?: string;
}

export type OpponentMode = 'self' | 'ai';
