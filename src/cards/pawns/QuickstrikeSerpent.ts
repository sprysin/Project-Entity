import { IEffect, CardType, Attribute, PawnType } from '../../types';
import { cardRegistry } from '../CardRegistry';
import { buildEffect, EffectStep } from '../engine/Builder';
import { Cost } from '../engine/Costs';

const prepareExtraAttacks: EffectStep = (state, context) => {
    const player = state.players[context.playerIndex];
    const zone = player.pawnZones.find(z => z?.card.instanceId === context.card.instanceId);
    if (zone) {
        zone.nextBattleAttacks = 2;
    }
};

const effect: IEffect = {
    onActivate: buildEffect([
        Cost.DiscardCardFilter(() => true),
        prepareExtraAttacks
    ]),
    canActivate: (state, context) => state.players[context.playerIndex].hand.length > 0
};

cardRegistry.register({
    id: 'pawn_08',
    name: 'Quickstrike Serpent',
    type: CardType.PAWN,
    level: 4,
    attribute: Attribute.WATER,
    pawnType: PawnType.AQUATIC,
    atk: 130,
    def: 80,
    effectText: 'Discard 1 card; this turn, Quickstrike Serpent can do 2 attacks this battle phase.',
}, effect);
