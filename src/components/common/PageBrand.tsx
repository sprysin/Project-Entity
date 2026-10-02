import React from 'react';
import './PageChrome.css';

export default function PageBrand({ section }: { section: string }) {
  return <span className="page-brand">
    <span className="page-brand__mark" aria-hidden="true"><span /></span>
    <span className="page-brand__copy"><strong>PROJECT ENTITY</strong><small>{section}</small></span>
  </span>;
}
