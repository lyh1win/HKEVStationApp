import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  IconButton,
  Menu,
  RadioGroup,
  FormControlLabel,
  Radio,
  Checkbox,
  Typography,
  Divider,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const TILE_SOURCES = {
  topo: {
    url: 'https://mapapi.geodata.gov.hk/gs/api/v1.0.0/xyz/basemap/WGS84/{z}/{x}/{y}.png',
    minzoom: 10,
    maxzoom: 20,
  },
  imagery: {
    url: 'https://mapapi.geodata.gov.hk/gs/api/v1.0.0/xyz/imagery/WGS84/{z}/{x}/{y}.png',
    minzoom: 0,
    maxzoom: 20,
  },
};

const DEFAULT_CENTER = [114.1694, 22.3193];
const DEFAULT_ZOOM = 12;
const EV_API_URL = '/api/evcharger/list';

const LANGS = [
  { code: 'en', label: 'English' },
  { code: 'zh', label: '繁體中文' },
];

function MapView() {
  const { t, i18n } = useTranslation();
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const showEVRef = useRef(true);
  const popupI18nRef = useRef(i18n.language);

  const [menuAnchor, setMenuAnchor] = useState(null);
  const [mapStyle, setMapStyle] = useState('topo');
  const [showEV, setShowEV] = useState(true);
  const [locationReady, setLocationReady] = useState(false);

  popupI18nRef.current = i18n.language;

  const toggleEVLayer = useCallback((visible) => {
    const map = mapRef.current;
    if (!map) return;
    showEVRef.current = visible;
    setShowEV(visible);
    const layer = map.getLayer('ev-charger-circles');
    if (layer) {
      map.setLayoutProperty('ev-charger-circles', 'visibility', visible ? 'visible' : 'none');
    }
  }, []);

  const switchLanguage = (lng) => {
    i18n.changeLanguage(lng);
  };

  useEffect(() => {
    if (!mapContainerRef.current) return;

    const sourceId = 'landsd-tiles';

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        name: 'HK LandsD Map',
        sources: {
          [sourceId]: {
            type: 'raster',
            tiles: [TILE_SOURCES.topo.url],
            tileSize: 256,
            minzoom: TILE_SOURCES.topo.minzoom,
            maxzoom: TILE_SOURCES.topo.maxzoom,
            attribution: t('attribution.landsd'),
          },
        },
        layers: [
          {
            id: 'raster-layer',
            type: 'raster',
            source: sourceId,
            paint: {
              'raster-opacity': 1,
            },
          },
        ],
      },
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      maxPitch: 0,
      interactive: true,
      attributionControl: false,
    });

    mapRef.current = map;

    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      'bottom-right',
    );

    const landsdAttribution = new (class {
      onAdd() {
        const el = document.createElement('div');
        el.style.cssText =
          'background:#fff;padding:4px 10px;border-radius:4px;' +
          'box-shadow:0 0 2px rgba(0,0,0,.2);' +
          'font-size:11px;color:#555;font-family:Roboto,sans-serif;' +
          'white-space:nowrap;';
        const updateText = () => {
          el.innerHTML =
            '<span style="font-weight:600;">' +
            i18n.t('attribution.landsd') +
            '</span>';
        };
        updateText();
        i18n.on('languageChanged', updateText);
        return el;
      }
      onRemove() {
        i18n.off('languageChanged');
      }
    })();
    map.addControl(landsdAttribution, 'bottom-left');

    const geolocate = new maplibregl.GeolocateControl({
      positionOptions: {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000,
      },
      trackUserLocation: true,
      showUserLocation: true,
      showUserHeading: true,
    });
    map.addControl(geolocate, 'bottom-right');

    geolocate.on('geolocate', (e) => {
      if (e.coords && !locationReady) {
        const { longitude, latitude } = e.coords;
        map.flyTo({
          center: [longitude, latitude],
          zoom: Math.max(map.getZoom(), 14),
          essential: true,
          duration: 1500,
        });
        setLocationReady(true);
      }
    });

    geolocate.on('error', (e) => {
      console.warn('Geolocation error:', e.message);
    });

    map.on('load', async () => {
      try {
        const res = await fetch(EV_API_URL);
        const json = await res.json();
        if (json.code === 200 && json.data && json.data.geoLocationResult) {
          addEVChargers(map, json.data.geoLocationResult, i18n);
          if (!showEVRef.current) {
            map.setLayoutProperty('ev-charger-circles', 'visibility', 'none');
          }
        }
      } catch (err) {
        console.error('Failed to fetch EV charger data:', err);
      }
    });

    return () => {
      map.remove();
    };
  }, []);

  const handleStyleChange = (e) => {
    const newStyle = e.target.value;
    setMapStyle(newStyle);
    const map = mapRef.current;
    if (!map) return;
    const source = map.getSource('landsd-tiles');
    if (!source) return;
    const config = TILE_SOURCES[newStyle];
    source.setTiles([config.url]);
  };

  const handleEVChange = () => {
    toggleEVLayer(!showEV);
  };

  return (
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        height: 'calc(100vh - 56px)',
      }}
    >
      <div
        ref={mapContainerRef}
        style={{ width: '100%', height: '100%' }}
      />

      <Box
        sx={{
          position: 'absolute',
          top: 8,
          left: 8,
          zIndex: 10,
        }}
      >
        <IconButton
          onClick={(e) => setMenuAnchor(e.currentTarget)}
          sx={{
            background: '#fff',
            borderRadius: 1,
            boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
            '&:hover': { background: '#f5f5f5' },
          }}
        >
          <MenuIcon />
        </IconButton>

        <Menu
          anchorEl={menuAnchor}
          open={Boolean(menuAnchor)}
          onClose={() => setMenuAnchor(null)}
          PaperProps={{
            sx: { minWidth: 220 },
          }}
        >
          <Typography
            variant="subtitle2"
            sx={{ px: 2, py: 1, fontWeight: 600, color: 'text.secondary' }}
          >
            {t('menu.mapStyle')}
          </Typography>
          <RadioGroup
            value={mapStyle}
            onChange={handleStyleChange}
            sx={{ px: 1 }}
          >
            <FormControlLabel
              value="topo"
              control={<Radio size="small" />}
              label={<Typography variant="body2">{t('menu.topographic')}</Typography>}
            />
            <FormControlLabel
              value="imagery"
              control={<Radio size="small" />}
              label={<Typography variant="body2">{t('menu.imagery')}</Typography>}
            />
          </RadioGroup>

          <Divider sx={{ my: 0.5 }} />

          <FormControlLabel
            control={
              <Checkbox
                checked={showEV}
                onChange={handleEVChange}
                size="small"
              />
            }
            label={<Typography variant="body2">{t('menu.evChargers')}</Typography>}
            sx={{ mx: 2 }}
          />

          <Divider sx={{ my: 0.5 }} />

          <Typography
            variant="subtitle2"
            sx={{ px: 2, py: 0.5, fontWeight: 600, color: 'text.secondary' }}
          >
            {t('menu.language')}
          </Typography>
          <RadioGroup
            value={i18n.language}
            onChange={(e) => switchLanguage(e.target.value)}
            sx={{ px: 1 }}
          >
            {LANGS.map((lng) => (
              <FormControlLabel
                key={lng.code}
                value={lng.code}
                control={<Radio size="small" />}
                label={<Typography variant="body2">{lng.label}</Typography>}
              />
            ))}
          </RadioGroup>
        </Menu>
      </Box>
    </Box>
  );
}

function addEVChargers(map, stations, i18nInstance) {
  const features = stations.map((station) => ({
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [station.longitude, station.latitude],
    },
    properties: {
      title: station.title,
      address: station.detailedAddress,
      totalChargers: station.totalNumberOfCharger,
      availableChargers: station.totalNumberOfAvailableCharger,
      quickChargers: station.totalNumberOfQuickCharger,
      semiQuickChargers: station.totalNumberOfSemiQuickCharger,
      hasAvailable: station.totalNumberOfAvailableCharger > 0,
    },
  }));

  map.addSource('ev-chargers', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features },
  });

  map.addLayer({
    id: 'ev-charger-circles',
    type: 'circle',
    source: 'ev-chargers',
    paint: {
      'circle-radius': 8,
      'circle-color': [
        'case',
        ['boolean', ['get', 'hasAvailable'], false],
        '#22c55e',
        '#9ca3af',
      ],
      'circle-stroke-width': 2,
      'circle-stroke-color': '#ffffff',
    },
  });

  map.on('click', 'ev-charger-circles', (e) => {
    const props = e.features[0].properties;
    const labels = {
      total: i18nInstance.t('popup.total'),
      available: i18nInstance.t('popup.available'),
      quick: i18nInstance.t('popup.quick'),
      semiQuick: i18nInstance.t('popup.semiQuick'),
    };

    const el = document.createElement('div');
    el.style.cssText =
      'font-family:Roboto,sans-serif;font-size:13px;line-height:1.5;max-width:240px;';
    el.innerHTML = `
      <div style="font-weight:700;font-size:14px;margin-bottom:4px;">
        ${props.title}
      </div>
      <div style="color:#555;margin-bottom:6px;">${props.address}</div>
      <div style="display:flex;gap:4px;flex-wrap:wrap;">
        <span style="background:#e0f2fe;color:#0369a1;padding:2px 8px;border-radius:12px;font-size:12px;">
          ${labels.total}: ${props.totalChargers}
        </span>
        <span style="background:${props.hasAvailable ? '#dcfce7' : '#f3f4f6'};color:${props.hasAvailable ? '#15803d' : '#6b7280'};padding:2px 8px;border-radius:12px;font-size:12px;">
          ${labels.available}: ${props.availableChargers}
        </span>
        <span style="background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:12px;font-size:12px;">
          ${labels.quick}: ${props.quickChargers}
        </span>
        <span style="background:#f3e8ff;color:#7e22ce;padding:2px 8px;border-radius:12px;font-size:12px;">
          ${labels.semiQuick}: ${props.semiQuickChargers}
        </span>
      </div>
    `;

    new maplibregl.Popup({ maxWidth: 300, offset: 10 })
      .setLngLat(e.lngLat)
      .setDOMContent(el)
      .addTo(map);
  });

  map.on('mouseenter', 'ev-charger-circles', () => {
    map.getCanvas().style.cursor = 'pointer';
  });
  map.on('mouseleave', 'ev-charger-circles', () => {
    map.getCanvas().style.cursor = '';
  });
}

export default MapView;
