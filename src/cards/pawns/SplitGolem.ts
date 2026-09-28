import { Attribute, CardType, IEffect, PawnSubtype, PawnType, Position } from '../../types';
import { cardRegistry } from '../CardRegistry';
import { buildEffect } from '../engine/Builder';
import { Effect } from '../engine/Effects';
import { Condition } from '../engine/Requirements';

cardRegistry.register({
    id: 'token_golem', name: 'Golem Token', type: CardType.PAWN,
    pawnSubtype: PawnSubtype.TOKEN, level: 3, attribute: Attribute.EARTH,
    pawnType: PawnType.ELEMENTAL, atk: 60, def: 70, cannotBeTributed: true,
    effectText: 'This Token cannot be tributed.'
}, {});

const effect: IEffect = {
    canActivate: (state, context) => Condition.OnceWhileOnField()(state, context)
        && state.players[context.playerIndex].pawnZones.includes(null),
    onActivate: buildEffect([
        Effect.SetOnceWhileOnField(),
        (state, context) => {
            const source = state.players.flatMap(player => player.pawnZones)
                .find(zone => zone?.card.instanceId === context.card.instanceId);
            if (!source || source.position === Position.HIDDEN) return { halt: true };
            const reduced = Math.floor(source.card.atk / 2);
            source.card.fieldAtkReduction = (source.card.fieldAtkReduction ?? 0) + source.card.atk - reduced;
            source.card.atk = reduced;
        },
        Effect.SummonToken('token_golem')
    ])
};

cardRegistry.register({
    id: 'pawn_16', name: 'Split Golem', type: CardType.PAWN,
    level: 3, attribute: Attribute.EARTH, pawnType: PawnType.ELEMENTAL, atk: 120, def: 140,
    effectText: 'Once while on the field: Halve this Pawn’s current ATK, then Special Summon 1 “Golem Token” (Elemental/EARTH/Level 3/ATK 60/DEF 70). This Token cannot be tributed.'
}, effect);
