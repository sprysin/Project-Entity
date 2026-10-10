import React, { useEffect, useRef, useState } from 'react';
import { Card } from '../../types';
import { CardDetail } from '../cards/CardDetail';

/** The shared in-place flip for card reveals, with optional destruction afterwards. */
export const CardReveal: React.FC<{
    card: Card;
    revealed: boolean;
    back?: React.ReactNode;
    onDismiss?: () => void;
    onDestroy?: (source: { rect: DOMRect; cardMarkup: string; rotated: boolean; faceDown: boolean }) => void;
}> = ({ card, revealed, back, onDismiss, onDestroy }) => {
    const faceRef = useRef<HTMLDivElement>(null);
    const callbacks = useRef({ onDismiss, onDestroy });
    callbacks.current = { onDismiss, onDestroy };
    const [destroyed, setDestroyed] = useState(false);
    useEffect(() => {
        setDestroyed(false);
        if (!revealed) return;
        const destroyTimer = onDestroy ? setTimeout(() => {
            const face = faceRef.current?.querySelector<HTMLElement>('.card-token');
            if (face) callbacks.current.onDestroy?.({ rect: face.getBoundingClientRect(), cardMarkup: face.innerHTML, rotated: false, faceDown: false });
            setDestroyed(true);
        }, 1800) : undefined;
        const dismissTimer = setTimeout(() => callbacks.current.onDismiss?.(), 3100);
        return () => { clearTimeout(destroyTimer); clearTimeout(dismissTimer); };
    }, [card.instanceId, revealed, !!onDestroy]);
    return <div className={`card-reveal ${revealed ? 'is-revealing' : ''} ${destroyed ? 'invisible' : ''}`}>
        <div className="card-reveal-face card-reveal-back card-back rounded shadow-2xl border-2 border-slate-300">{back}</div>
        <div ref={faceRef} className="card-reveal-face card-reveal-front rounded shadow-2xl"><CardDetail card={card} className="h-full w-full" /></div>
    </div>;
};
