import { useEffect, useLayoutEffect, useRef, useState, RefObject } from 'react';
import { Card, CardType, GameState, PawnSubtype, Position } from '../types';
import { playSound } from '../audio';
import type { ShatterSource } from './useAnimations';
import { isContract } from '../game/cardHelpers';
import { useManagedTimeout } from './useManagedTimeout';

export const VASSAL_SUMMON_MS = 1200;
export const VASSAL_IMPACT_MS = 840;
export const CONTRACT_ACTIVATION_MS = 1000;

type Location = { key: string; card: Card; hidden: boolean; rotation: number; rect?: DOMRect; shatter?: ShatterSource; attached?: boolean };
export type CardMotion = { id: string; card: Card; hidden: boolean; from: DOMRect; to: DOMRect; rotation: number; fromRotation: number; delay?: number; duration?: number; activation?: boolean; deckFlipDelay?: number; ritual?: boolean };

/** Observe committed zone changes only. Animation never delays or mutates game state. */
export function useCardMotion(game: GameState | null, refs: RefObject<Map<string, HTMLElement>>, viewerIndex?: number, suppressedCardIds: string[] = [], onActionDestroyed?: (key: string, source: ShatterSource) => void) {
    const previous = useRef<Map<string, Location>>(new Map());
    const previousGame = useRef<GameState | null>(null);
    const waypoints = useRef(new Map<string, { key: string; rect: DOMRect }>());
    const activated = useRef(new Set<string>());
    const [motions, setMotions] = useState<CardMotion[]>([]);
    const [landings, setLandings] = useState<Animation[]>([]);
    const [contractActivations, setContractActivations] = useState<string[]>([]);
    const presentedContracts = useRef(new Set<string>());
    const schedule = useManagedTimeout();
    useEffect(() => {
        if (typeof document === 'undefined') return;
        const measure = () => {
            const measured = new Map<string, DOMRect | undefined>();
            previous.current.forEach(location => {
                if (!measured.has(location.key)) measured.set(location.key, refs.current.get(location.key)?.getBoundingClientRect());
                location.rect = measured.get(location.key) ?? location.rect;
            });
        };
        // Capture hover/selection offsets before the click changes the board.
        document.addEventListener('pointerdown', measure, true);
        document.addEventListener('keydown', measure, true);
        return () => {
            document.removeEventListener('pointerdown', measure, true);
            document.removeEventListener('keydown', measure, true);
        };
    }, [refs]);
    useLayoutEffect(() => {
        if (!game) { previous.current.clear(); previousGame.current = null; return; }
        const next = new Map<string, Location>();
        // A pile may contain many cards, but all share one visible location.
        const measured = new Map<string, DOMRect | undefined>();
        const add = (card: Card, key: string, hidden = false, rotation = 0, attached = false) => {
            const el = refs.current.get(key);
            if (!measured.has(key)) measured.set(key, el?.getBoundingClientRect());
            const face = /-(pawn|action)-/.test(key) ? el?.querySelector<HTMLElement>('[data-card-face] [data-field-card-id]') : undefined;
            next.set(card.instanceId, {
                card, key, hidden, rotation, rect: measured.get(key), attached,
                shatter: face ? {
                    rect: face.getBoundingClientRect(), cardMarkup: face.innerHTML,
                    rotated: face.classList.contains('rotate-90'), faceDown: face.classList.contains('card-back')
                } : undefined
            });
        };
        game.players.forEach((p, pi) => {
            p.hand.forEach((c, i) => add(c, `${pi}-hand-${i}`, pi !== (viewerIndex ?? game.activePlayerIndex)));
            p.deck.forEach(c => add(c, `deck-${pi}`, true));
            p.reserve.forEach(c => add(c, `reserve-${pi}`, true));
            p.discard.forEach(c => add(c, `discard-${pi}`));
            p.void.forEach(c => add(c, `void-${pi}`));
            (['pawn', 'action'] as const).forEach(type => p[type === 'pawn' ? 'pawnZones' : 'actionZones'].forEach((z, i) => {
                if (z) add(z.card, `${pi}-${type}-${i}`, z.position === Position.HIDDEN,
                    z.position === Position.DEFENSE || (z.position === Position.HIDDEN && z.card.type === CardType.PAWN) ? 90 : 0, !!z.attachedToInstanceIds?.length);
            }));
        });
        game.landStack?.forEach(zone => add(zone.card, 'land'));
        const batch: CardMotion[] = [];
        const reducedMotion = typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        // AI activations enter the chain directly; human activations were presented before selection.
        for (const link of game.chain ?? []) {
            if (!isContract(link.context.card) || previousGame.current?.chain?.includes(link)) continue;
            const id = link.context.card.instanceId;
            if (previousGame.current?.chain?.some(previous => previous.context.card.instanceId === id)) continue;
            if (presentedContracts.current.delete(id)) continue;
            playSound('minor-card-effect');
            setContractActivations(current => [...current, id]);
            schedule(() => setContractActivations(current => current.filter(value => value !== id)), CONTRACT_ACTIVATION_MS);
        }
        if (previousGame.current && !reducedMotion) {
            const insertions = (game.bombInsertions ?? []).slice(previousGame.current.bombInsertions?.length ?? 0);
            for (const insertion of insertions) {
                const source = previous.current.get(insertion.sourceId) ?? next.get(insertion.sourceId);
                const from = source?.shatter?.rect ?? source?.rect;
                const deck = refs.current.get(`deck-${insertion.playerIndex}`);
                const to = deck?.getBoundingClientRect();
                if (!from || !to) continue;
                const flipDelay = 100 + (insertion.cards.length - 1) * 200 + 300;
                insertion.cards.forEach((card, index) => batch.push({
                    id: `${card.instanceId}-insert`, card, hidden: false, from, to,
                    rotation: 0, fromRotation: source?.rotation ?? 0, delay: index * 200, duration: 1000,
                    deckFlipDelay: flipDelay
                }));
                // All Bombs arrive, hold, then flip together before the deck shuffles.
                const shuffle = deck?.animate?.([
                    { transform: 'translateY(0)' },
                    { transform: 'translateY(-12px)' },
                    { transform: 'translateY(12px)' },
                    { transform: 'translateY(-8px)' },
                    { transform: 'translateY(8px)' },
                    { transform: 'translateY(0)' }
                ], { duration: 450, delay: flipDelay + 600 + 150, easing: 'ease-out' });
                if (shuffle) {
                    setLandings(current => [...current, shuffle]);
                    const finish = () => setLandings(current => current.filter(animation => animation !== shuffle));
                    void shuffle.finished.then(finish, finish);
                }
            }
        }
        const destroyed = new Set((game.destroyedCardIds ?? []).slice(previousGame.current?.destroyedCardIds?.length ?? 0));
        next.forEach((dest, id) => {
            const src = previous.current.get(id);
            const ritual = !dest.hidden && dest.card.pawnSubtype === PawnSubtype.VASSAL && !!src && /^reserve-\d+$/.test(src.key)
                && /^\d+-pawn-\d+$/.test(dest.key);
            if (previousGame.current && dest.card.type === CardType.PAWN && !dest.hidden
                && /^\d+-pawn-\d+$/.test(dest.key) && (!src || !/^\d+-pawn-\d+$/.test(src.key))) {
                if (ritual && !reducedMotion) schedule(() => playSound('high-effect'), VASSAL_IMPACT_MS);
                else playSound(ritual ? 'high-effect' : 'toggle');
            }
            if (src && !src.attached && dest.attached) playSound('attach');
            if (suppressedCardIds.includes(id)) return;
            // A hand index changing is reflow, not a zone transfer.
            if (!src || src.key === dest.key || src.key.replace(/-hand-\d+$/, '-hand') === dest.key.replace(/-hand-\d+$/, '-hand')) return;
            if (/^deck-\d+$/.test(src.key) && /^\d+-hand-\d+$/.test(dest.key)) playSound('draw-tick');
            if (/^\d+-action-\d+$/.test(src.key) && /^discard-\d+$/.test(dest.key)) {
                if (destroyed.has(id)) {
                    if (src.shatter) onActionDestroyed?.(src.key, src.shatter);
                    else playSound('action-condition-destroyed');
                    return;
                }
            }
            if (!src.rect || !dest.rect) return;
            const recordedStop = waypoints.current.get(id);
            const waypoint = recordedStop?.key !== dest.key ? recordedStop?.rect : undefined;
            const activation = activated.current.has(id) && !isContract(dest.card);
            const token = `${id}-${performance.now()}`;
            if (waypoint) {
                batch.push({
                    id: `${token}-field`, card: dest.card, hidden: false, from: src.rect, to: waypoint,
                    rotation: 0, fromRotation: src.rotation, duration: 650, activation
                });
                batch.push({
                    id: token, card: dest.card, hidden: dest.hidden, from: waypoint, to: dest.rect,
                    rotation: dest.rotation, fromRotation: 0, delay: 650
                });
            } else {
                batch.push({
                    id: token, card: dest.card, hidden: dest.hidden,
                    from: src.rect, to: dest.rect, rotation: dest.rotation, fromRotation: src.rotation, activation,
                    ritual, duration: ritual ? VASSAL_SUMMON_MS : undefined
                });
            }
            const el = refs.current.get(dest.key);
            if (el && /-(pawn|action)-/.test(dest.key) && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
                const face = el.querySelector<HTMLElement>('[data-card-face]');
                const landing = face?.animate?.(ritual ? [
                    { opacity: 0, transform: 'translateY(0) scale(1)' },
                    { opacity: 0, transform: 'translateY(0) scale(1)', offset: .699 },
                    { opacity: 1, transform: 'scale(.97)', offset: .7 },
                    { opacity: 1, transform: 'translateY(0) scale(1)', offset: .84 },
                    { opacity: 1, transform: 'translateY(0) scale(1)' }
                ] : [
                    { opacity: 0, transform: 'translateY(-18px) scale(1.07)' },
                    { opacity: 0, transform: 'translateY(-18px) scale(1.07)', offset: .65 },
                    { opacity: 1, transform: 'translateY(-14px) scale(1.06)', offset: .72 },
                    { opacity: 1, transform: 'translateY(3px) scale(.98)', offset: .85 },
                    { opacity: 1, transform: 'translateY(0) scale(1)' }
                ], { duration: ritual ? VASSAL_SUMMON_MS : waypoint ? 1350 : 700, easing: ritual ? 'linear' : 'ease-out' });
                if (landing) {
                    setLandings(current => [...current, landing]);
                    const finish = () => setLandings(current => current.filter(animation => animation !== landing));
                    void landing.finished.then(finish, finish);
                }
            }
        });
        previous.current = next;
        previousGame.current = game;
        waypoints.current.clear();
        activated.current.clear();
        if (!batch.length || reducedMotion) return;
        setMotions(current => [...current, ...batch]);
    }, [game, refs, viewerIndex, suppressedCardIds, schedule]);
    return {
        motions,
        contractActivations,
        // Existing travel finishes before any decision UI opens. Rules remain locked meanwhile.
        isMoving: motions.length > 0 || landings.length > 0 || contractActivations.length > 0,
        // Preserve temporary field stops that React batches away during instant effects.
        recordMovement: (_source: string, target: string, _type: 'discard' | 'void' | 'retrieve', card?: Card) => {
            if (!card) return;
            const rect = refs.current.get(target)?.getBoundingClientRect();
            if (rect) waypoints.current.set(card.instanceId, { key: target, rect });
        },
        recordActivation: (card: Card) => {
            activated.current.add(card.instanceId);
            if (!isContract(card)) return;
            playSound('minor-card-effect');
            presentedContracts.current.add(card.instanceId);
            setContractActivations(current => current.includes(card.instanceId) ? current : [...current, card.instanceId]);
            schedule(() => setContractActivations(current => current.filter(id => id !== card.instanceId)), CONTRACT_ACTIVATION_MS);
        },
        finishMotion: (id: string) => setMotions(current => current.filter(m => m.id !== id))
    };
}
