import React from 'react';
import { Card } from '../../types';
import { CardDetail } from '../cards/CardDetail';

/** Shows hidden information without flipping the card or changing match rules. */
export const XrayOverlay: React.FC<{ card: Card }> = ({ card }) => (
  <div className="xray-overlay" aria-hidden="true">
    <CardDetail card={card} compact className="h-full w-full" />
  </div>
);
