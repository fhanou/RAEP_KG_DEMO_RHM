import React from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import Ontologie from '../pages/Ontologie';

export default function DashboardLayout() {
  return (
    <div className="app-container">
      <Sidebar />
      <div className="main-wrapper">
        <Header />
        <main className="content-area">
          <div className="page-view page-view-fill active">
            <Ontologie isVisible={true} />
          </div>
        </main>
        <footer className="app-footer">
          RAEP-KG Platform — Geospatial Knowledge Graph & SPARQL Benchmark for Intermittent Water Supply
        </footer>
      </div>
    </div>
  );
}
