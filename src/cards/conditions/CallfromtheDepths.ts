import { Attribute, CardType, IEffect, Position } from '../../types';
import { cardRegistry } from '../CardRegistry';
import { buildCondition, buildEffect } from '../engine/Builder';
import { Condition, Require } from '../engine/Requirements';
import { Effect } from '../engine/Effects';
import { Cost } from '../engine/Costs';

const effect: IEffect = {
    onActivate: buildEffect([
        Cost.ChangePawnPosition(Position.HIDDEN, 'faceup', 0, 'active'),
        Require.Target('pawn', 'faceup', 'opponent', 1),
        Effect.ChangeTargetPosition(Position.HIDDEN, 1)
    ]),
    canActivate: buildCondition([
        Condition.PawnMatchesFilter('active', zone => zone.position !== Position.HIDDEN
            && (zone.card.attribute === Attribute.DARK || zone.card.attribute === Attribute.WATER)),
        Condition.PawnMatchesFilter('opponent', zone => zone.position !== Position.HIDDEN)
    ])
};

cardRegistry.register({
    id: 'condition_04',
    name: 'Call from the Depths',
    type: CardType.CONDITION,
    isLingering: false,
    level: 0,
    atk: 0,
    def: 0,
    effectText: 'If you control a DARK or WATER Pawn: flip 1 face-up Pawn you control face-down, then target 1 face-up Pawn your opponent controls; flip it face-down.',
}, effect);
