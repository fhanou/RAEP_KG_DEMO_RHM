import React from 'react';
import { Database } from 'lucide-react';

export default function Header() {
  return (
    <header className="app-header">
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Database size={24} color="#2563EB" />
        <h1 className="header-title" style={{ margin: 0 }}>
          RAEP-KG: Geospatial Knowledge Graph & Semantic Exploration
        </h1>
      </div>
    </header>
  );
}
