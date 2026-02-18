
export enum CardType {
  ENTITY = 'ENTITY',
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

export interface Card {
  instanceId: string;
  id: string;
  name: string;
  type: CardType;
  level: number;
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
}

export interface Player {
  id: string;
  name: string;
  lp: number;
  deck: Card[];
  hand: Card[];
  discard: Card[];
  void: Card[];
  entityZones: (PlacedCard | null)[];
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
  requireTarget?: 'entity' | 'action' | 'any'; 
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