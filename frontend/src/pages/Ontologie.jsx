import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AlertTriangle, BrainCircuit, Code, Database, Download, Edit3, Layers, MapPin, Play, RefreshCw, Search } from 'lucide-react';
import { GeoJSON, MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const API_BASE = 'https://raep-kg-rhm-api.univ-fianarantsoa.mg';


const DEFAULT_QUERY = `PREFIX raep: <http://www.semanticweb.org/hayit/ontologies/2026/5/raep-rhm/>
PREFIX rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX geo:  <http://www.opengis.net/ont/geosparql#>
PREFIX owl:  <http://www.w3.org/2002/07/owl#>

SELECT ?infrastructure ?type ?name ?wkt
WHERE {
  ?infrastructure rdf:type ?type ;
                  geo:hasGeometry/geo:asWKT ?wkt .
  OPTIONAL { ?infrastructure raep:label ?name . }
  OPTIONAL { ?infrastructure raep:standpipeReference ?name . }
  FILTER (?type != owl:NamedIndividual)
}`;

const VALID_TABS = new Set(['classes', 'object_properties', 'data_properties', 'individuals', 'sparql', 'graph']);

function formatCell(value) {
  if (value === null || value === undefined || value === '') return '-';
  return String(value);
}

function csvValue(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function getTabFromSearch(search) {
  const tab = new URLSearchParams(search).get('tab') || 'classes';
  return VALID_TABS.has(tab) ? tab : 'classes';
}

function FitSparqlBounds({ bounds }) {
  const map = useMap();
  useEffect(() => {
    if (!bounds) return;
    const [minLng, minLat, maxLng, maxLat] = bounds;
    const layerBounds = L.latLngBounds([minLat, minLng], [maxLat, maxLng]);
    if (layerBounds.isValid()) {
      map.fitBounds(layerBounds, { padding: [28, 28], maxZoom: 18 });
    }
  }, [bounds, map]);
  return null;
}

function SparqlMapResizer({ isVisible }) {
  const map = useMap();
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        map.invalidateSize();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isVisible, map]);
  return null;
}

function sparqlFeatureStyle(feature) {
  const props = feature.properties || {};
  const type = String(props.structureType || props.typeOuvrage || props.type || props.class || props.classe || '').toUpperCase();

  if (type.includes('RESERVOIR') || type.includes('WATERRESERVOIR')) {
    return { color: '#0284C7', weight: 3, opacity: 0.9, fillColor: '#38BDF8', fillOpacity: 0.35 };
  }
  if (type.includes('STATION') || type.includes('WATERTREATMENTPLANT')) {
    return { color: '#7C3AED', weight: 3, opacity: 0.9, fillColor: '#A78BFA', fillOpacity: 0.35 };
  }
  if (type.includes('CONDUIT') || type.includes('CONDUITE') || type.includes('PIPELINE')) {
    return { color: '#2563EB', weight: 3.5, opacity: 0.95 };
  }
  if (type.includes('COMMUNE') || type.includes('MUNICIPALITY') || type.includes('QUARTIER') || type.includes('NEIGHBORHOOD')) {
    return { color: '#D97706', weight: 2, dashArray: '4 4', fillColor: '#FDE68A', fillOpacity: 0.25 };
  }
  return { color: '#0EA5E9', weight: 3, opacity: 0.9, fillColor: '#38BDF8', fillOpacity: 0.3 };
}

function sparqlPointToLayer(feature, latlng) {
  const props = feature.properties || {};
  const type = String(props.structureType || props.typeOuvrage || props.type || props.class || props.classe || '').toUpperCase();

  let color = '#0284C7';
  let fillColor = '#38BDF8';
  let radius = 6;

  if (type.includes('RESERVOIR') || type.includes('WATERRESERVOIR')) {
    color = '#0F766E';
    fillColor = '#2DD4BF';
    radius = 8;
  } else if (type.includes('STATION') || type.includes('WATERTREATMENTPLANT')) {
    color = '#7C3AED';
    fillColor = '#A78BFA';
    radius = 8;
  } else if (type.includes('BORNE') || type.includes('DISTRIBUTION') || type.includes('STANDPIPE') || type.includes('TAP')) {
    color = '#EA580C';
    fillColor = '#FB923C';
    radius = 6;
  } else if (type.includes('CAPTAGE') || type.includes('INTAKE') || type.includes('WATERINTAKE')) {
    color = '#16A34A';
    fillColor = '#4ADE80';
    radius = 7;
  }

  return L.circleMarker(latlng, {
    radius,
    color,
    weight: 2,
    fillColor,
    fillOpacity: 0.9,
  });
}

function onEachFeature(feature, layer) {
  if (!feature.properties) return;
  const entries = Object.entries(feature.properties);
  if (entries.length === 0) return;

  const rowsHtml = entries
    .map(
      ([key, val]) => `
      <tr>
        <th style="padding: 3px 6px; text-align: left; color: #64748B; font-weight: 600; font-size: 11px; border-bottom: 1px solid #F1F5F9;">${key}</th>
        <td style="padding: 3px 6px; color: #0F172A; font-size: 11px; word-break: break-all; border-bottom: 1px solid #F1F5F9;">${val !== null && val !== undefined ? val : '-'}</td>
      </tr>
    `
    )
    .join('');

  const popupContent = `
    <div style="min-width: 200px; max-width: 320px; font-family: Inter, sans-serif; line-height: 1.35;">
      <div style="font-weight: 700; font-size: 13px; color: #1E40AF; margin-bottom: 6px; padding-bottom: 4px; border-bottom: 2px solid #DBEAFE;">
        ${feature.properties.name || feature.properties.nom || feature.properties.reservoirName || feature.properties.nomReservoir || feature.properties.standpipeReference || feature.properties.refBorne || 'Spatial Entity'}
      </div>
      <table style="width: 100%; border-collapse: collapse;">
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </div>
  `;
  layer.bindPopup(popupContent);
}

function ResultTable({ result }) {
  if (!result?.rows?.length) {
    return <div className="ontology-empty">No results to display.</div>;
  }

  return (
    <div className="ontology-table-wrap">
      <table className="ontology-table">
        <thead>
          <tr>{result.columns.map((column) => <th key={column}>{column}</th>)}</tr>
        </thead>
        <tbody>
          {result.rows.map((row, index) => (
            <tr key={index}>
              {result.columns.map((column) => <td key={column}>{formatCell(row[column])}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function buildClassTree(classes) {
  const byId = new Map((classes || []).map((item) => [item.id, { ...item, children: [] }]));
  const roots = [];

  byId.forEach((item) => {
    const localParent = item.parents?.find((parent) => byId.has(parent));
    if (localParent) {
      byId.get(localParent).children.push(item);
    } else {
      roots.push(item);
    }
  });

  return roots;
}

function TreeNode({ node, selectedId, onSelect }) {
  const hasChildren = node.children?.length > 0;
  const [open, setOpen] = useState(true);

  return (
    <li>
      <button
        type="button"
        className={node.id === selectedId ? 'ontology-tree-node active' : 'ontology-tree-node'}
        onClick={() => onSelect(node)}
      >
        <span
          className={hasChildren ? 'ontology-caret' : 'ontology-caret empty'}
          onClick={(event) => {
            if (!hasChildren) return;
            event.stopPropagation();
            setOpen((value) => !value);
          }}
        >
          {hasChildren ? (open ? '▾' : '▸') : ''}
        </span>
        <span className={node.is_group ? 'ontology-dot folder' : 'ontology-dot'} />
        <span>{node.label}</span>
      </button>
      {hasChildren && open && (
        <ul>
          {node.children.map((child) => (
            <TreeNode key={child.id} node={child} selectedId={selectedId} onSelect={onSelect} />
          ))}
        </ul>
      )}
    </li>
  );
}

function ClassHierarchy({ classes, selected, onSelect }) {
  const roots = useMemo(() => buildClassTree(classes), [classes]);
  const [open, setOpen] = useState(true);
  return (
    <div className="protege-tree">
      <div className="protege-title">Class hierarchy</div>
      <ul>
        <li>
          <button type="button" className="ontology-tree-node root" onClick={() => setOpen((value) => !value)}>
            <span className="ontology-caret">{open ? '▾' : '▸'}</span>
            <span className="ontology-dot root" />
            <span>owl:Thing</span>
          </button>
          {open && (
            <ul>
              {roots.map((node) => (
                <TreeNode key={node.id} node={node} selectedId={selected?.id} onSelect={onSelect} />
              ))}
            </ul>
          )}
        </li>
      </ul>
    </div>
  );
}

function DetailPanel({ title, item, kind }) {
  if (!item) {
    return <div className="protege-detail-empty">Select an entity to view its annotations and description.</div>;
  }

  return (
    <div className="protege-detail">
      <div className="protege-section">
        <div className="protege-section-title">Annotations: {item.label}</div>
        <div className="protege-row">
          <strong>rdfs:label</strong>
          <span>{item.label}</span>
        </div>
        <div className="protege-row">
          <strong>IRI</strong>
          <span>{item.is_group ? 'MCD Conceptual Classification Group' : item.iri}</span>
        </div>
      </div>

      <div className="protege-section">
        <div className="protege-section-title">Description: {item.label}</div>
        {kind === 'class' && item.is_group && (
          <>
            <div className="protege-row">
              <strong>Type</strong>
              <span>Conceptual Group</span>
            </div>
            <div className="protege-row">
              <strong>Classes</strong>
              <span>{item.children?.length || 0} class(es)</span>
            </div>
          </>
        )}
        {kind === 'class' && !item.is_group && (
          <>
            <div className="protege-row">
              <strong>SubClass Of</strong>
              <span>{item.parents?.length ? item.parents.join(', ') : 'owl:Thing'}</span>
            </div>
            <div className="protege-row">
              <strong>Instances</strong>
              <span>{item.individual_count || 0} individual(s)</span>
            </div>
          </>
        )}
        {kind === 'property' && (
          <>
            {item.is_group ? (
              <div className="protege-row">
                <strong>Properties</strong>
                <span>{item.children?.length || 0} property(ies)</span>
              </div>
            ) : (
              <>
                <div className="protege-row">
                  <strong>Domain</strong>
                  <span>{item.domain?.length ? item.domain.join(', ') : '-'}</span>
                </div>
                <div className="protege-row">
                  <strong>Range</strong>
                  <span>{item.range?.length ? item.range.join(', ') : '-'}</span>
                </div>
              </>
            )}
            <div className="protege-row">
              <strong>Usage</strong>
              <span>{item.usage_count || 0} triple(s)</span>
            </div>
          </>
        )}
        {kind === 'individual' && (
          <div className="protege-row">
            <strong>Type</strong>
            <span>{title}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function PropertyBrowser({ title, items, selected, onSelect }) {
  const roots = useMemo(() => buildClassTree(items), [items]);
  return (
    <div className="protege-two-pane">
      <div className="protege-tree">
        <div className="protege-title">{title}</div>
        <ul>
          {roots.map((node) => (
            <TreeNode key={node.id} node={node} selectedId={selected?.id} onSelect={onSelect} />
          ))}
        </ul>
      </div>
      <DetailPanel item={selected} kind="property" />
    </div>
  );
}

function IndividualsBrowser({ groups, selected, onSelect }) {
  const groupedIndividuals = useMemo(() => {
    const byGroup = new Map();
    (groups || []).forEach((group) => {
      const groupName = group.group || 'Other';
      if (!byGroup.has(groupName)) {
        byGroup.set(groupName, []);
      }
      byGroup.get(groupName).push(group);
    });
    return Array.from(byGroup.entries()).map(([label, classGroups]) => ({
      label,
      count: classGroups.reduce((sum, group) => sum + (group.count || 0), 0),
      classGroups,
    }));
  }, [groups]);

  return (
    <div className="protege-two-pane">
      <div className="protege-tree">
        <div className="protege-title">Individuals by class</div>
        <div className="ontology-individual-groups compact">
          {groupedIndividuals.map((family) => (
            <details key={family.label} className="ontology-individual-group" open>
              <summary>
                <span>{family.label}</span>
                <strong>{family.count}</strong>
              </summary>
              {family.classGroups.map((group) => (
                <details key={group.class} className="ontology-individual-class">
                  <summary>
                    <span>{group.label}</span>
                    <strong>{group.count}</strong>
                  </summary>
                  <div className="protege-list">
                    {group.individuals.map((individual) => (
                      <button
                        type="button"
                        key={individual.id}
                        className={selected?.id === individual.id ? 'protege-list-item active' : 'protege-list-item'}
                        onClick={() => onSelect({ ...individual, classLabel: group.label })}
                      >
                        {individual.id}
                      </button>
                    ))}
                  </div>
                </details>
              ))}
            </details>
          ))}
        </div>
      </div>
      <DetailPanel title={selected?.classLabel} item={selected} kind="individual" />
    </div>
  );
}

function ConceptualGraph() {
  const svgRef = useRef(null);
  const [draggedNode, setDraggedNode] = useState(null);
  const [classes, setClasses] = useState([
    { id: 'AdministrativeEntity', label: 'AdministrativeEntity', x: 50, y: 50, group: 'admin' },
    { id: 'Municipality', label: 'Municipality', x: 50, y: 200, group: 'admin' },
    { id: 'Neighborhood', label: 'Neighborhood', x: 50, y: 350, group: 'admin' },
    { id: 'HydraulicInfrastructure', label: 'HydraulicInfrastructure', x: 450, y: 50, group: 'infra' },
    { id: 'WaterIntake', label: 'WaterIntake', x: 250, y: 200, group: 'infra' },
    { id: 'WaterTreatmentPlant', label: 'WaterTreatmentPlant', x: 430, y: 200, group: 'infra' },
    { id: 'WaterReservoir', label: 'WaterReservoir', x: 610, y: 200, group: 'infra' },
    { id: 'DistributionPoint', label: 'DistributionPoint', x: 790, y: 200, group: 'infra' },
    { id: 'IntakeConduit', label: 'IntakeConduit', x: 250, y: 350, group: 'infra' },
    { id: 'AdductionConduit', label: 'AdductionConduit', x: 430, y: 350, group: 'infra' },
    { id: 'DistributionConduit', label: 'DistributionConduit', x: 650, y: 350, group: 'infra' },
    { id: 'Observation', label: 'Observation', x: 1000, y: 50, group: 'observation' },
    { id: 'DistributedWater', label: 'DistributedWater', x: 1000, y: 200, group: 'observation' },
    { id: 'TreatedWater', label: 'TreatedWater', x: 1000, y: 350, group: 'observation' },
    { id: 'RawWater', label: 'RawWater', x: 1000, y: 500, group: 'observation' },
  ]);
  const edges = [
    ['Neighborhood', 'Municipality', 'belongsToMunicipality', false, false],
    ['HydraulicInfrastructure', 'Neighborhood', 'isLocatedIn', false, true],
    ['WaterIntake', 'IntakeConduit', 'supplies', false, false],
    ['IntakeConduit', 'WaterTreatmentPlant', 'connectedTo', false, false],
    ['WaterTreatmentPlant', 'AdductionConduit', 'supplies', false, false],
    ['AdductionConduit', 'WaterReservoir', 'connectedTo', false, false],
    ['WaterReservoir', 'DistributionConduit', 'supplies', false, false],
    ['DistributionConduit', 'DistributionPoint', 'connectedTo', false, false],
    ['WaterIntake', 'RawWater', 'records', false, false],
    ['WaterTreatmentPlant', 'TreatedWater', 'records', false, false],
    ['DistributionPoint', 'DistributedWater', 'records', false, false],
    ['Municipality', 'AdministrativeEntity', '', true, false],
    ['Neighborhood', 'AdministrativeEntity', '', true, false],
    ['WaterIntake', 'HydraulicInfrastructure', '', true, false],
    ['WaterTreatmentPlant', 'HydraulicInfrastructure', '', true, false],
    ['WaterReservoir', 'HydraulicInfrastructure', '', true, false],
    ['DistributionPoint', 'HydraulicInfrastructure', '', true, false],
    ['IntakeConduit', 'HydraulicInfrastructure', '', true, false],
    ['AdductionConduit', 'HydraulicInfrastructure', '', true, false],
    ['DistributionConduit', 'HydraulicInfrastructure', '', true, false],
    ['DistributedWater', 'Observation', '', true, false],
    ['TreatedWater', 'Observation', '', true, false],
    ['RawWater', 'Observation', '', true, false],
  ];
  const byId = new Map(classes.map((item) => [item.id, item]));

  const getSvgPoint = (event) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    return point.matrixTransform(svg.getScreenCTM().inverse());
  };

  const moveNode = (event) => {
    if (!draggedNode) return;
    const point = getSvgPoint(event);
    if (!point) return;
    setClasses((items) => items.map((item) => (
      item.id === draggedNode.id
        ? {
            ...item,
            x: Math.min(1030, Math.max(0, point.x - draggedNode.offsetX)),
            y: Math.min(600, Math.max(0, point.y - draggedNode.offsetY)),
          }
        : item
    )));
  };

  const startDrag = (event, item) => {
    const point = getSvgPoint(event);
    if (!point) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDraggedNode({
      id: item.id,
      offsetX: point.x - item.x,
      offsetY: point.y - item.y,
    });
  };

  const getGroupStyle = (group) => {
    if (group === 'admin') return { fill: '#FFE4C4', stroke: '#F5B041' };
    if (group === 'infra') return { fill: '#FFF3CD', stroke: '#F4D03F' };
    if (group === 'observation') return { fill: '#D6EAF8', stroke: '#85C1E9' };
    return { fill: '#ffffff', stroke: '#000000' };
  };

  return (
    <div className="concept-graph-wrap">
      <svg
        ref={svgRef}
        viewBox="0 0 1200 600"
        role="img"
        aria-label="Conceptual schema of the ontology"
        onPointerMove={moveNode}
        onPointerUp={() => setDraggedNode(null)}
        onPointerLeave={() => setDraggedNode(null)}
        style={{ cursor: draggedNode ? 'grabbing' : 'grab', width: '100%', height: '100%', minHeight: '600px' }}
      >
        <defs>
          <marker id="assoc-arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#475569" />
          </marker>
          <marker id="inherit-arrow" viewBox="0 0 14 14" refX="14" refY="7" markerWidth="10" markerHeight="10" orient="auto">
            <path d="M 0 0 L 14 7 L 0 14 Z" fill="white" stroke="#475569" strokeWidth="1.5" />
          </marker>
        </defs>

        {edges.map(([sourceId, targetId, label, isInheritance, isDashed]) => {
          const source = byId.get(sourceId);
          const target = byId.get(targetId);
          if (!source || !target) return null;
          
          let markerEnd = isInheritance ? 'url(#inherit-arrow)' : 'url(#assoc-arrow)';
          let strokeDasharray = isDashed ? '5,5' : 'none';
          
          const x1 = source.x + 85;
          const y1 = source.y + 30;
          const x2 = target.x + 85;
          const y2 = target.y + 30;
          
          return (
            <g key={`${sourceId}-${targetId}-${label}`} className="concept-edge">
              <line 
                x1={x1} y1={y1} x2={x2} y2={y2} 
                markerEnd={markerEnd}
                stroke="#64748b"
                strokeWidth="1.2"
                strokeDasharray={strokeDasharray}
              />
              {label && (
                <text 
                  x={(x1 + x2) / 2} 
                  y={(y1 + y2) / 2 - 5}
                  style={{ fill: '#0f172a', fontSize: '11px', textAnchor: 'middle', fontWeight: 500, textShadow: '1px 1px 2px #fff, -1px 1px 2px #fff, 1px -1px 2px #fff, -1px -1px 2px #fff' }}
                >
                  {label}
                </text>
              )}
            </g>
          );
        })}

        {classes.map((item) => (
          <g
            key={item.id}
            transform={`translate(${item.x}, ${item.y})`}
            onPointerDown={(event) => startDrag(event, item)}
            style={{ cursor: 'pointer' }}
          >
            <rect width="170" height="60" rx="3" style={{ ...getGroupStyle(item.group), strokeWidth: 1.5 }} />
            <text x="85" y="22" style={{ fontSize: '11px', textAnchor: 'middle', fill: '#334155' }}>«owl: Class»</text>
            <text x="85" y="42" style={{ fontSize: '12px', fontWeight: 'bold', textAnchor: 'middle', fill: '#0f172a' }}>{item.label || item.id}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

export default function Ontologie({ isVisible = true }) {
  const location = useLocation();
  const activeTab = getTabFromSearch(location.search);
  const [summary, setSummary] = useState(null);
  const [entities, setEntities] = useState(null);
  const [queryText, setQueryText] = useState(DEFAULT_QUERY);
  const [queryResult, setQueryResult] = useState(null);
  const [search, setSearch] = useState('');
  const [selectedClass, setSelectedClass] = useState(null);
  const [selectedObjectProperty, setSelectedObjectProperty] = useState(null);
  const [selectedDataProperty, setSelectedDataProperty] = useState(null);
  const [selectedIndividual, setSelectedIndividual] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRunningQuery, setIsRunningQuery] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const loadOntology = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const [summaryResponse, entitiesResponse] = await Promise.all([
        fetch(`${API_BASE}/api/ontology/summary`),
        fetch(`${API_BASE}/api/ontology/entities`),
      ]);
      if (!summaryResponse.ok || !entitiesResponse.ok) {
        const errorDetail = !entitiesResponse.ok
          ? await entitiesResponse.json().catch(() => ({}))
          : await summaryResponse.json().catch(() => ({}));
        throw new Error(errorDetail.detail || "Unable to load ontology module.");
      }
      const nextSummary = await summaryResponse.json();
      const nextEntities = await entitiesResponse.json();
      setSummary(nextSummary);
      setEntities(nextEntities);
      setSelectedClass((current) => current || nextEntities.classes?.find((item) => item.id === 'raep:Municipality' || item.id === 'raep:Commune') || nextEntities.classes?.[0]);
      setSelectedObjectProperty((current) => current || nextEntities.object_properties?.[0]);
      setSelectedDataProperty((current) => current || nextEntities.data_properties?.[0]);
    } catch (error) {
      setErrorMsg(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const executeCustomSparql = async (customQuery) => {
    const queryToRun = (customQuery !== undefined ? customQuery : queryText).trim();
    if (!queryToRun) return;
    setIsRunningQuery(true);
    setErrorMsg('');
    try {
      const response = await fetch(`${API_BASE}/api/ontology/sparql`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: queryToRun }),
      });
      if (!response.ok) {
        const detail = await response.json().catch(() => ({}));
        throw new Error(detail.detail || 'SPARQL query failed.');
      }
      setQueryResult(await response.json());
    } catch (error) {
      setErrorMsg(error.message);
    } finally {
      setIsRunningQuery(false);
    }
  };

  const runSparql = () => {
    executeCustomSparql(queryText);
  };

  const handleResetQuery = () => {
    setQueryText(DEFAULT_QUERY);
  };

  const downloadSparqlResult = () => {
    if (!queryResult?.rows?.length) return;
    const csv = [
      queryResult.columns.map(csvValue).join(';'),
      ...queryResult.rows.map((row) => queryResult.columns.map((column) => csvValue(row[column])).join(';')),
    ].join('\n');
    const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sparql_result_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    loadOntology();
  }, []);

  useEffect(() => {
    if (activeTab === 'sparql' && !queryResult) {
      executeCustomSparql(DEFAULT_QUERY);
    }
  }, [activeTab]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filterItems = (items = []) => {
      if (!term) return items;
      return items.filter((item) => `${item.label} ${item.id} ${item.iri}`.toLowerCase().includes(term));
    };
    return {
      classes: filterItems(entities?.classes),
      object_properties: filterItems(entities?.object_properties),
      data_properties: filterItems(entities?.data_properties),
      individuals: entities?.individuals_by_class || [],
    };
  }, [entities, search]);

  return (
    <div className="ontology-page protege-mode">
      <div className="ontology-toolbar">
        <div>
          <h1 className="page-title">Ontology & Knowledge Graph</h1>
          <p className="page-subtitle">Exploration of the OWL 2 ontology and RAEP-KG knowledge graph.</p>
        </div>
        <button className="btn btn-primary" onClick={loadOntology} disabled={isLoading}>
          <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {errorMsg && (
        <div className="ontology-alert">
          <AlertTriangle size={18} />
          {errorMsg}
        </div>
      )}

      <div className="ontology-metrics compact">
        <div className="ontology-metric">
          <Database size={18} />
          <span>RDF Triples</span>
          <strong>{summary?.triple_count ?? '-'}</strong>
        </div>
        <div className="ontology-metric">
          <BrainCircuit size={18} />
          <span>OWL Classes</span>
          <strong>{entities?.classes?.filter((item) => !item.is_group).length ?? '-'}</strong>
        </div>
      </div>

      {activeTab !== 'sparql' && activeTab !== 'graph' && (
        <div className="ontology-search">
          <Search size={16} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Filter..." />
        </div>
      )}

      {activeTab === 'classes' && (
        <div className="protege-two-pane">
          <ClassHierarchy classes={filtered.classes} selected={selectedClass} onSelect={setSelectedClass} />
          <DetailPanel item={selectedClass} kind="class" />
        </div>
      )}

      {activeTab === 'object_properties' && (
        <PropertyBrowser
          title="Object property hierarchy"
          items={filtered.object_properties}
          selected={selectedObjectProperty}
          onSelect={setSelectedObjectProperty}
        />
      )}

      {activeTab === 'data_properties' && (
        <PropertyBrowser
          title="Data property hierarchy"
          items={filtered.data_properties}
          selected={selectedDataProperty}
          onSelect={setSelectedDataProperty}
        />
      )}

      {activeTab === 'individuals' && (
        <IndividualsBrowser groups={filtered.individuals} selected={selectedIndividual} onSelect={setSelectedIndividual} />
      )}

      {activeTab === 'sparql' && (
        <div className="sparql-workbench">
          {/* 1. EN HAUT : Console et champ de requete spatial SPARQL / GeoSPARQL */}
          <section className="sparql-editor card">
            <div className="protege-title">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Code size={16} />
                <span>SPARQL & GeoSPARQL Query Console</span>
              </div>
            </div>
            <textarea
              value={queryText}
              onChange={(event) => setQueryText(event.target.value)}
              spellCheck="false"
              placeholder="Enter your SPARQL or GeoSPARQL query here (WKT geometries will automatically be detected and plotted on the map)..."
            />
            <div className="sparql-actions">
              <button className="btn btn-primary" onClick={runSparql} disabled={isRunningQuery}>
                <Play size={16} />
                {isRunningQuery ? 'Executing query...' : 'Run Query'}
              </button>
              <button
                className="btn btn-light"
                type="button"
                onClick={handleResetQuery}
                disabled={isRunningQuery}
                title="Reset GeoSPARQL example query"
              >
                <RefreshCw size={14} />
                Reset Query
              </button>
              {queryResult?.geojson?.features?.length > 0 ? (
                <span className="sparql-geo-badge">
                  <MapPin size={14} /> {queryResult.geojson.features.length} spatial entities displayed on map
                </span>
              ) : queryResult ? (
                <span style={{ fontSize: '12px', color: '#64748B', marginLeft: 'auto' }}>
                  Query without spatial geometry (tabular display only)
                </span>
              ) : null}
            </div>
          </section>

          {/* 2. AU MILIEU : GeoSPARQL Spatial Visualization (AFFICHEE UNIQUEMENT SI DES GEOMETRIES SONT RETOURNEES) */}
          {queryResult?.geojson?.features?.length > 0 && (
            <section className="sparql-map-panel card">
              <div className="protege-title sparql-map-header">
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <MapPin size={16} />
                  GeoSPARQL Spatial Visualization
                </span>
                <span className="badge-count">
                  {queryResult.geojson.features.length} entities on map
                </span>
              </div>
              <div className="sparql-map-shell">
                <MapContainer
                  center={[-21.45, 47.1]}
                  zoom={12}
                  maxZoom={22}
                  zoomSnap={0.25}
                  zoomDelta={0.5}
                  wheelPxPerZoomLevel={45}
                  style={{ height: '100%', width: '100%' }}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    maxZoom={22}
                    maxNativeZoom={19}
                  />
                  <SparqlMapResizer isVisible={true} />
                  <FitSparqlBounds bounds={queryResult?.bounds} />
                  <GeoJSON
                    key={`sparql-geo-${queryResult.row_count}-${queryResult.geojson.features.length}`}
                    data={queryResult.geojson}
                    style={sparqlFeatureStyle}
                    pointToLayer={sparqlPointToLayer}
                    onEachFeature={onEachFeature}
                  />
                </MapContainer>
              </div>
            </section>
          )}

          {/* 3. EN BAS : Resultats d'execution sous forme de tableau */}
          <section className="sparql-result card">
            <div className="protege-title sparql-result-title">
              <span>Results ({queryResult?.row_count ?? 0} records)</span>
              <button
                className="btn btn-light"
                onClick={downloadSparqlResult}
                disabled={!queryResult?.rows?.length}
                type="button"
              >
                <Download size={15} />
                Export CSV
              </button>
            </div>
            <ResultTable result={queryResult} />
          </section>
        </div>
      )}

      {activeTab === 'graph' && (
        <section className="concept-graph-panel card">
          <div className="protege-title">Conceptual Schema of Classes & Relationships</div>
          <ConceptualGraph />
        </section>
      )}
    </div>
  );
}
