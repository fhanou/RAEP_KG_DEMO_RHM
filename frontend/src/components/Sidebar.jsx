import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Database,
  ListTree,
  GitBranch,
  CircleDot,
  SearchCode,
  Share2,
} from 'lucide-react';

export default function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const location = useLocation();
  const activeTab = new URLSearchParams(location.search).get('tab') || 'classes';

  const subClass = (tab) =>
    activeTab === tab ? 'nav-subitem active' : 'nav-subitem';

  return (
    <aside className={isCollapsed ? 'sidebar collapsed' : 'sidebar'}>
      <div
        className="sidebar-header"
        onClick={() => setIsCollapsed(!isCollapsed)}
        title="Collapse or expand menu"
      >
        <div className="logo-icon">
          <Database size={20} />
        </div>
      </div>

      <nav className="nav-links">
        <div className="nav-item active" style={{ cursor: 'default' }}>
          <Database size={20} />
          {!isCollapsed && <span className="nav-label">RAEP Ontology</span>}
        </div>

        {!isCollapsed && (
          <div className="nav-submenu">
            <NavLink to="/?tab=classes" className={() => subClass('classes')}>
              <ListTree size={16} />
              <span>Classes</span>
            </NavLink>
            <NavLink
              to="/?tab=object_properties"
              className={() => subClass('object_properties')}
            >
              <GitBranch size={16} />
              <span>Object Properties</span>
            </NavLink>
            <NavLink
              to="/?tab=data_properties"
              className={() => subClass('data_properties')}
            >
              <CircleDot size={16} />
              <span>Data Properties</span>
            </NavLink>
            <NavLink
              to="/?tab=individuals"
              className={() => subClass('individuals')}
            >
              <Share2 size={16} />
              <span>Individuals</span>
            </NavLink>
            <NavLink to="/?tab=sparql" className={() => subClass('sparql')}>
              <SearchCode size={16} />
              <span>SPARQL Queries</span>
            </NavLink>
          </div>
        )}
      </nav>
    </aside>
  );
}
