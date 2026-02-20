import { IEffect, Position } from '../../../types';
import { cardRegistry } from '../CardRegistry';
import { buildEffect } from '../libs/Builder';
import { Require } from '../libs/Requirements';
import { Effect } from '../libs/Effects';

const effect: IEffect = {
    onSummon: buildEffect([
        Require.Target('entity', "High King: Target an Entity to reduce ATK."),
        Require.TargetMatchesPosition(Position.HIDDEN, true, "High King: Invalid target — must be a face-up Entity."),
        Effect.ModifyTargetStats(-20, 0)
    ])
};

cardRegistry.register('entity_02', effect);
