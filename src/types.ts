
export enum CardType {
  PAWN = 'PAWN',
  ACTION = 'ACTION',
  CONDITION = 'CONDITION'
}

export const CARD_RARITIES = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic', 'Relic'] as const;
export type CardRarity = typeof CARD_RARITIES[number];
/** Legendary, Mythic, and Relic are equivalent top-tier rarities. */
export const CARD_RARITY_TIERS: Record<CardRarity, number> = {
  Common: 0, Uncommon: 1, Rare: 2, Epic: 3,
  Legendary: 4, Mythic: 4, Relic: 4,
};

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
  ARCANE = 'ARCANE',
  DRAGON = 'DRAGON',
  MECHANICAL = 'MECHANICAL',
  DEMON = 'DEMON',
  ANGEL = 'ANGEL',
  PLANT = 'PLANT',
  AQUATIC = 'AQUATIC',
  BEAST = 'BEAST',
  ELEMENTAL = 'ELEMENTAL',
  PRIMAL = 'PRIMAL',
  AVIAN = 'AVIAN',
  UNDEAD = 'UNDEAD',
  BUG = 'BUG'
}

export type Level = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
export enum PawnSubtype { SWITCH = 'Switch', TOKEN = 'Token', VASSAL = 'Vassal' }
export enum ActionSubtype { CONTRACT = 'Contract', LAND = 'Land', BOMB = 'Bomb' }

export interface Card {
  instanceId: string;
  id: string;
  name: string;
  type: CardType;
  rarity: CardRarity;
  level: Level;
  attribute?: Attribute;
  pawnType?: PawnType;
  pawnSubtype?: PawnSubtype;
  actionSubtype?: ActionSubtype;
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
  cannotBeTributed?: boolean;
  tributeBlockedThisTurn?: boolean;
  effectTargetBlockedThisTurn?: boolean;
  /** ATK lost to field-only reductions; restored when this card leaves the field. */
  fieldAtkReduction?: number;
  /** Printed attribute restored when an attribute-changing Pawn leaves the field. */
  fieldOriginalAttribute?: Attribute;
}

export interface PlacedCard {
  specialSummoned?: boolean;
  /** Final ATK override, evaluated after continuous modifiers until turn end. */
  attackOverride?: { value: number; turn: number };
  counters?: Record<string, number>;
  effectUsedTurn?: Record<string, number>;
  returnToOwnerEndPhase?: boolean;
  /** Field identities tracked by an Attach card. */
  attachedToInstanceIds?: string[];
  attachmentStatBonuses?: { sourceInstanceId: string; atk: number; def: number }[];
  card: Card;
  position: Position;
  hasAttacked: boolean;
  hasChangedPosition: boolean;
  summonedTurn: number;
  isSetTurn: boolean;
  hasActivatedEffect?: boolean;
  hasUsedWhileOnField?: boolean;
  nextBattleAttacks?: number;
  attacksRemaining?: number;
}

export interface Player {
  skipNextDrawPhase?: boolean;
  id: string;
  name: string;
  deckName?: string;
  lp: number;
  deck: Card[];
  reserve: Card[];
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
  /** Omitted effects expire after End Phase; explicit phases expire on exit. */
  duePhase?: Phase;
  type: 'RESET_ATK' | 'RESET_DEF';
  targetInstanceId: string;
  value: number;
  delta?: number;
  dueTurn: number;
}

export type ActivationPopupMode = 'off' | 'auto' | 'on';
export type ResponseTiming = 'summon' | 'attack' | 'activation' | 'turn_end' | 'phase_exit' | 'phase_entry' | 'battle_step' | 'chain_resolved' | 'minor_action' | 'draw';
export interface ResponseWindow {
  timing: ResponseTiming;
  reason: string;
}

export interface GameState {
  /** Committed Bomb creation, retained so presentation can animate its source and deck. */
  bombInsertions?: { sourceId: string; playerIndex: number; cards: Card[] }[];
  /** Ordered destruction events; sending to the Discard does not record one. */
  destroyedCardIds?: string[];
  /** Public draw reveals shown before the card's destruction animation. */
  drawnBombs?: { card: Card; playerIndex: number }[];
  /** Bottom to top; only the final entry is active. Optional for older snapshots. */
  landStack?: PlacedCard[];
  /** Only this activation's controller may finish or cancel while choosing its effect. */
  pendingActivation?: { cardId: string; playerIndex: number };
  temporaryVoidReturns?: { cardId: string; playerIndex: number; position: Position; phase: Phase; dueTurn: number }[];
  pendingVoidReturns?: { cardId: string; playerIndex: number; position: Position }[];
  attacksThisTurn?: { turn: number; card: Card; playerIndex: number }[];
  attackReplay?: { attackerId: string; choosingTarget?: boolean };
  pendingVoidSelections?: { source: Card; playerIndex: number; pilePlayerIndex: number }[];
  pendingHandSummons?: { sourceId: string; playerIndex: number; mandatory?: boolean }[];
  pendingReactions?: { card: Card; playerIndex: number; trigger: 'summon' | 'switch' | 'battle_destroyed' | 'destroyed' | 'attack_completed' | 'sent_discard' | 'hand_return'; battleAttacker?: Card }[];
  /** Triggered effects wait until the current chain and deferred action have finished. */
  pendingTriggers?: { context: CardContext; trigger: Extract<EffectTrigger, 'summon' | 'phase' | 'discard' | 'tribute' | 'battle_destroy'> }[];
  drawProgress?: { turn: number; remaining: number };
  response?: { priority: number; passes: number; reason: string; timing?: ResponseTiming; ready?: boolean };
  /** Event responses wait for trigger choices and the entire resolving chain. */
  pendingResponse?: ResponseWindow;
  /** The top resolving link is waiting for its controller's target selection. */
  pendingChainTarget?: boolean;
  chain?: ChainLink[];
  resolvingChain?: { total: number; current: number; cardName: string };
  deferredAction?: { kind: 'phase' | 'end' } | { kind: 'attack'; attackerId: string; targetId: string | 'direct'; battleStep?: boolean };
  players: [Player, Player];
  activePlayerIndex: number;
  openingCoin?: { winnerIndex: 0 | 1; stage: 'flipping' | 'choosing' };
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
  type: 'pawn' | 'action' | 'land';
  index: number;
};

export type CardFilter = (card: Card) => boolean;

export interface CardSelectionRequest {
  purpose?: 'summon';
  /** Sequential selections share the existing pile picker without reusing a card. */
  selectionIndex?: number;
  playerIndex: number;
  title?: string;
  prompt?: string;
  filter: CardFilter;
}

export interface HandSelectionRequest {
  /** Cards available after earlier instructions in this effect. */
  cards?: Card[];
  purpose?: 'discard' | 'summon';
  filter?: CardFilter;
  playerIndex: number;
  title?: string;
  prompt?: string;
}

export type ShuffleLocation = 'hand' | 'field' | 'discard';
export type SelectionLocation = 'deck' | 'hand' | 'field' | 'reserve' | 'discard';
export interface SelectedCard {
  playerIndex: number;
  location: SelectionLocation;
  card: Card;
  isTarget: boolean;
}
export interface ShuffleSelectionRequest {
  playerIndex: number;
  location: ShuffleLocation;
  count: number;
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
  kind?: 'hand_activation';
  id: string;
  card: Card;
  ownerPlayerIndex: number;
  viewerPlayerIndex: number;
}

export interface TributeSelectionRequest extends HandSelectionRequest {
  count: number;
  filter?: CardFilter;
}

/** Tribute a variable number of Pawns from hand and field with an exact level sum. */
export interface LevelTributeSelectionRequest {
  playerIndex: number;
  totalLevel: number;
}

export type EffectTrigger = 'destroyed' | 'summon' | 'switch' | 'battle_destroy' | 'battle_destroyed' | 'attack_completed' | 'sent_discard' | 'hand_return' | 'hand_activate' | 'activate' | 'phase' | 'field_activate' | 'discard' | 'tribute';
export type TargetSelectMode = 'attack' | 'tribute' | 'effect' | 'place_pawn' | 'place_action' | null;
export type TargetSelectType = 'pawn' | 'action' | 'any';
export type TargetSelectPosition = 'hidden' | 'faceup' | 'both';
export type TargetSelectScope = 'active' | 'opponent' | 'both';

export type EffectResult = {
  requireEffectChoice?: { id: string; label: string; disabled: boolean }[];
  newState: GameState;
  requirePawnPlacement?: { playerIndex: number; position?: Position; slots?: number[]; placementIndex?: number };
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
  requireReserveSelection?: CardSelectionRequest;
  requireLevelTribute?: LevelTributeSelectionRequest;
  requireEffectTribute?: TributeSelectionRequest;
  requireShuffleSelection?: ShuffleSelectionRequest;
};

export interface CardContext {
  handSelectionId?: string;
  effectId?: string;
  pawnPlacement?: { slot: number; position: Position };
  pawnPlacements?: { slot: number; position: Position }[];
  battleAttacker?: Card;
  execution?: 'reserve' | 'costs' | 'resolve';
  tributeCards?: Card[];
  /** Battle-event identity retained while player reactions are decided. */
  destroyedCard?: Card;
  card: Card;
  playerIndex: number;
  target?: CardTarget;
  targets?: CardTarget[];
  discardIndex?: number;
  discardCardIds?: string[];
  selections?: SelectedCard[];
  handIndex?: number;
  peekIndex?: number;
  deckIndex?: number;
  reserveIndex?: number;
  materialIds?: string[];
  tributeIndices?: number[];
  shuffleCardIds?: string[];
}

export interface IEffect {
  /** Immediate, selection-free effect when this card is drawn. */
  onDraw?(state: GameState, context: CardContext): EffectResult;
  /** Pawn ignition effects announced while the source remains in hand. */
  onHandActivate?(state: GameState, context: CardContext): EffectResult;
  canActivateFromHand?(state: GameState, context: CardContext): boolean;
  /** Selection-free effect applied to a successful face-up special summon. */
  onSpecialSummon?(state: GameState, context: CardContext): EffectResult;
  /** Face-up sources observe cards sent to their owner's hand. */
  onCardSentToHand?(state: GameState, context: CardContext & { returnedCard: Card; receivingPlayerIndex: number }): EffectResult;
  onHandReturn?(state: GameState, context: CardContext): EffectResult;
  /** Continuous bonus from this face-up source to another field Pawn. */
  LingeringStatModifier?(state: GameState, context: CardContext, target: PlacedCard, controllerIndex: number): { atk?: number; def?: number };
  canAttack?(state: GameState, context: CardContext, placement: PlacedCard): boolean;
  canAttackDirectly?(state: GameState, context: CardContext): boolean;
  canManuallyChangePosition?(state: GameState, context: CardContext, placement: PlacedCard): boolean;
  preventsBattleDestructionOfOpponent?: boolean;
  /** Reactions without optional wording must be completed when legal choices exist. */
  mandatoryReactions?: boolean;
  onAttackCompleted?(state: GameState, context: CardContext): EffectResult;
  onSentToDiscard?(state: GameState, context: CardContext): EffectResult;
  /** Immediate, selection-free observers while this source is face-up. */
  onEffectActivated?(state: GameState, context: CardContext & { activatedCard: Card; activatingPlayerIndex: number }): EffectResult;
  onEffectDamage?(state: GameState, context: CardContext & { damageCard: Card; damageEffectId?: string; damagedPlayerIndex: number; amount: number }): EffectResult;
  tributeSummonFilter?: CardFilter;
  onDestroyed?(state: GameState, context: CardContext): EffectResult;
  /** Reusable counter-gated hand summon; shared by card legality and AI planning. */
  counterSummon?: { counter: string; requiredCounters(card: Card): number | undefined };
  /** Continuous field-only stat changes; evaluated from the current board without mutating printed stats. */
  fieldStatModifier?(state: GameState, context: CardContext, placement: PlacedCard): { atk?: number; def?: number };
  /** Observes a face-up normal/tribute summon while this source is face-up. */
  onPawnSummoned?(state: GameState, context: CardContext & { summonedCard: Card; summoningPlayerIndex: number; tributeCount: number }): EffectResult;
  /** Shared hand-summon eligibility, rechecked when the command executes. */
  handSummonFilter?: CardFilter;
  handSummonPrompt?: string;
  /** A face-up attachment observes an activation announced by its attached card. */
  onAttachedActivation?(state: GameState, context: CardContext & { activatedCard: Card }): EffectResult;
  /** Immediate destruction response; mutates state without opening a selection window. */
  onAttachedDestroyed?(state: GameState, context: CardContext & { destroyedCard: Card; attachedInstanceIds: readonly string[] }): void;
  /** Only explicitly quick Pawn effects may respond outside normal ignition timing. */
  timing?: 'main' | 'quick';
  /** Choose targets from the current board when this link resolves. */
  targetsAtResolution?: boolean;
  /** Let an effect resolve its remaining instructions when one selected target has left the field. */
  allowMissingTargets?: boolean;
  // Triggered when an Pawn is Normal Summoned or Set
  onSummon?(state: GameState, context: CardContext): EffectResult;
  onSwitch?(state: GameState, context: CardContext): EffectResult;
  onBattleDestroy?(state: GameState, context: CardContext & { destroyedCard: Card }): EffectResult;
  /** Optional reaction after this Pawn is destroyed by battle and reaches its owner's Discard. */
  onBattleDestroyed?(state: GameState, context: CardContext): EffectResult;

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
  sourceHandId?: string;
  handId?: string;
  tributeIds?: string[];
  context: CardContext;
  trigger: EffectTrigger;
  targetId?: string;
  targetIds?: (string | undefined)[];
  discardId?: string;
  deckId?: string;
  reserveId?: string;
  peekCardId?: string;
}

export type OpponentMode = 'self' | 'ai';
/** Temporary controls for AI playtests; never part of core match rules. */
export interface PlaytestDebugSettings {
  alwaysGoFirst?: boolean;
  chooseStartingHand?: boolean;
  xray?: boolean;
}
