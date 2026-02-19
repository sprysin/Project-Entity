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

    /** Triggers visual animations for card movement between zones. */
    const triggerVisual = (sourceKey: string, targetKey: string, type: 'discard' | 'void' | 'retrieve', cardData?: Card) => {
        const startEl = zoneRefs.current.get(sourceKey);
        let endEl = zoneRefs.current.get(targetKey);
        if (!endEl && targetKey.includes('hand')) {
            const playerIndex = targetKey.split('-')[0];
            endEl = zoneRefs.current.get(`${playerIndex}-hand-container`);
        }
        if (!startEl) return;

        const sRect = startEl.getBoundingClientRect();
        const startX = (sRect.left + sRect.width / 2) / window.innerWidth * 100;
        const startY = (sRect.top + sRect.height / 2) / window.innerHeight * 100;
        const id = Math.random().toString();

        if (type === 'discard' || type === 'void' || type === 'retrieve') {
            if (!endEl) return;
            const eRect = endEl.getBoundingClientRect();
            const targetX = (eRect.left + eRect.width / 2) / window.innerWidth * 100;
            const targetY = (eRect.top + eRect.height / 2) / window.innerHeight * 100;
            setFlyingCards(prev => [...prev, { id, startX, startY, targetX, targetY, card: cardData }]);
            setTimeout(() => setFlyingCards(prev => prev.filter(c => c.id !== id)), 800);
        } else {
            setVoidAnimations(prev => [...prev, { id, x: startX, y: startY }]);
            setTimeout(() => setVoidAnimations(prev => prev.filter(c => c.id !== id)), 1500);
        }
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
        flyingCards, voidAnimations, floatingTexts, shatterEffects,
        discardFlash, voidFlash, displayedLp, lpScale, lpFlash,
        phaseFlash, turnFlash,
        // Setters
        setFloatingTexts, setDiscardFlash, setVoidFlash,
        setDisplayedLp, setLpScale, setLpFlash,
        setPhaseFlash, setTurnFlash,
        // Refs
        prevDiscardLengths, prevVoidLengths, lastLp,
        // Actions
        setRef, triggerVisual, triggerShatter,
    };
};
