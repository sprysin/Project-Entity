import { Card, CardType, PawnSubtype, Player, Position } from '../types';
import { matchesCardName } from './cardHelpers';

/** Complete material sets keep legality, player selection, and AI on the same rules. */
export function mergeMaterialSets(player: Player, card: Card): string[][] {
    if (card.type !== CardType.PAWN || card.pawnSubtype !== PawnSubtype.MERGE || !card.mergeMaterials?.length) return [];
    const pawns = player.pawnZones.flatMap(zone => zone && zone.position !== Position.HIDDEN ? [zone.card] : []);
    let sets: string[][] = [[]];
    for (const name of card.mergeMaterials) {
        sets = sets.flatMap(ids => pawns.filter(pawn => !ids.includes(pawn.instanceId) && matchesCardName(pawn, name))
            .map(pawn => [...ids, pawn.instanceId]));
    }
    return sets.filter((ids, index) => sets.findIndex(other => other.every(id => ids.includes(id))) === index);
}
