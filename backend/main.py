import os
import json
from typing import Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel
from rdflib import Graph, Literal, OWL, RDF, RDFS, URIRef
from pyproj import CRS, Transformer
import shapely.wkt
from shapely.geometry import mapping
from shapely.ops import transform as shapely_transform

app = FastAPI(
    title="RAEP-KG Ontology & SPARQL API",
    description="Dedicated Backend for RAEP-KG Semantic Web & GeoSPARQL exploration",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ONTOLOGY_DIR = os.path.join(BASE_DIR, "Ontologie")
ONTOLOGY_SCHEMA_PATH = os.path.join(ONTOLOGY_DIR, "ontologie_raep_rhm.ttl")
ONTOLOGY_EXTRAIT_GRAPH_PATH = os.path.join(ONTOLOGY_DIR, "graphe_raep_rhm_protege_extrait.ttl")
ONTOLOGY_FULL_GRAPH_PATH = os.path.join(ONTOLOGY_DIR, "graphe_raep_rhm.ttl")
ONTOLOGY_INDEX_PATH = os.path.join(ONTOLOGY_DIR, "ontology_index.json")

RAEP_PREFIX = "http://www.semanticweb.org/hayit/ontologies/2026/5/raep-rhm/"

MCD_CLASS_IDS = {
    # English (primary)
    "raep:WaterIntake",
    "raep:WaterTreatmentPlant",
    "raep:WaterReservoir",
    "raep:DistributionPoint",
    "raep:IntakeConduit",
    "raep:AdductionConduit",
    "raep:DistributionConduit",
    "raep:Municipality",
    "raep:Neighborhood",
    "raep:RawWater",
    "raep:TreatedWater",
    "raep:DistributedWater",
    # French (fallbacks)
    "raep:Captage",
    "raep:StationTraitement",
    "raep:Reservoir",
    "raep:PointDistribution",
    "raep:ConduiteAmenee",
    "raep:ConduiteAdduction",
    "raep:ConduiteDistribution",
    "raep:Commune",
    "raep:Quartier",
    "raep:EauBrute",
    "raep:EauTraitee",
    "raep:EauDistribuee",
}

MCD_CLASS_GROUPS = {
    "group:HydraulicInfrastructure": {
        "label": "Hydraulic Infrastructures",
        "children": [
            "raep:WaterIntake",
            "raep:WaterTreatmentPlant",
            "raep:WaterReservoir",
            "raep:DistributionPoint",
            "raep:IntakeConduit",
            "raep:AdductionConduit",
            "raep:DistributionConduit",
            "raep:Captage",
            "raep:StationTraitement",
            "raep:Reservoir",
            "raep:PointDistribution",
            "raep:ConduiteAmenee",
            "raep:ConduiteAdduction",
            "raep:ConduiteDistribution",
        ],
    },
    "group:AdministrativeEntity": {
        "label": "Administrative Entities",
        "children": [
            "raep:Municipality",
            "raep:Neighborhood",
            "raep:Commune",
            "raep:Quartier",
        ],
    },
    "group:Observation": {
        "label": "Observations",
        "children": [
            "raep:RawWater",
            "raep:TreatedWater",
            "raep:DistributedWater",
            "raep:EauBrute",
            "raep:EauTraitee",
            "raep:EauDistribuee",
        ],
    },
}

MCD_OBJECT_PROPERTY_GROUPS = {
    "group:HydraulicRelations": {
        "label": "Hydraulic Relations",
        "children": [
            "raep:connectedTo",
            "raep:supplies",
            "raep:isSuppliedBy",
            "raep:connecteA",
            "raep:alimente",
            "raep:estAlimentePar",
        ],
    },
    "group:AdministrativeLocation": {
        "label": "Administrative Location",
        "children": [
            "raep:isLocatedIn",
            "raep:contains",
            "raep:belongsToMunicipality",
            "raep:seSitueDans",
            "raep:contient",
            "raep:appartientACommune",
        ],
    },
    "group:ObservationMonitoring": {
        "label": "Observation Monitoring",
        "children": [
            "raep:records",
            "raep:isRecordedBy",
            "raep:enregistre",
            "raep:estEnregistrePar",
        ],
    },
}

MCD_DATA_PROPERTY_GROUPS = {
    "group:WaterIntake": {
        "label": "WaterIntake",
        "children": [
            "raep:identifier",
            "raep:label",
            "raep:structureType",
            "raep:flowRate",
            "raep:observationDate",
            "http://www.opengis.net/ont/geosparql#asWKT",
            "raep:identifiant",
            "raep:libelle",
            "raep:typeOuvrage",
            "raep:debit",
            "raep:dateObservation",
        ],
    },
    "group:WaterTreatmentPlant": {
        "label": "WaterTreatmentPlant",
        "children": [
            "raep:identifier",
            "raep:label",
            "raep:elevation",
            "raep:capacity",
            "http://www.opengis.net/ont/geosparql#asWKT",
            "raep:identifiant",
            "raep:libelle",
            "raep:capacite",
        ],
    },
    "group:WaterReservoir": {
        "label": "WaterReservoir",
        "children": [
            "raep:identifier",
            "raep:material",
            "raep:volumeM3",
            "http://www.opengis.net/ont/geosparql#asWKT",
            "raep:identifiant",
            "raep:materiau",
        ],
    },
    "group:DistributionPoint": {
        "label": "DistributionPoint",
        "children": [
            "raep:identifier",
            "raep:structureType",
            "raep:standpipeReference",
            "http://www.opengis.net/ont/geosparql#asWKT",
            "raep:identifiant",
            "raep:typeOuvrage",
            "raep:referenceBorne",
        ],
    },
    "group:IntakeConduit": {
        "label": "IntakeConduit",
        "children": [
            "raep:identifier",
            "raep:label",
            "raep:material",
            "raep:length",
            "http://www.opengis.net/ont/geosparql#asWKT",
            "raep:identifiant",
            "raep:libelle",
            "raep:materiau",
            "raep:longueur",
        ],
    },
    "group:AdductionConduit": {
        "label": "AdductionConduit",
        "children": [
            "raep:identifier",
            "raep:label",
            "raep:material",
            "raep:length",
            "http://www.opengis.net/ont/geosparql#asWKT",
            "raep:identifiant",
            "raep:libelle",
            "raep:materiau",
            "raep:longueur",
        ],
    },
    "group:DistributionConduit": {
        "label": "DistributionConduit",
        "children": [
            "raep:identifier",
            "raep:label",
            "raep:material",
            "raep:length",
            "http://www.opengis.net/ont/geosparql#asWKT",
            "raep:identifiant",
            "raep:libelle",
            "raep:materiau",
            "raep:longueur",
        ],
    },
    "group:Neighborhood": {
        "label": "Neighborhood",
        "children": [
            "raep:identifier",
            "raep:neighborhoodCode",
            "raep:label",
            "raep:population",
            "http://www.opengis.net/ont/geosparql#asWKT",
            "raep:identifiant",
            "raep:codeQuartier",
            "raep:libelle",
        ],
    },
    "group:Municipality": {
        "label": "Municipality",
        "children": [
            "raep:identifier",
            "raep:municipalityCode",
            "raep:label",
            "raep:population",
            "http://www.opengis.net/ont/geosparql#asWKT",
            "raep:identifiant",
            "raep:codeCommune",
            "raep:libelle",
        ],
    },
    "group:RawWater": {
        "label": "RawWater",
        "children": [
            "raep:identifier",
            "raep:quantity",
            "raep:observationDate",
            "raep:identifiant",
            "raep:quantite",
            "raep:dateObservation",
        ],
    },
    "group:TreatedWater": {
        "label": "TreatedWater",
        "children": [
            "raep:identifier",
            "raep:quantity",
            "raep:observationDate",
            "raep:identifiant",
            "raep:quantite",
            "raep:dateObservation",
        ],
    },
    "group:DistributedWater": {
        "label": "DistributedWater",
        "children": [
            "raep:identifier",
            "raep:quantity",
            "raep:observationDate",
            "raep:identifiant",
            "raep:quantite",
            "raep:dateObservation",
        ],
    },
}

CLASS_TO_MCD_GROUP = {
    class_id: group["label"]
    for group in MCD_CLASS_GROUPS.values()
    for class_id in group["children"]
}

PROPERTY_LABEL_OVERRIDES = {
    "http://www.opengis.net/ont/geosparql#asWKT": "GEOM",
    "raep:observationDate": "Date",
    "raep:dateObservation": "Date",
    "raep:population": "Population",
}
OFFICIAL_PROPERTY_COUNTS = {
    "raep:connectedTo": 22452,
    "raep:connecteA": 22452,
    "raep:supplies": 11226,
    "raep:alimente": 11226,
    "raep:isSuppliedBy": 11226,
    "raep:estAlimentePar": 11226,
    "raep:isLocatedIn": 12013,
    "raep:seSitueDans": 12013,
    "raep:belongsToMunicipality": 787,
    "raep:appartientACommune": 787,
    "raep:contains": 787,
    "raep:contient": 787,
    "raep:records": 544256,
    "raep:enregistre": 544256,
    "raep:isRecordedBy": 544256,
    "raep:estEnregistrePar": 544256,
    "http://www.opengis.net/ont/geosparql#asWKT": 32872,
    "raep:identifier": 32872,
    "raep:identifiant": 32872,
    "raep:label": 32872,
    "raep:libelle": 32872,
    "raep:structureType": 11243,
    "raep:typeOuvrage": 11243,
    "raep:length": 11226,
    "raep:longueur": 11226,
    "raep:material": 11226,
    "raep:materiau": 11226,
    "raep:population": 879,
    "raep:volumeM3": 6,
    "raep:elevation": 3,
    "raep:capacity": 3,
    "raep:capacite": 3,
    "raep:flowRate": 8,
    "raep:debit": 8,
    "raep:standpipeReference": 11226,
    "raep:referenceBorne": 11226,
    "raep:quantity": 544256,
    "raep:quantite": 544256,
    "raep:observationDate": 544256,
    "raep:dateObservation": 544256,
    "raep:municipalityCode": 92,
    "raep:codeCommune": 92,
    "raep:neighborhoodCode": 787,
    "raep:codeQuartier": 787,
}


ONTOLOGY_QUERIES = {
    "classes": {
        "title": "Individuals by class",
        "description": "Counts the primary classes modeled in the knowledge graph.",
        "sparql": """
            PREFIX raep: <http://www.semanticweb.org/hayit/ontologies/2026/5/raep-rhm/>
            PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
            SELECT ?class (COUNT(?individual) AS ?count)
            WHERE {
              ?individual rdf:type ?class .
              VALUES ?class {
                raep:Municipality
                raep:Neighborhood
                raep:WaterIntake
                raep:WaterTreatmentPlant
                raep:WaterReservoir
                raep:DistributionPoint
                raep:IntakeConduit
                raep:AdductionConduit
                raep:DistributionConduit
                raep:RawWater
                raep:TreatedWater
                raep:DistributedWater
              }
            }
            GROUP BY ?class
            ORDER BY ?class
        """,
    },
    "reservoirs": {
        "title": "Water reservoirs and neighborhoods",
        "description": "Lists water reservoirs, their storage volume, and administrative location.",
        "sparql": """
            PREFIX raep: <http://www.semanticweb.org/hayit/ontologies/2026/5/raep-rhm/>
            PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
            SELECT ?reservoir ?reservoirName ?neighborhood ?neighborhoodName ?volume
            WHERE {
              ?reservoir rdf:type raep:WaterReservoir ;
                         raep:label ?reservoirName ;
                         raep:isLocatedIn ?neighborhood .
              OPTIONAL { ?reservoir raep:volumeM3 ?volume . }
              OPTIONAL { ?neighborhood raep:label ?neighborhoodName . }
            }
            ORDER BY ?reservoir
        """,
    },
    "eau_distribuee": {
        "title": "Distributed water observations",
        "description": "Relates time-series observations to distribution standpipes.",
        "sparql": """
            PREFIX raep: <http://www.semanticweb.org/hayit/ontologies/2026/5/raep-rhm/>
            PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
            SELECT ?observation ?date ?quantity ?point ?tapRef ?neighborhood
            WHERE {
              ?observation rdf:type raep:DistributedWater ;
                           raep:observationDate ?date ;
                           raep:quantity ?quantity ;
                           raep:isRecordedBy ?point .
              OPTIONAL { ?point raep:standpipeReference ?tapRef . }
              OPTIONAL { ?point raep:isLocatedIn ?neighborhood . }
            }
            ORDER BY ?date ?point
            LIMIT 50
        """,
    },
    "geometries": {
        "title": "WKT Geometries",
        "description": "Retrieves GeoSPARQL geometries available in the knowledge graph.",
        "sparql": """
            PREFIX geo: <http://www.opengis.net/ont/geosparql#>
            SELECT ?infrastructure ?wkt
            WHERE {
              ?infrastructure geo:hasGeometry/geo:asWKT ?wkt .
            }
            LIMIT 100
        """,
    },
}

_ontology_graph_cache = {"mtime": None, "graph": None}
_ontology_schema_cache = {"mtime": None, "graph": None}
_ontology_index_cache = {"mtime": None, "data": None}

class SparqlRequest(BaseModel):
    query: str

def get_ontology_graph():
    path_to_load = None
    if os.path.exists(ONTOLOGY_EXTRAIT_GRAPH_PATH):
        path_to_load = ONTOLOGY_EXTRAIT_GRAPH_PATH
    elif os.path.exists(ONTOLOGY_FULL_GRAPH_PATH):
        path_to_load = ONTOLOGY_FULL_GRAPH_PATH
    elif os.path.exists(ONTOLOGY_SCHEMA_PATH):
        path_to_load = ONTOLOGY_SCHEMA_PATH

    if not path_to_load:
        raise HTTPException(status_code=404, detail="Ontology graph not found in Ontologie directory.")

    mtime = os.path.getmtime(path_to_load)
    if _ontology_graph_cache["graph"] is None or _ontology_graph_cache["mtime"] != mtime:
        graph = Graph()
        graph.parse(path_to_load, format="turtle")
        _ontology_graph_cache["graph"] = graph
        _ontology_graph_cache["mtime"] = mtime
    return _ontology_graph_cache["graph"]

def get_ontology_schema_graph():
    path_to_load = None
    if os.path.exists(ONTOLOGY_SCHEMA_PATH):
        path_to_load = ONTOLOGY_SCHEMA_PATH
    elif os.path.exists(ONTOLOGY_EXTRAIT_GRAPH_PATH):
        path_to_load = ONTOLOGY_EXTRAIT_GRAPH_PATH
    elif os.path.exists(ONTOLOGY_FULL_GRAPH_PATH):
        path_to_load = ONTOLOGY_FULL_GRAPH_PATH

    if not path_to_load:
        raise HTTPException(status_code=404, detail="Ontology schema file not found.")

    mtime = os.path.getmtime(path_to_load)
    if _ontology_schema_cache["graph"] is None or _ontology_schema_cache["mtime"] != mtime:
        graph = Graph()
        graph.parse(path_to_load, format="turtle")
        _ontology_schema_cache["graph"] = graph
        _ontology_schema_cache["mtime"] = mtime
    return _ontology_schema_cache["graph"]

def get_ontology_index():
    if not os.path.exists(ONTOLOGY_INDEX_PATH):
        return {}
    mtime = os.path.getmtime(ONTOLOGY_INDEX_PATH)
    if _ontology_index_cache["data"] is None or _ontology_index_cache["mtime"] != mtime:
        with open(ONTOLOGY_INDEX_PATH, "r", encoding="utf-8") as handle:
            _ontology_index_cache["data"] = json.load(handle)
            _ontology_index_cache["mtime"] = mtime
    return _ontology_index_cache["data"]

def compact_uri(value):
    text = str(value)
    if text.startswith(RAEP_PREFIX):
        return "raep:" + text[len(RAEP_PREFIX):]
    return text

def rdf_value_to_json(value):
    if value is None:
        return None
    if isinstance(value, Literal):
        py_value = value.toPython()
        if isinstance(py_value, (int, float)):
            return py_value
        return str(py_value)
    return compact_uri(value)

def label_for(graph: Graph, resource):
    label = graph.value(resource, RDFS.label)
    if label:
        return str(label)
    return compact_uri(resource).split(":")[-1]

def entity_item(graph: Graph, resource):
    return {
        "id": compact_uri(resource),
        "label": label_for(graph, resource),
        "iri": str(resource),
    }

def list_subjects(graph: Graph, rdf_type):
    items = [entity_item(graph, subject) for subject in graph.subjects(RDF.type, rdf_type)]
    return sorted(items, key=lambda item: item["label"].lower())

def ontology_class_tree(graph: Graph, class_counts=None):
    class_counts = class_counts or {}
    classes = {
        item["id"]: item
        for item in list_subjects(graph, OWL.Class)
        if item["id"] in MCD_CLASS_IDS
    }
    grouped_classes = []
    for group_id, group in MCD_CLASS_GROUPS.items():
        children = [class_id for class_id in group["children"] if class_id in classes]
        grouped_classes.append({
            "id": group_id,
            "label": group["label"],
            "iri": "",
            "parents": [],
            "individual_count": sum(class_counts.get(class_id, 0) for class_id in children),
            "is_group": True,
        })
        for class_id in children:
            item = classes[class_id]
            item["parents"] = [group_id]
            item["individual_count"] = class_counts.get(class_id, 0)
            item["is_group"] = False
            grouped_classes.append(item)
    return grouped_classes

def ontology_property_items(graph: Graph, rdf_type, groups, data_graph: Optional[Graph] = None):
    props = {}
    search_graph = data_graph if data_graph is not None else graph
    for prop in graph.subjects(RDF.type, rdf_type):
        if not isinstance(prop, URIRef):
            continue
        item = entity_item(graph, prop)
        item["label"] = PROPERTY_LABEL_OVERRIDES.get(item["id"], item["label"])
        item["domain"] = [compact_uri(value) for value in graph.objects(prop, RDFS.domain)]
        item["range"] = [compact_uri(value) for value in graph.objects(prop, RDFS.range)]
        # Lookup in official counts first, then count in loaded graph
        official_count = OFFICIAL_PROPERTY_COUNTS.get(item["id"])
        if official_count is not None:
            item["usage_count"] = official_count
        else:
            item["usage_count"] = sum(1 for _ in search_graph.triples((None, prop, None)))
        props[item["id"]] = item

    grouped_props = []
    for group_id, group in groups.items():
        children = [prop_id for prop_id in group["children"] if prop_id in props]
        grouped_props.append({
            "id": group_id,
            "label": group["label"],
            "iri": "",
            "parents": [],
            "usage_count": sum(props[prop_id]["usage_count"] for prop_id in children),
            "is_group": True,
        })
        for prop_id in children:
            item = dict(props[prop_id])
            item["id"] = f"{group_id}/{prop_id}"
            item["property_id"] = prop_id
            item["parents"] = [group_id]
            item["is_group"] = False
            grouped_props.append(item)
    return grouped_props

def is_wkt_string(val):
    if not isinstance(val, str):
        return False
    upper = val.strip().upper()
    return any(upper.startswith(prefix) for prefix in [
        "POINT", "LINESTRING", "MULTILINESTRING", "POLYGON", "MULTIPOLYGON", "GEOMETRYCOLLECTION"
    ])

def extract_geojson_from_sparql_results(graph: Graph, rows: list, columns: list):
    features = []
    bounds = None
    transformer = Transformer.from_crs(CRS.from_epsg(29702), CRS.from_epsg(4326), always_xy=True)
    entity_geom_cache = {}

    GEO_HAS_GEOMETRY = URIRef("http://www.opengis.net/ont/geosparql#hasGeometry")
    GEO_AS_WKT = URIRef("http://www.opengis.net/ont/geosparql#asWKT")

    def get_wkt_for_uri(uri_str):
        if uri_str in entity_geom_cache:
            return entity_geom_cache[uri_str]
        full_uri = uri_str
        if uri_str.startswith("raep:"):
            full_uri = RAEP_PREFIX + uri_str[5:]
        try:
            res_ref = URIRef(full_uri)
            wkt_val = graph.value(res_ref, GEO_AS_WKT)
            if not wkt_val:
                geom_node = graph.value(res_ref, GEO_HAS_GEOMETRY)
                if geom_node:
                    wkt_val = graph.value(geom_node, GEO_AS_WKT)
            res = str(wkt_val) if wkt_val else None
            entity_geom_cache[uri_str] = res
            return res
        except Exception:
            entity_geom_cache[uri_str] = None
            return None

    for row_idx, row in enumerate(rows):
        wkt_str = None
        for col in columns:
            val = row.get(col)
            if is_wkt_string(val):
                wkt_str = val
                break

        if not wkt_str:
            for col in columns:
                val = row.get(col)
                if isinstance(val, str) and (val.startswith("raep:") or val.startswith("http")):
                    cand = get_wkt_for_uri(val)
                    if cand:
                        wkt_str = cand
                        break

        if not wkt_str:
            continue

        try:
            geom = shapely.wkt.loads(wkt_str)
            if geom.is_empty:
                continue

            sample_coord = None
            if geom.geom_type == "Point":
                sample_coord = geom.coords[0]
            elif geom.geom_type in ("LineString", "MultiPoint"):
                sample_coord = geom.coords[0] if len(geom.coords) > 0 else None
            elif geom.geom_type in ("MultiLineString", "Polygon"):
                sample_coord = geom.geoms[0].coords[0] if len(geom.geoms) > 0 else None

            if sample_coord and (abs(sample_coord[0]) > 1000 or abs(sample_coord[1]) > 1000):
                geom_wgs84 = shapely_transform(transformer.transform, geom)
            else:
                geom_wgs84 = geom

            minx, miny, maxx, maxy = geom_wgs84.bounds
            if bounds is None:
                bounds = [minx, miny, maxx, maxy]
            else:
                bounds = [
                    min(bounds[0], minx),
                    min(bounds[1], miny),
                    max(bounds[2], maxx),
                    max(bounds[3], maxy),
                ]

            clean_props = {}
            for k, v in row.items():
                if is_wkt_string(v):
                    clean_props[k] = f"{v[:30]}..." if len(str(v)) > 30 else v
                else:
                    clean_props[k] = v

            features.append({
                "type": "Feature",
                "id": row_idx,
                "geometry": mapping(geom_wgs84),
                "properties": clean_props,
            })
        except Exception:
            continue

    geojson = {
        "type": "FeatureCollection",
        "features": features,
    } if features else None

    return geojson, bounds

def execute_sparql(query_text: str):
    normalized = query_text.strip().lower()
    if not normalized:
        raise HTTPException(status_code=400, detail="The SPARQL query is empty.")
    if not normalized.startswith("prefix") and not normalized.startswith("select"):
        raise HTTPException(status_code=400, detail="Only SELECT queries are authorized.")
    if any(k in normalized for k in ["construct", "insert", "delete", "drop", "clear"]):
        raise HTTPException(status_code=400, detail="Only read-only SELECT queries are authorized.")

    graph = get_ontology_graph()
    result = graph.query(query_text)
    if not getattr(result, "vars", None):
        raise HTTPException(status_code=400, detail="The query must return a SELECT tabular result.")
    columns = [str(var) for var in result.vars]
    rows = []
    for row in result:
        rows.append({
            columns[index]: rdf_value_to_json(value)
            for index, value in enumerate(row)
        })
        # Aucun plafond arbitraire : tous les resultats sont retournes

    geojson, bounds = extract_geojson_from_sparql_results(graph, rows, columns)
    return {
        "columns": columns,
        "rows": rows,
        "row_count": len(rows),
        "geojson": jsonable_encoder(geojson) if geojson else None,
        "bounds": bounds,
    }

def run_ontology_query(query_id: str):
    query = ONTOLOGY_QUERIES.get(query_id)
    if not query:
        raise HTTPException(status_code=404, detail="Unknown ontology query.")
    sparql_res = execute_sparql(query["sparql"])
    return {
        "id": query_id,
        "title": query["title"],
        "description": query["description"],
        **sparql_res,
    }

# ==================== API ROUTES ====================

@app.get("/")
def read_root():
    return {
        "service": "RAEP-KG Ontology Platform API",
        "status": "online",
        "endpoints": [
            "/api/ontology/summary",
            "/api/ontology/entities",
            "/api/ontology/sparql"
        ]
    }

@app.get("/api/ontology/summary")
async def ontology_summary():
    index = get_ontology_index()
    class_counts = index.get("class_counts", [])
    display_graph_path = (
        ONTOLOGY_EXTRAIT_GRAPH_PATH
        if os.path.exists(ONTOLOGY_EXTRAIT_GRAPH_PATH)
        else (ONTOLOGY_FULL_GRAPH_PATH if os.path.exists(ONTOLOGY_FULL_GRAPH_PATH) else ONTOLOGY_SCHEMA_PATH)
    )
    total_triples = index.get("triple_count")
    if not total_triples:
        graph = get_ontology_graph()
        total_triples = len(graph)

    return {
        "graph_file": display_graph_path,
        "triple_count": total_triples,
        "loaded_triple_count": len(get_ontology_graph()),
        "graph_size_bytes": os.path.getsize(display_graph_path) if os.path.exists(display_graph_path) else 0,
        "generated_at": index.get("generated_at"),
        "queries": [
            {
                "id": query_id,
                "title": query["title"],
                "description": query["description"],
            }
            for query_id, query in ONTOLOGY_QUERIES.items()
        ],
        "class_counts": class_counts,
    }

@app.get("/api/ontology/query/{query_id}")
async def ontology_query(query_id: str):
    return run_ontology_query(query_id)

@app.get("/api/ontology/entities")
async def ontology_entities():
    graph = get_ontology_schema_graph()
    data_graph = get_ontology_graph()
    index = get_ontology_index()
    class_counts = {
        item["classe"]: int(item.get("nombre", 0))
        for item in index.get("class_counts", [])
    }
    return {
        "classes": ontology_class_tree(graph, class_counts),
        "object_properties": ontology_property_items(graph, OWL.ObjectProperty, MCD_OBJECT_PROPERTY_GROUPS, data_graph),
        "data_properties": ontology_property_items(graph, OWL.DatatypeProperty, MCD_DATA_PROPERTY_GROUPS, data_graph),
        "individuals_by_class": index.get("individuals_by_class", []),
    }

@app.post("/api/ontology/sparql")
async def ontology_sparql(request: SparqlRequest):
    return execute_sparql(request.query)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
