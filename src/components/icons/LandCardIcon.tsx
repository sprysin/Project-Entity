import React from 'react';

/** The Land subtype uses a hexagon while retaining its Action card identity. */
export function LandCardIcon({ className = '' }: { className?: string }) {
    return <svg aria-hidden="true" className={`land-card-icon inline-block shrink-0 ${className}`}
        viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
        <polygon points="6,2 18,2 23,12 18,22 6,22 1,12" />
    </svg>;
}
