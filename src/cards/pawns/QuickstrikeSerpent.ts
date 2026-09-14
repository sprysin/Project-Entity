import { IEffect, CardType, Attribute, PawnType } from '../../../types';
import { cardRegistry } from '../CardRegistry';
import { buildEffect, EffectStep } from '../libs/Builder';
import { Cost } from '../libs/Costs';

const prepareExtraAttacks: EffectStep = (state, context) => {
    const player = state.players[context.playerIndex];
    const zone = player.pawnZones.find(z => z?.card.instanceId === context.card.instanceId);
    if (zone) {
        zone.nextBattleAttacks = 2;
        return { log: 'Quickstrike Serpent can attack twice during the next Battle Phase.' };
    }
};

const effect: IEffect = {
    onActivate: buildEffect([
        Cost.DiscardCardFilter('Discard 1 card for Quickstrike Serpent.', () => true),
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
    pawnType: PawnType.FISH,
    atk: 130,
    def: 80,
    effectText: 'Discard 1 card; this turn, Quickstrike Serpent can do 2 attacks this battle phase.',
}, effect);
