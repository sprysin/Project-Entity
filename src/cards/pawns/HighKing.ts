import { IEffect, Position } from '../../../types';
import { cardRegistry } from '../CardRegistry';
import { buildEffect } from '../libs/Builder';
import { Require } from '../libs/Requirements';
import { Effect } from '../libs/Effects';

const effect: IEffect = {
    onSummon: buildEffect([
        Require.Target('pawn', "High King: Target an Pawn to reduce ATK."),
        Require.TargetMatchesPosition(Position.HIDDEN, true, "High King: Invalid target — must be a face-up Pawn."),
        Effect.ModifyTargetStats(-20, 0)
    ])
};

cardRegistry.register('pawn_02', effect);
