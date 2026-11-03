# RAEP-Platform KG: A Web Platform for Geospatial Exploration and Querying of a Drinking Water Supply Knowledge Graph, Haute Matsiatra, Madagascar


This repository contains the source code of the **RAEP-Platform KG** demonstration platform, developed as part of research on drinking water supply networks (*Réseaux d'Adduction d'Eau Potable* - AEP) in the Haute Matsiatra region, Madagascar.

The platform bridges Semantic Web technologies (OWL 2, GeoSPARQL) and Geographic Information Systems (GIS) to enable interactive exploration, querying, and cartographic visualization of a knowledge graph containing over 3.4 million RDF triples.

---

## Demonstration Video

The user workflow and interactive features are demonstrated in the video accessible below:

* Demonstration video link: https://zenodo.org/records/23915004 

---

## Key Features

The platform focuses on two core capabilities:

### 1. Semantic Exploration of the Ontology and Instances
* **Taxonomy and metadata navigation:** hierarchical browsing across hydraulic network concepts (`WaterIntake`, `WaterTreatmentPlant`, `WaterReservoir`, `DistributionPoint`, `DistributionConduit`), territorial administrative units (`Municipality`, `Neighborhood`), and temporal observation datasets (`RawWater`, `TreatedWater`, `DistributedWater`).
* **Detailed concept inspection:** contextual display of IRIs, multilingual labels, taxonomic inheritance hierarchies (`rdfs:subClassOf`), domains/ranges (`rdfs:domain`, `rdfs:range`), and verified instance counts.
* **Interactive conceptual schema:** dynamic vector graph rendering interconnections and hydraulic flows (`supplies`, `connectedTo`, `records`) with drag-and-drop node manipulation.

### 2. GeoSPARQL Querying and Georeferenced Visualization
* **SPARQL / GeoSPARQL console:** interactive query editor with automated prefix registration (`raep:`, `geo:`, `rdf:`).
* **On-the-fly coordinate reprojection:** automatic detection of `geo:asWKT` geometries and real-time conversion from Madagascar local coordinates (EPSG:29702 Laborde) to the standard international WGS84 system (EPSG:4326).
* **Interactive Leaflet map:** vector cartography with differentiated symbology according to asset types, automatic camera bounding-box adjustment (*fit bounds*), and technical attribute popups on feature click.
* **Tabular results and data export:** structured tabular view of query results with one-click full data export to CSV format.

---

## Repository Structure

```text
RAEP_KG_DEMO_RHM/
├── backend/
│   ├── main.py                     # FastAPI REST API and GeoSPARQL query engine
│   ├── requirements.txt            # Python dependencies
│   ├── Dockerfile                  # Backend container configuration
│   └── Ontologie/
│       ├── catalog-v001.xml        # Protégé XML catalog configuration
│       ├── ontologie_raep_rhm.ttl  # OWL 2 schema (active English version)
│       ├── ontologie_raep_rhm_en.ttl
│       ├── ontologie_raep_rhm_fr.ttl
│       ├── graphe_raep_rhm_protege_extrait.ttl # Representative knowledge graph sample
│       ├── graphe_raep_rhm_protege_extrait_en.ttl
│       ├── graphe_raep_rhm_protege_extrait_fr.ttl
│       ├── ontology_index.json     # Precomputed index (classes, counts, individuals)
│       ├── ontology_index_en.json
│       ├── ontology_index_fr.json
│       ├── requetes_demo_raep.sparql # Reference competency queries
│       ├── requetes_demo_raep_en.sparql
│       └── requetes_demo_raep_fr.sparql
├── frontend/
│   ├── index.html                  # Client application entry point
│   ├── package.json                # Node.js dependencies and build scripts
│   ├── package-lock.json
│   ├── vite.config.js              # Vite configuration
│   ├── Dockerfile                  # Frontend container configuration
│   ├── public/                     # Static assets
│   └── src/
│       ├── main.jsx                # React root entry point
│       ├── App.jsx
│       ├── components/             # Navigation and header components
│       ├── layouts/                # Main dashboard layout
│       └── pages/
│           └── Ontologie.jsx       # Ontology explorer, SPARQL console, and map view
├── docker-compose.yml              # Multi-container orchestration (backend and frontend)
├── .dockerignore
└── .gitignore
```

---

## Installation and Deployment

### Option 1: Deployment with Docker (Recommended)

The repository provides a multi-container Docker configuration for automated one-command deployment:

```bash
docker compose up --build
```

Once the containers are running:
* Web Application: `http://localhost:4044`
* Backend REST API: `http://localhost:8000`
* Interactive OpenAPI Documentation (Swagger UI): `http://localhost:8000/docs`

To stop the containers:
```bash
docker compose down
```

---

### Option 2: Local Setup without Docker

#### Prerequisites
* Python 3.10 or higher
* Node.js 18 or higher with npm

#### 1. Backend Setup (FastAPI)

```bash
cd backend

# Create and activate virtual environment
python -m venv venv

# On Linux / macOS:
source venv/bin/activate
# On Windows (PowerShell):
venv\Scripts\Activate.ps1
# On Windows (Command Prompt):
venv\Scripts\activate.bat

# Install dependencies
pip install -r requirements.txt

# Start backend server
python main.py
```

The backend server starts on `http://localhost:8000`.

#### 2. Frontend Setup (React / Vite)

In a second terminal window:

```bash
cd frontend

# Install dependencies
npm install

# Start Vite development server
npm run dev
```

The web application is accessible at `http://localhost:5173`.

---

## Technology Stack

* **Backend:** Python, FastAPI, Uvicorn, RDFLib (SPARQL 1.1 / Turtle engine), Shapely, PyProj.
* **Frontend:** React, Vite, Leaflet, React-Leaflet.
* **Semantic and Spatial Standards:** W3C RDF, OWL 2, OGC GeoSPARQL, WKT (*Well-Known Text*).

---

## License

This project is licensed under the MIT License.
