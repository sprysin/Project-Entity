import { IEffect } from '../../../types';
import { cardRegistry } from '../CardRegistry';
import { buildEffect } from '../libs/Builder';
import { Effect } from '../libs/Effects';
import { Query } from '../libs/Queries';

const effect: IEffect = {
    onSummon: buildEffect([
        Effect.DealDamage(
            Query.ActiveOpponent(),
            Query.Multiply(Query.CountSetActions('opponent'), 10),
            "FORCE FIRE SPARKER:"
        )
    ])
};

cardRegistry.register('entity_03', effect);
