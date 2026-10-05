import { useEffect, useRef, useState } from "react";

  import OLMap from "ol/Map";
  import View from "ol/View";
  import Overlay from "ol/Overlay";
  import Control from "ol/control/Control";
  import ScaleLine from "ol/control/ScaleLine";
  import TileLayer from "ol/layer/Tile";
  import VectorLayer from "ol/layer/Vector";
  import VectorSource from "ol/source/Vector";
  import XYZ from "ol/source/XYZ";
  import KML from "ol/format/KML";
  import Feature from "ol/Feature";
  import Point from "ol/geom/Point";
  import Style from "ol/style/Style";
  import CircleStyle from "ol/style/Circle";
  import Fill from "ol/style/Fill";
  import Stroke from "ol/style/Stroke";
  import Text from "ol/style/Text";
  import { fromLonLat, toLonLat } from "ol/proj";

  import "ol/ol.css";

  // MAXIMUM ZOOM LEVEL
  const MAX_ZOOM = 17;

  // Reuse styles rather than creating thousands of styles on every redraw.
  const facilityStyleCache = new Map();

  const BASEMAPS = [
    {
      id: "esri-topo",
      name: "Esri Topographic",
      description: "Roads, boundaries and terrain",
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
      preview:
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/5/13/16",
      attribution: "Tiles © Esri and its data providers",
    },
    {
      id: "esri-imagery",
      name: "Satellite Imagery",
      description: "Satellite and aerial imagery",
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      preview:
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/5/13/16",
      attribution:
        "Sources: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
    },
    {
      id: "esri-street",
      name: "Esri Street",
      description: "Street and place information",
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
      preview:
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/5/13/16",
      attribution: "Tiles © Esri and its data providers",
    },
    {
      id: "esri-terrain",
      name: "Esri Terrain",
      description: "Physical terrain and landforms",
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Terrain_Base/MapServer/tile/{z}/{y}/{x}",
      preview:
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Terrain_Base/MapServer/tile/5/13/16",
      attribution: "Tiles © Esri and its data providers",
    },
    {
      id: "esri-dark",
      name: "Esri Dark Gray",
      description: "Dark background map",
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
      preview:
        "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/5/13/16",
      attribution: "Tiles © Esri and its data providers",
    },
    {
      id: "osm",
      name: "OpenStreetMap",
      description: "Community-maintained street map",
      url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      preview: "https://tile.openstreetmap.org/5/16/13.png",
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>',
    },
    {
      id: "humanitarian",
      name: "Humanitarian",
      description: "Humanitarian-focused map details",
      url: "https://{a-c}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png",
      preview: "https://a.tile.openstreetmap.fr/hot/5/16/13.png",
      attribution:
        '© <a href="https://www.openstreetmap.org" target="_blank" rel="noreferrer">OpenStreetMap</a> · Humanitarian style',
    },
    {
      id: "carto-light",
      name: "Carto Light",
      description: "Clean, light background",
      url: "https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
      preview: "https://basemaps.cartocdn.com/light_all/5/16/13.png",
      attribution:
        '© <a href="https://www.openstreetmap.org" target="_blank" rel="noreferrer">OpenStreetMap</a> · © <a href="https://carto.com/attributions" target="_blank" rel="noreferrer">CARTO</a>',
    },
    {
      id: "carto-dark",
      name: "Carto Dark",
      description: "Dark, minimal background",
      url: "https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
      preview: "https://basemaps.cartocdn.com/dark_all/5/16/13.png",
      attribution:
        '© <a href="https://www.openstreetmap.org" target="_blank" rel="noreferrer">OpenStreetMap</a> · © <a href="https://carto.com/attributions" target="_blank" rel="noreferrer">CARTO</a>',
    },
  ];

  function getAllLayerIds(node) {
    if (node.layerId) return [node.layerId];
    return (node.children || []).flatMap(getAllLayerIds);
  }

  function getFeatureValue(feature, possibleNames) {
    const properties = feature.getProperties();
    const normalize = (value) =>
      String(value).toLowerCase().replace(/[^a-z0-9]/g, "");

    for (const possibleName of possibleNames) {
      const wanted = normalize(possibleName);
      const match = Object.entries(properties).find(
        ([key, value]) =>
          normalize(key) === wanted &&
          value !== null &&
          value !== undefined &&
          String(value).trim() !== ""
      );
      if (match) return String(match[1]).trim();
    }
    return "";
  }

  // Facility symbols are selected using the Department / Category field.
  function getFacilitySymbol(feature) {
    const rawCategory = getFeatureValue(feature, [
      "Department / Category",
      "Department Category",
      "Category",
    ]);

    const category = rawCategory
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    // Education
    if (
      category === "format" ||
      category.includes("z p school talasari") ||
      category.includes("education") ||
      category.includes("school")
    ) {
      return "🏫";
    }

    // Health Department (PHC)
    if (
      category.includes("health department phc") ||
      category.includes("primary health") ||
      category === "phc" ||
      category.includes("phu") ||
      category.includes("uhwc")
    ) {
      return "🏥";
    }

    // Health Sub-Centre
    if (
      category.includes("health dept health sub centre") ||
      category.includes("health sub centre") ||
      category.includes("health sub center") ||
      category.includes("subcentre") ||
      category.includes("sub center")
    ) {
      return "🩺";
    }

    // WCD / Anganwadi
    if (
      category.includes("wcd") ||
      category.includes("anganwadi") ||
      category.includes("icds")
    ) {
      return "🏡";
    }

    // Animal Husbandry
    if (
      category.includes("animal husband") ||
      category.includes("daho") ||
      category.includes("livestock")
    ) {
      return "🐄";
    }

    // Gram Panchayat
    if (
      category.includes("gram panchayat") ||
      category.includes("gramapanchayat")
    ) {
      return "🏛️";
    }

    // Panchayat Samiti
    if (category.includes("panchayat samiti")) {
      return "🏢";
    }

    return "📍";
  }

  // Circle border colour for each facility type.
  function getFacilityCircleColor(symbol) {
    const colors = {
      "🏫": "#1976d2",
      "🏥": "#d32f2f",
      "🩺": "#00897b",
      "🏡": "#ef6c00",
      "🐄": "#7b1fa2",
      "🏛️": "#455a64",
      "🏢": "#2e7d32",
      "📍": "#555555",
    };

    return colors[symbol] || "#555555";
  }

  // SLIGHTLY BIGGER, ZOOM-RESPONSIVE SYMBOLS
  function getFacilityStyleFunction(map, symbol) {
    return (feature, resolution) => {
      const zoom =
        map.getView().getZoomForResolution(resolution) ?? 9;

      // Slightly larger circles and emoji symbols at every zoom level.
      const radius = Math.max(
        5,
        Math.min(13, 5 + (zoom - 5) * 0.68)
      );

      const fontSize = Math.max(
        10,
        Math.min(16, 10 + (zoom - 5) * 0.68)
      );

      const roundedRadius = Math.round(radius);
      const roundedFontSize = Math.round(fontSize);

      const cacheKey = `${symbol}-${roundedRadius}-${roundedFontSize}`;

      if (!facilityStyleCache.has(cacheKey)) {
        facilityStyleCache.set(
          cacheKey,
          new Style({
            image: new CircleStyle({
              radius: roundedRadius,
              fill: new Fill({
                color: "rgba(255, 255, 255, 0.96)",
              }),
              stroke: new Stroke({
                color: getFacilityCircleColor(symbol),
                width: 1.4,
              }),
            }),
            text: new Text({
              text: symbol,
              font: `${roundedFontSize}px 'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', sans-serif`,
              textAlign: "center",
              textBaseline: "middle",
              overflow: true,
            }),
          })
        );
      }

      return facilityStyleCache.get(cacheKey);
    };
  }

  function LayerTree({ nodes, visibility, onToggle, onRename, level = 0 }) {
    return nodes.map((node) => {
      const layerIds = getAllLayerIds(node);
      const visibleCount = layerIds.filter(
        (id) => visibility[id] !== false
      ).length;

      const checked =
        layerIds.length > 0 && visibleCount === layerIds.length;
      const partiallyChecked =
        visibleCount > 0 && visibleCount < layerIds.length;

      return (
        <div key={node.id} style={{ marginLeft: level * 13 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              padding: "5px 0",
              fontSize: 13,
              lineHeight: 1.4,
            }}
          >
            <input
              type="checkbox"
              checked={checked}
              ref={(element) => {
                if (element) element.indeterminate = partiallyChecked;
              }}
              disabled={layerIds.length === 0}
              onChange={(event) =>
                onToggle(layerIds, event.target.checked)
              }
              style={{ marginTop: 2, cursor: "pointer" }}
            />

            {node.symbol && (
              <span
                aria-hidden="true"
                style={{
                  width: 24,
                  flexShrink: 0,
                  textAlign: "center",
                  fontSize: 17,
                }}
              >
                {node.symbol}
              </span>
            )}

            <span
              title="Double-click to edit layer name"
              onDoubleClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                const newName = window.prompt(
                  "Enter new layer name:",
                  node.name
                );
                if (newName !== null && newName.trim()) {
                  onRename(node.id, newName.trim());
                }
              }}
              style={{
                flex: 1,
                minWidth: 0,
                overflowWrap: "anywhere",
                cursor: "default",
                userSelect: "none",
              }}
            >
              {node.name}
            </span>
          </div>

          {node.children?.length > 0 && (
            <LayerTree
              nodes={node.children}
              visibility={visibility}
              onToggle={onToggle}
              onRename={onRename}
              level={level + 1}
            />
          )}
        </div>
      );
    });
  }

  export default function App() {
    const mapElement = useRef(null);
    const popupElement = useRef(null);
    const mapRef = useRef(null);
    const baseLayerRef = useRef(null);
    const globalMarkerSourceRef = useRef(null);
    const layersRef = useRef({});
    const sourcesRef = useRef({});

    const [layerTree, setLayerTree] = useState([]);
    const [visibility, setVisibility] = useState({});
    const [featureCount, setFeatureCount] = useState(0);
    const [status, setStatus] = useState("Loading KML data...");

    const [globalSearchText, setGlobalSearchText] = useState("");
    const [globalResults, setGlobalResults] = useState([]);
    const [globalSearchLoading, setGlobalSearchLoading] = useState(false);
    const [globalSearchMessage, setGlobalSearchMessage] = useState("");
    const [globalResultsOpen, setGlobalResultsOpen] = useState(false);

    const [selectedBasemap, setSelectedBasemap] = useState("esri-topo");
    const [galleryOpen, setGalleryOpen] = useState(false);

    // Global place search.
    useEffect(() => {
      const query = globalSearchText.trim();

      if (query.length < 3) {
        setGlobalResults([]);
        setGlobalSearchLoading(false);
        setGlobalSearchMessage(
          query.length > 0 ? "Type at least 3 characters." : ""
        );
        return;
      }

      const controller = new AbortController();

      const timer = setTimeout(async () => {
        try {
          setGlobalSearchLoading(true);
          setGlobalSearchMessage("");

          const url = new URL("https://nominatim.openstreetmap.org/search");
          url.searchParams.set("q", query);
          url.searchParams.set("format", "jsonv2");
          url.searchParams.set("limit", "6");
          url.searchParams.set("addressdetails", "1");

          const response = await fetch(url.toString(), {
            signal: controller.signal,
            headers: { Accept: "application/json" },
          });

          if (!response.ok) {
            throw new Error(`Search service returned ${response.status}`);
          }

          const results = await response.json();
          setGlobalResults(results);
          setGlobalResultsOpen(true);
          setGlobalSearchMessage(
            results.length ? "" : "No places found. Try another search."
          );
        } catch (error) {
          if (error.name !== "AbortError") {
            console.error("Global search error:", error);
            setGlobalSearchMessage(
              "Global search is temporarily unavailable. Please try again."
            );
            setGlobalResults([]);
          }
        } finally {
          if (!controller.signal.aborted) {
            setGlobalSearchLoading(false);
          }
        }
      }, 450);

      return () => {
        clearTimeout(timer);
        controller.abort();
      };
    }, [globalSearchText]);

    // Create map and load KML.
    useEffect(() => {
      if (!mapElement.current || !popupElement.current) return;

      const initialBasemap = BASEMAPS[0];

      const baseLayer = new TileLayer({
        source: new XYZ({
          url: initialBasemap.url,
          attributions: initialBasemap.attribution,
          maxZoom: MAX_ZOOM,
        }),
      });

      baseLayerRef.current = baseLayer;

      const globalMarkerSource = new VectorSource();
      globalMarkerSourceRef.current = globalMarkerSource;

      const globalMarkerLayer = new VectorLayer({
        source: globalMarkerSource,
        zIndex: 10000,
        style: new Style({
          image: new CircleStyle({
            radius: 9,
            fill: new Fill({ color: "#e53935" }),
            stroke: new Stroke({ color: "#ffffff", width: 3 }),
          }),
        }),
      });

      const compassElement = document.createElement("div");
      compassElement.className = "ol-unselectable ol-control";
      compassElement.setAttribute("aria-label", "Compass rose");
      compassElement.style.cssText = `
        position:absolute; top:12px; right:12px; left:auto;
        width:92px; height:92px; padding:0; margin:0;
        border:none; background:transparent; box-shadow:none;
        pointer-events:none;
      `;

      compassElement.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 100 100" width="92" height="92"
          role="img" aria-label="Compass rose">
          <g fill="none" stroke="#111" stroke-width="1.2" stroke-linejoin="miter">
            <polygon points="50,19 58,45 50,50 42,45" fill="#111"/>
            <polygon points="50,19 50,50 58,45" fill="#fff"/>
            <polygon points="81,50 55,58 50,50 55,42" fill="#111"/>
            <polygon points="81,50 50,50 55,58" fill="#fff"/>
            <polygon points="50,81 42,55 50,50 58,55" fill="#111"/>
            <polygon points="50,81 50,50 42,55" fill="#fff"/>
            <polygon points="19,50 45,42 50,50 45,58" fill="#111"/>
            <polygon points="19,50 50,50 45,42" fill="#fff"/>
            <circle cx="50" cy="50" r="2" fill="#111"/>
          </g>
          <g fill="#111" font-family="Arial,sans-serif" font-size="17" text-anchor="middle">
            <text x="50" y="13">N</text>
            <text x="94" y="56">E</text>
            <text x="50" y="99">S</text>
            <text x="6" y="56">W</text>
          </g>
        </svg>
      `;

      const map = new OLMap({
        target: mapElement.current,
        controls: undefined,
        layers: [baseLayer, globalMarkerLayer],
        view: new View({
          center: fromLonLat([72.9, 19.7]),
          zoom: 9,
          minZoom: 2,
          maxZoom: MAX_ZOOM,
          constrainResolution: false,
          smoothResolutionConstraint: true,
          smoothExtentConstraint: true,
        }),
      });

      map.addControl(new Control({ element: compassElement }));

      map.addControl(
        new ScaleLine({
          units: "metric",
          bar: true,
          steps: 4,
          text: true,
          minWidth: 120,
        })
      );

      mapRef.current = map;

      const popup = new Overlay({
        element: popupElement.current,
        positioning: "bottom-center",
        offset: [0, -15],
        stopEvent: true,
        autoPan: { animation: { duration: 250 } },
      });

      map.addOverlay(popup);

      function showFeatureDetails(feature, coordinate) {
        const popupBox = popupElement.current;
        if (!popupBox) return;

        popupBox.replaceChildren();
        const properties = feature.getProperties();

        const title = document.createElement("div");
        title.textContent =
          properties.name || properties.Name || "Facility details";
        title.style.fontWeight = "bold";
        title.style.fontSize = "15px";
        title.style.marginBottom = "9px";
        title.style.color = "#174a75";
        popupBox.appendChild(title);

        Object.entries(properties).forEach(([key, value]) => {
          const normalizedKey = key
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "");

          if (
            normalizedKey === "geometry" ||
            normalizedKey === "description" ||
            normalizedKey === "allkmlattributes" ||
            normalizedKey === "name" ||
            normalizedKey === "styleurl" ||
            normalizedKey === "facilitysymbol" ||
            value === null ||
            value === undefined ||
            typeof value === "object"
          ) {
            return;
          }

          const row = document.createElement("div");
          row.style.marginTop = "5px";
          row.style.overflowWrap = "anywhere";

          const label = document.createElement("strong");
          label.textContent = `${key}: `;

          const text = document.createElement("span");
          text.textContent = String(value);

          row.appendChild(label);
          row.appendChild(text);
          popupBox.appendChild(row);
        });

        const geometry = feature.getGeometry();

        if (geometry && geometry.getType() === "Point") {
          const coordinates = toLonLat(geometry.getCoordinates());
          const coordinateRow = document.createElement("div");

          coordinateRow.style.marginTop = "8px";
          coordinateRow.style.borderTop = "1px solid #ddd";
          coordinateRow.style.paddingTop = "7px";
          coordinateRow.textContent =
            `Longitude: ${coordinates[0].toFixed(7)}, ` +
            `Latitude: ${coordinates[1].toFixed(7)}`;

          popupBox.appendChild(coordinateRow);
        }

        popupBox.style.display = "block";
        popup.setPosition(coordinate);
      }

      map.on("singleclick", (event) => {
        let clickedFeature = null;

        map.forEachFeatureAtPixel(
          event.pixel,
          (feature) => {
            clickedFeature = feature;
            return true;
          },
          { hitTolerance: 6 }
        );

        if (!clickedFeature) {
          popup.setPosition(undefined);
          popupElement.current.style.display = "none";
          return;
        }

        showFeatureDetails(clickedFeature, event.coordinate);
      });

      async function loadKml() {
        try {
          const response = await fetch("/data/facilities.kml");

          if (!response.ok) {
            throw new Error(
              `Could not load KML file. HTTP status: ${response.status}`
            );
          }

          const kmlText = await response.text();

          const kmlFormat = new KML({
            extractStyles: true,
            showPointNames: false,
          });

          const features = kmlFormat.readFeatures(kmlText, {
            dataProjection: "EPSG:4326",
            featureProjection: "EPSG:3857",
          });

          if (features.length === 0) {
            setStatus("KML loaded, but no features were found.");
            return;
          }

          // Apply slightly bigger, zoom-responsive symbols to every facility.
          features.forEach((feature) => {
            const symbol = getFacilitySymbol(feature);

            feature.set("facilitySymbol", symbol, true);
            feature.setStyle(getFacilityStyleFunction(map, symbol));
          });

          const groups = new Map();

          features.forEach((feature) => {
            const taluka =
              getFeatureValue(feature, [
                "Panchayat Samiti / Taluka",
                "Panchayat Samiti Name",
                "Taluka Name",
                "Panchayat Samiti",
                "Taluka",
              ]) || "Taluka not specified";

            const category =
              getFeatureValue(feature, [
                "Department / Category",
                "Department Category",
                "Category",
              ]) || "Category not specified";

            if (!groups.has(taluka)) groups.set(taluka, new Map());

            const categoryGroups = groups.get(taluka);

            if (!categoryGroups.has(category)) {
              categoryGroups.set(category, []);
            }

            categoryGroups.get(category).push(feature);
          });

          const layerRegistry = {};
          const sourceRegistry = {};
          const tree = [];
          const extents = [];
          let idCounter = 1;

          groups.forEach((categoryGroups, taluka) => {
            const talukaNode = {
              id: `taluka-${idCounter++}`,
              name: taluka,
              children: [],
            };

            categoryGroups.forEach((categoryFeatures, category) => {
              const layerId = `layer-${idCounter++}`;

              const source = new VectorSource({
                features: categoryFeatures,
              });

              const layer = new VectorLayer({
                source,
                visible: true,

                // Prevent nearby symbols from drawing over each other.
                declutter: true,

                properties: {
                  title: `${taluka} - ${category}`,
                },
              });

              map.addLayer(layer);

              layerRegistry[layerId] = layer;
              sourceRegistry[layerId] = source;

              const extent = source.getExtent();

              if (extent && extent.every(Number.isFinite)) {
                extents.push(extent);
              }

              talukaNode.children.push({
                id: `node-${layerId}`,
                name: category,
                layerId,
                symbol: getFacilitySymbol(categoryFeatures[0]),
                children: [],
              });
            });

            tree.push(talukaNode);
          });

          layersRef.current = layerRegistry;
          sourcesRef.current = sourceRegistry;

          setLayerTree(tree);
          setFeatureCount(features.length);

          const initialVisibility = {};

          Object.keys(layerRegistry).forEach((id) => {
            initialVisibility[id] = true;
          });

          setVisibility(initialVisibility);

          if (extents.length > 0) {
            const combinedExtent = extents.reduce(
              (result, extent) => [
                Math.min(result[0], extent[0]),
                Math.min(result[1], extent[1]),
                Math.max(result[2], extent[2]),
                Math.max(result[3], extent[3]),
              ],
              [...extents[0]]
            );

            map.getView().fit(combinedExtent, {
              padding: [40, 40, 40, 40],
              maxZoom: MAX_ZOOM,
              duration: 500,
            });
          }

          setStatus("KML loaded successfully.");
        } catch (error) {
          console.error("KML loading error:", error);
          setStatus(`Error: ${error.message}`);
        }
      }

      loadKml();

      return () => {
        map.setTarget(undefined);
        mapRef.current = null;
        baseLayerRef.current = null;
        globalMarkerSourceRef.current = null;
        layersRef.current = {};
        sourcesRef.current = {};
      };
    }, []);

    const chooseBasemap = (basemap) => {
      if (!baseLayerRef.current) return;

      baseLayerRef.current.setSource(
        new XYZ({
          url: basemap.url,
          attributions: basemap.attribution,
          maxZoom: MAX_ZOOM,
        })
      );

      setSelectedBasemap(basemap.id);
      setGalleryOpen(false);
    };

    useEffect(() => {
      Object.entries(layersRef.current).forEach(([id, layer]) => {
        layer.setVisible(visibility[id] !== false);
      });
    }, [visibility]);

    const toggleLayers = (layerIds, checked) => {
      setVisibility((previous) => {
        const updated = { ...previous };

        layerIds.forEach((id) => {
          updated[id] = checked;
        });

        return updated;
      });
    };

    const renameLayerNode = (nodeId, newName) => {
      const updateNodes = (nodes) =>
        nodes.map((node) => {
          if (node.id === nodeId) {
            return { ...node, name: newName };
          }

          if (node.children?.length) {
            return { ...node, children: updateNodes(node.children) };
          }

          return node;
        });

      setLayerTree((previous) => updateNodes(previous));
    };

    const selectGlobalResult = (result) => {
      const longitude = Number(result.lon);
      const latitude = Number(result.lat);

      if (
        !Number.isFinite(longitude) ||
        !Number.isFinite(latitude) ||
        !mapRef.current ||
        !globalMarkerSourceRef.current
      ) {
        setGlobalSearchMessage("This result does not have valid coordinates.");
        return;
      }

      const coordinate = fromLonLat([longitude, latitude]);

      globalMarkerSourceRef.current.clear();

      globalMarkerSourceRef.current.addFeature(
        new Feature({ geometry: new Point(coordinate) })
      );

      mapRef.current.getView().animate({
        center: coordinate,
        zoom: Math.min(15, MAX_ZOOM),
        duration: 800,
      });

      setGlobalSearchText(result.display_name);
      setGlobalResultsOpen(false);
      setGlobalSearchMessage("Location found. Red marker shows the place.");
    };

    const clearGlobalSearch = () => {
      setGlobalSearchText("");
      setGlobalResults([]);
      setGlobalSearchMessage("");
      setGlobalResultsOpen(false);
      globalMarkerSourceRef.current?.clear();
    };

    const allLayerIds = Object.keys(layersRef.current);

    const visibleLayerCount = allLayerIds.filter(
      (id) => visibility[id] !== false
    ).length;

    const allChecked =
      allLayerIds.length > 0 &&
      visibleLayerCount === allLayerIds.length;

    const allPartiallyChecked =
      visibleLayerCount > 0 &&
      visibleLayerCount < allLayerIds.length;

    return (
      <div
        style={{
          width: "100%",
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          fontFamily: "Arial, sans-serif",
          overflow: "hidden",
        }}
      >
        <header
          style={{
            height: 60,
            minHeight: 60,
            background: "#174a75",
            color: "white",
            display: "flex",
            alignItems: "center",
            padding: "0 20px",
            fontSize: 20,
            fontWeight: "bold",
          }}
        >
          Palghar Map Portal
        </header>

        <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
          <aside
            style={{
              width: 340,
              minWidth: 280,
              background: "#fff",
              borderRight: "1px solid #ccc",
              padding: 14,
              boxSizing: "border-box",
              overflowY: "auto",
            }}
          >
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 0",
                borderBottom: "1px solid #ddd",
                cursor: "pointer",
                fontWeight: "bold",
                fontSize: 14,
              }}
            >
              <input
                type="checkbox"
                checked={allChecked}
                ref={(element) => {
                  if (element) {
                    element.indeterminate = allPartiallyChecked;
                  }
                }}
                onChange={(event) =>
                  toggleLayers(allLayerIds, event.target.checked)
                }
              />
              All Layers
            </label>

            <div style={{ paddingTop: 8 }}>
              {layerTree.length > 0 ? (
                <LayerTree
                  nodes={layerTree}
                  visibility={visibility}
                  onToggle={toggleLayers}
                  onRename={renameLayerNode}
                />
              ) : (
                <p style={{ fontSize: 13, color: "#666" }}>{status}</p>
              )}
            </div>

            <div
              style={{
                marginTop: 14,
                padding: 10,
                background: "#f3f6f8",
                borderRadius: 5,
                fontSize: 12,
                lineHeight: 1.6,
              }}
            >
              <div>
                <strong>Features loaded:</strong> {featureCount}
              </div>

              <div>
                <strong>Status:</strong> {status}
              </div>

              <div>
                <strong>Maximum zoom:</strong> {MAX_ZOOM}
              </div>
            </div>
          </aside>

          <main
            style={{
              flex: 1,
              minWidth: 0,
              minHeight: 0,
              position: "relative",
              overflow: "hidden",
              background: "#e8e8e8",
            }}
          >
            <div
              ref={mapElement}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
              }}
            />

            {/* GLOBAL PLACE SEARCH */}
            <div
              style={{
                position: "absolute",
                zIndex: 3000,
                top: 12,
                left: 12,
                width: 390,
                maxWidth: "calc(100% - 125px)",
                fontFamily: "Arial, sans-serif",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  background: "white",
                  border: "1px solid #999",
                  borderRadius: 6,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
                  overflow: "hidden",
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    paddingLeft: 12,
                    color: "#174a75",
                    fontSize: 19,
                  }}
                >
                  ⌕
                </span>

                <input
                  type="text"
                  value={globalSearchText}
                  onFocus={() => {
                    if (globalResults.length > 0) {
                      setGlobalResultsOpen(true);
                    }
                  }}
                  onChange={(event) => {
                    setGlobalSearchText(event.target.value);
                    setGlobalResultsOpen(true);
                  }}
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter" &&
                      globalResults.length > 0
                    ) {
                      selectGlobalResult(globalResults[0]);
                    }

                    if (event.key === "Escape") {
                      setGlobalResultsOpen(false);
                    }
                  }}
                  placeholder="Search anywhere in the world..."
                  aria-label="Search anywhere in the world"
                  style={{
                    flex: 1,
                    minWidth: 0,
                    border: "none",
                    outline: "none",
                    padding: "12px 9px",
                    fontSize: 14,
                    color: "#222",
                  }}
                />

                {globalSearchText && (
                  <button
                    onClick={clearGlobalSearch}
                    title="Clear global search"
                    aria-label="Clear global search"
                    style={{
                      border: "none",
                      background: "white",
                      color: "#666",
                      padding: "8px 12px",
                      fontSize: 19,
                      cursor: "pointer",
                    }}
                  >
                    ×
                  </button>
                )}
              </div>

              {globalResultsOpen &&
                (globalSearchLoading ||
                  globalResults.length > 0 ||
                  globalSearchMessage) && (
                  <div
                    style={{
                      marginTop: 5,
                      background: "white",
                      border: "1px solid #bbb",
                      borderRadius: 6,
                      boxShadow: "0 3px 12px rgba(0,0,0,0.25)",
                      overflow: "hidden",
                      maxHeight: 320,
                      overflowY: "auto",
                    }}
                  >
                    {globalSearchLoading && (
                      <div
                        style={{
                          padding: 12,
                          fontSize: 13,
                          color: "#555",
                        }}
                      >
                        Searching worldwide...
                      </div>
                    )}

                    {!globalSearchLoading &&
                      globalResults.map((result) => (
                        <button
                          key={result.place_id}
                          onClick={() => selectGlobalResult(result)}
                          style={{
                            display: "block",
                            width: "100%",
                            padding: "10px 12px",
                            textAlign: "left",
                            background: "white",
                            border: "none",
                            borderBottom: "1px solid #eee",
                            cursor: "pointer",
                            color: "#222",
                          }}
                          onMouseEnter={(event) => {
                            event.currentTarget.style.background = "#eef5fa";
                          }}
                          onMouseLeave={(event) => {
                            event.currentTarget.style.background = "white";
                          }}
                        >
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: "bold",
                              lineHeight: 1.35,
                            }}
                          >
                            {result.name || result.display_name}
                          </div>

                          <div
                            style={{
                              fontSize: 11,
                              color: "#666",
                              marginTop: 3,
                              lineHeight: 1.35,
                            }}
                          >
                            {result.display_name}
                          </div>
                        </button>
                      ))}

                    {!globalSearchLoading && globalSearchMessage && (
                      <div
                        style={{
                          padding: 10,
                          color: "#555",
                          fontSize: 12,
                        }}
                      >
                        {globalSearchMessage}
                      </div>
                    )}
                  </div>
                )}

              <div
                style={{
                  fontSize: 10,
                  color: "#444",
                  background: "rgba(255,255,255,0.9)",
                  display: "inline-block",
                  padding: "3px 6px",
                  marginTop: 4,
                  borderRadius: 3,
                }}
              >
                Global place search · © OpenStreetMap contributors
              </div>
            </div>

            {/* MAP POPUP */}
            <div
              ref={popupElement}
              style={{
                display: "none",
                background: "white",
                padding: 12,
                border: "1px solid #777",
                borderRadius: 6,
                minWidth: 200,
                maxWidth: 300,
                maxHeight: 220,
                overflowY: "auto",
                boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                fontSize: 12,
                color: "#222",
              }}
            />

            {/* BASEMAP BUTTON */}
            <button
              onClick={() => setGalleryOpen((previous) => !previous)}
              title="Basemap Gallery"
              aria-label="Basemap Gallery"
              aria-expanded={galleryOpen}
              style={{
                position: "absolute",
                zIndex: 2000,
                top: 116,
                right: 12,
                width: 46,
                height: 46,
                border: "1px solid #777",
                borderRadius: 5,
                background: "white",
                color: "#174a75",
                cursor: "pointer",
                boxShadow: "0 1px 5px rgba(0,0,0,0.25)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg
                width="27"
                height="27"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="3" width="8" height="8" rx="1" />
                <rect x="13" y="3" width="8" height="8" rx="1" />
                <rect x="3" y="13" width="8" height="8" rx="1" />
                <rect x="13" y="13" width="8" height="8" rx="1" />
              </svg>
            </button>

            {/* BASEMAP GALLERY */}
            {galleryOpen && (
              <div
                style={{
                  position: "absolute",
                  zIndex: 2001,
                  top: 170,
                  right: 12,
                  width: 300,
                  maxWidth: "calc(100% - 24px)",
                  maxHeight: "calc(100% - 185px)",
                  overflowY: "auto",
                  background: "white",
                  border: "1px solid #aaa",
                  borderRadius: 7,
                  boxShadow: "0 3px 14px rgba(0,0,0,0.3)",
                  padding: 12,
                  boxSizing: "border-box",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 10,
                    paddingBottom: 9,
                    borderBottom: "1px solid #ddd",
                  }}
                >
                  <strong style={{ color: "#174a75", fontSize: 15 }}>
                    BASEMAP GALLERY
                  </strong>

                  <button
                    onClick={() => setGalleryOpen(false)}
                    aria-label="Close Basemap Gallery"
                    title="Close"
                    style={{
                      border: "none",
                      background: "transparent",
                      color: "#555",
                      fontSize: 23,
                      lineHeight: 1,
                      cursor: "pointer",
                      padding: "0 3px",
                    }}
                  >
                    ×
                  </button>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 9,
                  }}
                >
                  {BASEMAPS.map((basemap) => {
                    const selected = selectedBasemap === basemap.id;

                    return (
                      <button
                        key={basemap.id}
                        onClick={() => chooseBasemap(basemap)}
                        title={basemap.description}
                        style={{
                          padding: 0,
                          overflow: "hidden",
                          textAlign: "left",
                          cursor: "pointer",
                          border: selected
                            ? "3px solid #174a75"
                            : "1px solid #bbb",
                          borderRadius: 6,
                          background: "white",
                        }}
                      >
                        <div
                          style={{
                            height: 70,
                            backgroundImage: `url("${basemap.preview}")`,
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                            backgroundColor: "#e2e8ed",
                            position: "relative",
                          }}
                        >
                          {selected && (
                            <span
                              style={{
                                position: "absolute",
                                top: 4,
                                right: 4,
                                background: "#174a75",
                                color: "white",
                                borderRadius: 3,
                                padding: "2px 5px",
                                fontSize: 9,
                                fontWeight: "bold",
                              }}
                            >
                              ACTIVE
                            </span>
                          )}
                        </div>

                        <div style={{ padding: "6px 7px 8px" }}>
                          <div
                            style={{
                              fontSize: 12,
                              fontWeight: "bold",
                              color: "#222",
                              lineHeight: 1.3,
                            }}
                          >
                            {basemap.name}
                          </div>

                          <div
                            style={{
                              fontSize: 10,
                              color: "#666",
                              lineHeight: 1.3,
                              marginTop: 3,
                            }}
                          >
                            {basemap.description}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* MAP LEGEND - BOTTOM RIGHT */}
            <div
              style={{
                position: "absolute",
                zIndex: 1500,
                right: 12,
                bottom: 28,
                width: 220,
                maxWidth: "calc(100% - 24px)",
                maxHeight: "45%",
                overflowY: "auto",
                background: "rgba(255,255,255,0.96)",
                border: "1px solid #999",
                borderRadius: 7,
                boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
                padding: 12,
                boxSizing: "border-box",
                fontFamily: "Arial, sans-serif",
              }}
            >
              <div
                style={{
                  fontSize: 14,
                  fontWeight: "bold",
                  color: "#174a75",
                  borderBottom: "1px solid #ddd",
                  paddingBottom: 7,
                  marginBottom: 7,
                }}
              >
                LEGEND
              </div>

              {[
                ["🏛️", "Gram Panchayat"],
                ["🏢", "Panchayat Samiti"],
                ["🏫", "Education / School"],
                ["🏥", "Health Department (PHC)"],
                ["🩺", "Health Sub-Centre"],
                ["🏡", "WCD / Anganwadi"],
                ["🐄", "Animal Husbandry"],
              ].map(([symbol, label]) => (
                <div
                  key={label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 9,
                    padding: "4px 0",
                    fontSize: 12,
                    color: "#222",
                  }}
                >
                  <span
                    style={{
                      width: 25,
                      textAlign: "center",
                      fontSize: 18,
                      flexShrink: 0,
                    }}
                  >
                    {symbol}
                  </span>

                  <span>{label}</span>
                </div>
              ))}
            </div>
          </main>
        </div>
      </div>
    );
  }