import React from 'react';
import type { ShatterEffect } from '../../hooks/useAnimations';

// Keep existing fragments untouched when another destruction or HUD update occurs.
const ShatteredCard = React.memo(({ effect }: { effect: ShatterEffect }) => (
    <div className="shatter-container" aria-hidden="true" style={{
        left: effect.left, top: effect.top, width: effect.width, height: effect.height,
        '--card-width': `${effect.width}px`, '--card-height': `${effect.height}px`,
    } as React.CSSProperties}>
        <div className="shatter-impact" />
        {effect.shards.map((shard, index) => (
            <div key={index} className="shard" style={{
                left: shard.x, top: shard.y, width: shard.width, height: shard.height,
                clipPath: shard.clipPath,
                '--shard-x': `${shard.x}px`, '--shard-y': `${shard.y}px`,
                '--tx': shard.tx, '--ty': shard.ty, '--rot': shard.rot, '--delay': shard.delay,
            } as React.CSSProperties}>
                <div className="shatter-card-copy">
                    <div
                        className={`shatter-card-source ${effect.rotated ? 'shatter-card-source--rotated' : ''} ${effect.faceDown ? 'card-back' : ''}`}
                        dangerouslySetInnerHTML={{ __html: effect.cardMarkup }}
                    />
                </div>
            </div>
        ))}
    </div>
));

export const ShatterOverlay = React.memo(({ effects }: { effects: ShatterEffect[] }) => <>
    {effects.map(effect => <ShatteredCard key={effect.id} effect={effect} />)}
</>);
