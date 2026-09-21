import { useState, useRef } from 'react';
import { useManagedTimeout } from './useManagedTimeout';

type ShatterShard = {
    x: number;
    y: number;
    width: number;
    height: number;
    tx: string;
    ty: string;
    rot: string;
    delay: string;
    clipPath: string;
};

type ShatterEffect = {
    id: string;
    left: number;
    top: number;
    width: number;
    height: number;
    cardMarkup: string;
    rotated: boolean;
    faceDown: boolean;
    shards: ShatterShard[];
};

/**
 * Hook that manages all visual/animation state: flying cards, shatters, LP animations,
 * floating texts, pile flashes, and refs for zone position tracking.
 */
export const useAnimations = () => {
    const schedule = useManagedTimeout();
    // Dynamic Animation Elements
    const [floatingTexts, setFloatingTexts] = useState<{ id: string, text: string, type: 'damage' | 'heal', x: number, y: number }[]>([]);
    const [shatterEffects, setShatterEffects] = useState<ShatterEffect[]>([]);

    // Pile Flash State
    const [discardFlash, setDiscardFlash] = useState<[boolean, boolean]>([false, false]);
    const [voidFlash, setVoidFlash] = useState<[boolean, boolean]>([false, false]);
    const prevDiscardLengths = useRef<[number, number]>([0, 0]);
    const prevVoidLengths = useRef<[number, number]>([0, 0]);

    // LP Animation State
    const [displayedLp, setDisplayedLp] = useState<[number, number]>([800, 800]);
    const [lpScale, setLpScale] = useState<[boolean, boolean]>([false, false]);
    const [lpFlash, setLpFlash] = useState<[string | null, string | null]>([null, null]);

    // Phase/Turn Overlays
    const [phaseFlash, setPhaseFlash] = useState<string | null>(null);
    const [turnFlash, setTurnFlash] = useState<string | null>(null);

    // Refs
    const zoneRefs = useRef<Map<string, HTMLElement>>(new Map());
    const lastLp = useRef<[number, number]>([800, 800]);

    /** Registers a DOM element for animation targeting. */
    const setRef = (key: string) => (el: HTMLElement | null) => {
        if (el) zoneRefs.current.set(key, el);
        else zoneRefs.current.delete(key);
    };

    /** Breaks a visual copy of the card into fragments spanning its full footprint. */
    const triggerShatter = (zoneKey: string) => {
        const el = zoneRefs.current.get(zoneKey);
        if (!el) return;
        const cardFace = el.querySelector<HTMLElement>('[data-card-face]');
        const visibleCard = cardFace?.querySelector<HTMLElement>('[data-field-card-id]');
        if (!visibleCard) return;
        const rect = visibleCard.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;

        const rotated = visibleCard.classList.contains('rotate-90');
        // Swap the grid with the card so portrait and defense-position cards
        // produce similarly sized fragments instead of long landscape strips.
        const columns = rotated ? 6 : 5;
        const rows = rotated ? 5 : 6;
        const cellWidth = rect.width / columns;
        const cellHeight = rect.height / rows;
        const shardShapes = [
            'polygon(0 0, 100% 0, 86% 100%, 8% 88%)',
            'polygon(8% 0, 94% 4%, 100% 82%, 18% 100%, 0 42%)',
            'polygon(0 10%, 82% 0, 100% 55%, 88% 100%, 5% 92%)',
            'polygon(12% 0, 100% 8%, 92% 100%, 0 86%, 6% 38%)',
        ];
        const shards = Array.from({ length: columns * rows }, (_, index) => {
            const column = index % columns;
            const row = Math.floor(index / columns);
            const x = column * cellWidth;
            const y = row * cellHeight;
            const centerX = x + cellWidth / 2 - rect.width / 2;
            const centerY = y + cellHeight / 2 - rect.height / 2;
            const distance = Math.max(1, Math.hypot(centerX, centerY));
            const force = 42 + Math.random() * 58;

            return {
                x: x - 1,
                y: y - 1,
                width: cellWidth + 2,
                height: cellHeight + 2,
                tx: `${centerX / distance * force + (Math.random() - .5) * 28}px`,
                ty: `${centerY / distance * force + 42 + Math.random() * 42}px`,
                rot: `${(Math.random() - .5) * 260}deg`,
                delay: `${Math.random() * 80}ms`,
                clipPath: shardShapes[(row + column) % shardShapes.length],
            };
        });

        const id = Math.random().toString();
        setShatterEffects(prev => [...prev, {
            id,
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
            cardMarkup: visibleCard.innerHTML,
            rotated,
            faceDown: visibleCard.classList.contains('card-back'),
            shards,
        }]);
        schedule(() => setShatterEffects(prev => prev.filter(e => e.id !== id)), 1250);
    };

    return {
        // State
        floatingTexts, shatterEffects,
        discardFlash, voidFlash, displayedLp, lpScale, lpFlash,
        phaseFlash, turnFlash,
        // Setters
        setFloatingTexts, setDiscardFlash, setVoidFlash,
        setDisplayedLp, setLpScale, setLpFlash,
        setPhaseFlash, setTurnFlash,
        // Refs
        prevDiscardLengths, prevVoidLengths, lastLp,
        // Actions
        setRef, triggerShatter, zoneRefs,
    };
};
