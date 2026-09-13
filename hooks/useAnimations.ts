import { useState, useRef } from 'react';
import { Card } from '../types';

/**
 * Hook that manages all visual/animation state: flying cards, shatters, LP animations,
 * floating texts, pile flashes, and refs for zone position tracking.
 */
export const useAnimations = () => {
    // Dynamic Animation Elements
    const [flyingCards, setFlyingCards] = useState<{ id: string, startX: number, startY: number, targetX: number, targetY: number, card?: Card }[]>([]);
    const [voidAnimations, setVoidAnimations] = useState<{ id: string, x: number, y: number }[]>([]);
    const [floatingTexts, setFloatingTexts] = useState<{ id: string, text: string, type: 'damage' | 'heal', x: number, y: number }[]>([]);
    const [shatterEffects, setShatterEffects] = useState<{ id: string, x: number, y: number, shards: { tx: string, ty: string, rot: string }[] }[]>([]);

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

    /** Triggers a glass shatter effect at the specified zone. */
    const triggerShatter = (zoneKey: string) => {
        const el = zoneRefs.current.get(zoneKey);
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const x = (rect.left + rect.width / 2) / window.innerWidth * 100;
        const y = (rect.top + rect.height / 2) / window.innerHeight * 100;

        const shards = Array.from({ length: 8 }).map(() => ({
            tx: (Math.random() - 0.5) * 200 + 'px',
            ty: (Math.random() - 0.5) * 200 + 'px',
            rot: Math.random() * 360 + 'deg'
        }));

        const id = Math.random().toString();
        setShatterEffects(prev => [...prev, { id, x, y, shards }]);
        setTimeout(() => setShatterEffects(prev => prev.filter(e => e.id !== id)), 1000);
    };

    return {
        // State
        voidAnimations, floatingTexts, shatterEffects,
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
