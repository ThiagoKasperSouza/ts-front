import "./style.css";
import htmlContent from "./index.html?raw";
import * as Cesium from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";

// Configura a URL base de assets do CesiumJS para evitar erros 404
(window as any).CESIUM_BASE_URL = "/node_modules/cesium/Build/Cesium/";

interface BusRoute {
  route_id: string;
  route_short_name: string;
  route_long_name: string;
  route_color?: string;
}

interface BusTrip {
  trip_id: string;
  route_id: string;
  shape_id: string;
  trip_headsign?: string;
}

interface ShapePoint {
  shape_id?: string;
  shape_pt_lat: number | string;
  shape_pt_lon: number | string;
  shape_pt_sequence: number | string;
  lat?: number | string;
  lon?: number | string;
  latitude?: number | string;
  longitude?: number | string;
}

interface GroupedShapes {
  [shapeId: string]: ShapePoint[];
}

class BusRouteApp {
  private viewer!: Cesium.Viewer;
  private isGlobe: boolean = false;
  private allRoutesEntities: Cesium.Entity[] = [];
  private apiBaseUrl: string = "http://localhost:8080";

  private shapeToRouteMap: Map<string, string> = new Map();
  private routesMap: Map<string, BusRoute> = new Map();
  private routeColorMap: Map<string, Cesium.Color> = new Map();
  private hoverTooltipElement!: HTMLDivElement;

  private routeSelect!: HTMLSelectElement;
  private tripSelect!: HTMLSelectElement;
  private loadBtn!: HTMLButtonElement;
  private toggleGlobeBtn!: HTMLButtonElement;
  private statusBadge!: HTMLDivElement;

  constructor() {
    this.init();
  }

  private init(): void {
    if (!this.bindElements()) return;
    this.initMap();
    this.createHoverTooltip();
    this.setupHoverEvent();
    this.attachEvents();
    this.loadAllRoutesOnStartup();
  }

  private bindElements(): boolean {
    this.routeSelect = document.getElementById("select-route") as HTMLSelectElement;
    this.tripSelect = document.getElementById("select-trip") as HTMLSelectElement;
    this.loadBtn = document.getElementById("btn-load-routes") as HTMLButtonElement;
    this.toggleGlobeBtn = document.getElementById("btn-toggle-projection") as HTMLButtonElement;
    this.statusBadge = document.getElementById("status-message") as HTMLDivElement;

    const elements = [
      { name: "select-route", el: this.routeSelect },
      { name: "select-trip", el: this.tripSelect },
      { name: "btn-load-routes", el: this.loadBtn },
      { name: "btn-toggle-projection", el: this.toggleGlobeBtn },
      { name: "status-message", el: this.statusBadge },
      { name: "map", el: document.getElementById("map") }
    ];

    const missing = elements.filter(item => !item.el);
    if (missing.length > 0) {
      console.error("IDs não encontrados no HTML:", missing.map(m => m.name).join(", "));
      return false;
    }

    return true;
  }

  private initMap(): void {
    this.viewer = new Cesium.Viewer("map", {
      sceneMode: Cesium.SceneMode.SCENE2D,
      infoBox: false,
      selectionIndicator: false,
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      animation: false,
      timeline: false,
      fullscreenButton: false,
    });

    if (this.viewer.cesiumWidget.creditContainer) {
      (this.viewer.cesiumWidget.creditContainer as HTMLElement).style.display = "none";
    }
  }

  private createHoverTooltip(): void {
    this.hoverTooltipElement = document.createElement("div");
    this.hoverTooltipElement.id = "cesium-hover-tooltip";
    
    Object.assign(this.hoverTooltipElement.style, {
      position: "absolute",
      display: "none",
      pointerEvents: "none",
      backgroundColor: "rgba(15, 23, 42, 0.9)",
      color: "#f8fafc",
      padding: "10px 14px",
      borderRadius: "8px",
      border: "1px solid rgba(168, 85, 247, 0.5)",
      boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.5)",
      fontFamily: "sans-serif",
      fontSize: "12px",
      lineHeight: "1.4",
      zIndex: "9999",
      backdropFilter: "blur(4px)"
    });

    document.body.appendChild(this.hoverTooltipElement);
  }

  private setupHoverEvent(): void {
    const handler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);

    handler.setInputAction((movement: { endPosition: Cesium.Cartesian2 }) => {
      const pickedObject = this.viewer.scene.pick(movement.endPosition);

      if (Cesium.defined(pickedObject) && pickedObject.id && pickedObject.id.properties) {
        const entity = pickedObject.id as Cesium.Entity;
        if (!entity.show) return;

        const props = entity.properties;
        const shapeId = props?.getValue(Cesium.JulianDate.now())?.shape_id;
        const routeId = props?.getValue(Cesium.JulianDate.now())?.route_id;

        if (shapeId) {
          const routeInfo = this.routesMap.get(routeId);

          this.hoverTooltipElement.innerHTML = `
            <div style="font-weight: bold; color: #a855f7; margin-bottom: 4px;">
              ${routeInfo?.route_short_name ? `[${routeInfo.route_short_name}] ` : ''}${routeInfo?.route_long_name || 'Detalhes da Rota'}
            </div>
            <div><b>Shape ID:</b> ${shapeId}</div>
            ${routeId ? `<div><b>Route ID:</b> ${routeId}</div>` : ''}
          `;

          this.hoverTooltipElement.style.left = `${movement.endPosition.x + 15}px`;
          this.hoverTooltipElement.style.top = `${movement.endPosition.y + 15}px`;
          this.hoverTooltipElement.style.display = "block";
          return;
        }
      }

      this.hoverTooltipElement.style.display = "none";
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
  }

  private attachEvents(): void {
    this.toggleGlobeBtn.addEventListener("click", () => this.toggleGlobe2D());
    this.loadBtn.addEventListener("click", () => this.fetchRoutes());

    this.routeSelect.addEventListener("change", (e) => {
      const routeId = (e.target as HTMLSelectElement).value;
      if (routeId) {
        this.fetchTrips(routeId);
        this.filterMapEntitiesByRoute(routeId);
      } else {
        this.resetTripSelect();
        this.showAllMapEntities();
      }
    });

    this.tripSelect.addEventListener("change", (e) => {
      const shapeId = (e.target as HTMLSelectElement).value;
      if (shapeId) {
        this.filterMapEntitiesByShape(shapeId);
      } else {
        const currentRouteId = this.routeSelect.value;
        if (currentRouteId) {
          this.filterMapEntitiesByRoute(currentRouteId);
        } else {
          this.showAllMapEntities();
        }
      }
    });
  }

  public toggleGlobe2D(): void {
    this.isGlobe = !this.isGlobe;

    if (this.isGlobe) {
      this.viewer.scene.morphTo3D(1.5);
      this.toggleGlobeBtn.textContent = "Mudar para Mapa 2D 🗺️";
    } else {
      this.viewer.scene.morphTo2D(1.5);
      this.toggleGlobeBtn.textContent = "Mudar para Globo 3D 🌐";
    }
  }

  private updateStatus(text: string, isError = false): void {
    this.statusBadge.textContent = text;
    this.statusBadge.style.color = isError ? "#ef4444" : "var(--accent)";
    this.statusBadge.style.borderColor = isError ? "#ef4444" : "var(--accent-border)";
  }

  private filterMapEntitiesByShape(targetShapeId: string): void {
    const visibleEntities: Cesium.Entity[] = [];

    this.allRoutesEntities.forEach((entity) => {
      const props = entity.properties;
      const shapeId = props?.getValue(Cesium.JulianDate.now())?.shape_id;

      if (shapeId === targetShapeId) {
        entity.show = true;
        visibleEntities.push(entity);
      } else {
        entity.show = false;
      }
    });

    if (visibleEntities.length > 0) {
      this.viewer.zoomTo(visibleEntities);
    }
  }

  private filterMapEntitiesByRoute(targetRouteId: string): void {
    const visibleEntities: Cesium.Entity[] = [];

    this.allRoutesEntities.forEach((entity) => {
      const props = entity.properties;
      const routeId = props?.getValue(Cesium.JulianDate.now())?.route_id;

      if (routeId === targetRouteId) {
        entity.show = true;
        visibleEntities.push(entity);
      } else {
        entity.show = false;
      }
    });

    if (visibleEntities.length > 0) {
      this.viewer.zoomTo(visibleEntities);
    }
  }

  private showAllMapEntities(): void {
    this.allRoutesEntities.forEach((entity) => {
      entity.show = true;
    });
    if (this.allRoutesEntities.length > 0) {
      this.viewer.zoomTo(this.allRoutesEntities);
    }
  }

  private async loadAllRoutesOnStartup(): Promise<void> {
    this.updateStatus("Inicializando mapa: Carregando rotas, viagens e traçados...");

    try {
      // 1. Carrega as rotas
      const resRoutes = await fetch(`${this.apiBaseUrl}/routes`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include"
      });
      if (!resRoutes.ok) throw new Error(`HTTP ${resRoutes.status} em /routes`);
      const dataRoutes = await resRoutes.json();
      const routesList: BusRoute[] = Array.isArray(dataRoutes) ? dataRoutes : (dataRoutes.routes || []);

      if (routesList.length === 0) {
        this.updateStatus("Nenhuma rota encontrada.", true);
        return;
      }

      // Configura cores únicas para cada rota
      const totalRoutes = routesList.length;
      routesList.forEach((r, index) => {
        this.routesMap.set(r.route_id, r);

        if (r.route_color) {
          const hexColor = r.route_color.startsWith('#') ? r.route_color : `#${r.route_color}`;
          this.routeColorMap.set(r.route_id, Cesium.Color.fromCssColorString(hexColor).withAlpha(0.85));
        } else {
          const hue = (index / totalRoutes) * 360;
          this.routeColorMap.set(r.route_id, Cesium.Color.fromHsl(hue / 360, 0.85, 0.55, 0.85));
        }
      });

      this.populateRoutesSelect(routesList);

      // 2. Tenta carregar todas as trips de uma vez só (ou em lote seguro)
      try {
        const resTrips = await fetch(`${this.apiBaseUrl}/trips`, {
          method: "GET",
          credentials: "include"
        });
        if (resTrips.ok) {
          const dataTrips = await resTrips.json();
          const tripsList: BusTrip[] = Array.isArray(dataTrips) ? dataTrips : (dataTrips.trips || []);
          tripsList.forEach(t => {
            if (t.shape_id && t.route_id) {
              this.shapeToRouteMap.set(t.shape_id, t.route_id);
            }
          });
        }
      } catch (e) {
        console.warn("Endpoint /trips geral não disponível ou falhou, mapeando sob demanda.", e);
      }

      // 3. Carrega os shapes geométricos
      const resShapes = await fetch(`${this.apiBaseUrl}/shapes`, {
        method: "GET",
        credentials: "include"
      });

      let allPoints: ShapePoint[] = [];
      if (resShapes.ok) {
        const dataShapes = await resShapes.json();
        allPoints = Array.isArray(dataShapes) ? dataShapes : (dataShapes.shapes || dataShapes.points || []);
      }

      const groupedShapes: GroupedShapes = {};
      allPoints.forEach((pt) => {
        const id = pt.shape_id;
        if (id) {
          if (!groupedShapes[id]) groupedShapes[id] = [];
          groupedShapes[id].push(pt);
        }
      });

      if (Object.keys(groupedShapes).length === 0) {
        this.updateStatus("Nenhum traçado disponível para renderização.", true);
        return;
      }

      this.renderAllShapesGroupedByRouteColor(groupedShapes);
      this.updateStatus(`${Object.keys(groupedShapes).length} traçados coloridos por rota com sucesso.`);

    } catch (err: any) {
      console.error("Erro no carregamento inicial:", err);
      this.updateStatus(`Erro no carregamento: ${err.message}`, true);
    }
  }

  private renderAllShapesGroupedByRouteColor(groupedShapes: GroupedShapes): void {
    this.clearAllRoutesEntities();
    const shapeIds = Object.keys(groupedShapes);

    shapeIds.forEach((shapeId) => {
      const points = groupedShapes[shapeId];

      const sortedPoints = points
        .map((p) => ({
          lat: parseFloat(String(p.shape_pt_lat ?? p.lat ?? p.latitude)),
          lon: parseFloat(String(p.shape_pt_lon ?? p.lon ?? p.longitude)),
          seq: parseInt(String(p.shape_pt_sequence ?? 0), 10)
        }))
        .filter((p) => !isNaN(p.lat) && !isNaN(p.lon))
        .sort((a, b) => a.seq - b.seq);

      if (sortedPoints.length < 2) return;

      const degreesArray: number[] = [];
      sortedPoints.forEach((p) => degreesArray.push(p.lon, p.lat));

      const positions = Cesium.Cartesian3.fromDegreesArray(degreesArray);

      // Recupera a rota vinculada ao shape
      const assignedRouteId = this.shapeToRouteMap.get(shapeId) || "";
      // Se não encontrar a rota diretamente, tenta pegar do primeiro ponto se ele possuir route_id embutido
      const finalRouteId = assignedRouteId || (points[0] as any)?.route_id || "";

      const routeColor = this.routeColorMap.get(finalRouteId) || Cesium.Color.fromCssColorString("#a855f7");

      const entity = this.viewer.entities.add({
        name: `Rota - ${shapeId}`,
        properties: new Cesium.PropertyBag({
          shape_id: shapeId,
          route_id: finalRouteId
        }),
        polyline: {
          positions: positions,
          width: 3,
          material: routeColor,
          clampToGround: false
        }
      });

      this.allRoutesEntities.push(entity);
    });

    if (this.allRoutesEntities.length > 0) {
      this.viewer.zoomTo(this.allRoutesEntities);
    }
  }

  private clearAllRoutesEntities(): void {
    this.allRoutesEntities.forEach((entity) => this.viewer.entities.remove(entity));
    this.allRoutesEntities = [];
  }

  private async fetchRoutes(): Promise<void> {
    if (!this.apiBaseUrl) {
      this.updateStatus("Informe a URL base da API", true);
      return;
    }

    this.updateStatus("Buscando /routes...");
    try {
      const res = await fetch(`${this.apiBaseUrl}/routes`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const routesList: BusRoute[] = Array.isArray(data) ? data : data.routes;

      if (!Array.isArray(routesList)) {
        throw new Error("Formato de resposta inesperado da API.");
      }

      routesList.forEach(r => this.routesMap.set(r.route_id, r));
      this.populateRoutesSelect(routesList);
      this.updateStatus(`${routesList.length} rotas carregadas com sucesso.`);
    } catch (err: any) {
      this.updateStatus(`Erro ao carregar /routes: ${err.message}`, true);
    }
  }

  private populateRoutesSelect(routes: BusRoute[]): void {
    this.routeSelect.innerHTML = '<option value="">Selecione uma rota...</option>';
    routes.forEach((route) => {
      const opt = document.createElement("option");
      opt.value = route.route_id;
      opt.textContent = `${route.route_short_name ? route.route_short_name + " - " : ""}${route.route_long_name}`;
      this.routeSelect.appendChild(opt);
    });
    this.routeSelect.disabled = false;
    this.resetTripSelect();
  }

  private async fetchTrips(routeId: string): Promise<void> {
    this.updateStatus(`Buscando viagens para a rota ${routeId}...`);

    try {
      const res = await fetch(`${this.apiBaseUrl}/trips?route_id=${encodeURIComponent(routeId)}`, {
        method: "GET",
        credentials: "include"
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      const tripsList: BusTrip[] = Array.isArray(data) ? data : (data.trips || []);

      if (!Array.isArray(tripsList) || tripsList.length === 0) {
        this.updateStatus("Nenhuma viagem encontrada para esta rota.", true);
        this.populateTripsSelect([]);
        return;
      }

      tripsList.forEach(t => {
        if (t.shape_id) {
          this.shapeToRouteMap.set(t.shape_id, routeId);
        }
      });

      this.populateTripsSelect(tripsList);
      this.updateStatus(`${tripsList.length} viagens encontradas.`);
    } catch (err: any) {
      this.updateStatus(`Erro ao carregar /trips: ${err.message}`, true);
    }
  }

  private populateTripsSelect(trips: BusTrip[]): void {
    this.tripSelect.innerHTML = '<option value="">Selecione uma viagem...</option>';

    if (trips.length === 0) {
      this.tripSelect.disabled = true;
      return;
    }

    const fragment = document.createDocumentFragment();
    const displayLimit = 1000;
    const itemsToRender = trips.slice(0, displayLimit);

    itemsToRender.forEach(trip => {
      const opt = document.createElement("option");
      opt.value = trip.shape_id || trip.trip_id; 
      
      const headsign = trip.trip_headsign ? ` - ${trip.trip_headsign}` : "";
      opt.textContent = `${trip.trip_id}${headsign}`;
      
      fragment.appendChild(opt);
    });

    this.tripSelect.appendChild(fragment);
    this.tripSelect.disabled = false;
  }

  private resetTripSelect(): void {
    this.tripSelect.innerHTML = '<option value="">Selecione uma viagem...</option>';
    this.tripSelect.disabled = true;
  }
}

export function getHomePage(): string {
  const checkElementAndInit = () => {
    if (document.getElementById("map")) {
      new BusRouteApp();
    } else {
      requestAnimationFrame(checkElementAndInit);
    }
  };

  requestAnimationFrame(checkElementAndInit);

  return htmlContent;
}