import { IEffect, CardType, Attribute, PawnType } from '../../types';
import { Effect } from '../engine/Effects';
import { cardRegistry } from '../CardRegistry';
import { buildEffect, EffectStep } from '../engine/Builder';
import { Cost } from '../engine/Costs';
import { Condition } from '../engine/Requirements';

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
        Effect.SetSoftOncePerTurn(),
        prepareExtraAttacks
    ]),
    canActivate: (state, context) =>
        Condition.SoftOncePerTurn()(state, context)
        && state.players[context.playerIndex].hand.length > 0
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
    effectText: 'Once per turn you can discard 1 card; this turn, Quickstrike Serpent can do 2 attacks this battle phase.',
}, effect);
