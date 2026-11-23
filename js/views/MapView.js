import { ref, computed, watch, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter, useRoute } from 'vue-router';
import {
  gardens, editor, addElement, updateElementGeometry, updateElement, deleteElement, restoreElement, undo, redo, setLocation, setClimate,
} from '../stores/gardens.js';
import { settings } from '../stores/settings.js';
import { network } from '../stores/network.js';
import { period } from '../stores/period.js';
import { showToast, showError } from '../stores/toast.js';
import { ELEMENT_TYPES, createElement, createElementAt, elementsBounds } from '../logic/elements.js';
import { metresPerDegree } from '../logic/geometry.js';
import { formatLength } from '../logic/units.js';
import { useMapKeys } from '../composables/useMapKeys.js';
import AppIcon from '../components/AppIcon.js';
import EmptyState from '../components/EmptyState.js';
import PeriodBar from '../components/PeriodBar.js';
import GardenMap from '../components/map/GardenMap.js';
import ToolPalette, { ELEMENT_TOOLS, MORE_ELEMENT_TOOLS } from '../components/map/ToolPalette.js';
import ElementPanel from '../components/map/ElementPanel.js';
import ElementList from '../components/map/ElementList.js';
import AddElementDialog from '../components/map/AddElementDialog.js';
import LocationBar from '../components/map/LocationBar.js';
import SetupPanel from '../components/map/SetupPanel.js';
import ShownPlants from '../components/map/ShownPlants.js';
import BedGanttDialog from '../components/gantt/BedGanttDialog.js';
import { elementName } from '../components/map/elementText.js';

/** Where to start looking for the garden, by UI language */
const START_VIEWS = {
  de: [51.1, 10.4, 6],
  fr: [46.6, 2.4, 6],
  es: [40.3, -3.7, 6],
  pt: [39.6, -8.0, 7],
  en: [51.5, -0.1, 6],
};

const NUMBERED_TYPES = ['bed', 'greenhouse'];

export default {
  name: 'MapView',
  components: { AppIcon, EmptyState, PeriodBar, GardenMap, ToolPalette, ElementPanel, ElementList, AddElementDialog, LocationBar, SetupPanel, ShownPlants, BedGanttDialog },
  setup() {
    const { t, locale } = useI18n();
    const router = useRouter();
    const route = useRoute();
    const mapRef = ref(null);
    const garden = computed(() => gardens.active);

    const tool = ref(null);
    const shapeChoice = ref({});
    const selectedId = ref(null);
    const editMode = ref('shape');
    const snapping = ref(true);
    const chosenBackground = ref('street');
    const locating = ref(false);
    const measured = ref(null);
    const addOpen = ref(false);
    const addType = ref(null);
    const ganttOpen = ref(false);
    const mapReady = ref(false);
    let startViewPending = false;
    const panelCollapsed = ref(false);

    const hasLocation = computed(() => Boolean(garden.value?.location));
    const background = computed(() => {
      if (!network.online) return 'plan';
      if (locating.value) return 'street';
      return hasLocation.value ? chosenBackground.value : 'plan';
    });
    const selected = computed(() => garden.value?.elements.find((element) => element.id === selectedId.value) ?? null);
    const hasParcel = computed(() => garden.value?.elements.some((element) => element.type === 'parcel') ?? false);
    const firstBed = computed(() => garden.value?.elements.find((element) => element.type === 'bed') ?? null);
    const hasPlantings = computed(() => (garden.value?.plantings.length ?? 0) > 0);
    const activeToolName = computed(() => (tool.value ? tool.value.type ?? 'measure' : null));
    const drawHint = computed(() => (tool.value ? t(`map.draw.${tool.value.draw}`) : ''));
    const canFinish = computed(() => ['polygon', 'line', 'measure'].includes(tool.value?.draw));
    const measuredText = computed(() => (measured.value === null ? '' : t('map.draw.measured', { length: formatLength(measured.value, settings.units, locale.value) })));

    watch(() => garden.value?.id, () => {
      tool.value = null;
      selectedId.value = null;
      locating.value = false;
      if (setup.value && garden.value) goStep(firstStep());
    });
    watch(selected, (element) => {
      if (!element) selectedId.value = null;
    });
    watch(selectedId, () => {
      ganttOpen.value = false;
    });

    // --- Tools ----------------------------------------------------------------

    function toolFor(type) {
      if (type === 'measure') return { type: null, draw: 'measure' };
      const config = ELEMENT_TYPES[type];
      if (config.kind === 'circle') return { type, draw: 'point' };
      if (config.kind === 'line') return { type, draw: 'line' };
      return { type, draw: shapeChoice.value[type] ?? config.draw };
    }

    function pick(type) {
      measured.value = null;
      if (type === null) {
        tool.value = null;
        return;
      }
      if (type === 'parcel' && hasParcel.value) {
        tool.value = null;
        selectedId.value = garden.value.elements.find((element) => element.type === 'parcel').id;
        showToast('map.parcelExists');
        return;
      }
      selectedId.value = null;
      tool.value = toolFor(type);
    }

    function setShape(draw) {
      if (!tool.value?.type) return;
      shapeChoice.value = { ...shapeChoice.value, [tool.value.type]: draw };
      tool.value = { ...tool.value, draw };
    }

    function newName(type) {
      if (!NUMBERED_TYPES.includes(type)) return '';
      const count = garden.value.elements.filter((element) => element.type === type).length;
      return `${t(`elements.types.${type}`)} ${count + 1}`;
    }

    function onCreate({ type, geometry }) {
      const element = createElement({ type, geometry, name: newName(type) });
      addElement(element);
      editMode.value = 'shape';
      selectedId.value = element.id;
      panelCollapsed.value = false;
      if (tool.value?.draw === 'point') tool.value = null;
    }

    function onDrawEnd() {
      if (tool.value && tool.value.draw !== 'measure') tool.value = null;
    }

    function onSelect(id) {
      if (id !== selectedId.value) editMode.value = 'shape';
      selectedId.value = id;
      if (id) panelCollapsed.value = false;
    }

    function addBySize({ type, width, depth, diameter }) {
      const center = mapRef.value?.centerPoint() ?? [0, 0];
      const element = createElementAt(type, center, { width, depth, diameter, name: newName(type) });
      addElement(element);
      selectedId.value = element.id;
    }

    function openAddDialog(type = null) {
      addType.value = type;
      addOpen.value = true;
    }

    function remove() {
      const element = selected.value;
      if (!element) return false;
      const removed = deleteElement(element.id);
      selectedId.value = null;
      const count = removed?.plantings.length ?? 0;
      showToast(count ? 'map.deletedWithPlantings' : 'map.deleted', {
        params: { name: elementName(element, t), count },
        action: removed ? { key: 'common.undo', handler: () => restoreElement(removed) } : null,
      });
      return true;
    }

    // --- Location -------------------------------------------------------------

    function startLocating() {
      tool.value = null;
      selectedId.value = null;
      locating.value = true;
      panelCollapsed.value = false;
      if (!hasLocation.value) {
        // The map may still be loading (setup opened directly): then wait for 'ready'
        if (mapReady.value) setTimeout(flyToStart, 0);
        else startViewPending = true;
      }
    }

    function flyToStart() {
      const [lat, lng, zoom] = START_VIEWS[locale.value] ?? START_VIEWS.en;
      mapRef.value?.flyTo(lat, lng, zoom);
    }

    function onMapReady() {
      mapReady.value = true;
      if (startViewPending && locating.value && !hasLocation.value) flyToStart();
      startViewPending = false;
    }

    function confirmLocation() {
      const center = mapRef.value?.centerLatLng();
      if (!center) return;
      if ((mapRef.value?.zoom() ?? 0) < 15) {
        showError('map.location.zoomIn');
        return;
      }
      // Keep the drawing centred on the cross
      const box = elementsBounds(garden.value.elements);
      const middle = box ? [(box.minX + box.maxX) / 2, (box.minY + box.maxY) / 2] : [0, 0];
      const scale = metresPerDegree(center.lat);
      setLocation({ lat: center.lat - middle[1] / scale.lat, lng: center.lng - middle[0] / scale.lng });
      locating.value = false;
      chosenBackground.value = 'street';
      showToast('map.location.saved');
      if (setup.value) {
        // Gardens south of the equator get the southern seasons right away
        const hemisphere = center.lat < 0 ? 'south' : 'north';
        if (garden.value.climate.hemisphere !== hemisphere) setClimate({ ...garden.value.climate, hemisphere });
        goStep('boundary');
      }
    }

    function cancelLocating() {
      locating.value = false;
      setTimeout(() => mapRef.value?.fitGarden(), 0);
      if (setup.value && step.value === 'place') goStep('boundary');
    }

    function removeLocation() {
      setLocation(null);
      locating.value = false;
      if (setup.value) goStep('boundary');
    }

    // --- Guided setup (?setup=1) ----------------------------------------------
    // Progress is not stored: the first step follows from what the garden already has.

    const setup = computed(() => route.query.setup === '1');
    const step = ref('place');

    function firstStep() {
      if (!hasLocation.value && network.online) return 'place';
      if (!hasParcel.value) return 'boundary';
      return 'structures';
    }

    function goStep(name) {
      tool.value = null;
      measured.value = null;
      if (step.value === 'place' && locating.value && name !== 'place') {
        locating.value = false;
        setTimeout(() => mapRef.value?.fitGarden(), 0);
      }
      step.value = name;
      panelCollapsed.value = false;
      if (name === 'place') {
        if (network.online) startLocating();
        else locating.value = false;
      }
    }

    // Without a connection there is no street map to place the garden on
    watch(() => network.online, () => {
      if (setup.value && step.value === 'place') goStep('place');
    });

    watch(setup, (on) => {
      if (on && garden.value) goStep(firstStep());
      else if (!on) locating.value = false;
    }, { immediate: true });

    function startSetup() {
      router.push({ path: '/map', query: { setup: '1' } });
    }

    function leaveSetup(done) {
      tool.value = null;
      locating.value = false;
      router.replace('/map');
      const bed = firstBed.value;
      if (done && bed) showToast('setup.doneBeds', { action: { key: 'setup.plantFirstBed', handler: () => openBed(bed.id) } });
      else if (done) showToast('setup.done');
      nextTick(() => mapRef.value?.fitGarden());
    }

    function drawFromSetup({ type, draw }) {
      selectedId.value = null;
      pick(type);
      if (draw && tool.value) setShape(draw);
    }

    function redrawParcel() {
      const parcel = garden.value.elements.find((element) => element.type === 'parcel');
      if (!parcel) return;
      selectedId.value = parcel.id;
      remove();
      pick('parcel');
    }

    function openBed(id) {
      router.push(`/map/bed/${id}`);
    }

    // --- Keyboard -------------------------------------------------------------

    useMapKeys({
      onEscape: () => {
        if (tool.value) tool.value = null;
        else if (locating.value) cancelLocating();
        else selectedId.value = null;
      },
      onEnter: () => {
        if (canFinish.value) mapRef.value?.finishDraw();
      },
      onDelete: () => (tool.value ? false : remove()),
    });

    return {
      t, network, mapRef, garden, settings, editor, period, tool, selectedId, selected, editMode, snapping, background, chosenBackground,
      locating, hasLocation, hasParcel, activeToolName, drawHint, canFinish, measured, measuredText, addOpen, panelCollapsed,
      pick, setShape, onCreate, onDrawEnd, onSelect, addBySize, remove, startLocating, confirmLocation, cancelLocating,
      removeLocation, undo, redo, ELEMENT_TOOLS, MORE_ELEMENT_TOOLS,
      onMapReady, setup, step, goStep, startSetup, leaveSetup, drawFromSetup, redrawParcel, openAddDialog, addType,
      openBed, firstBed, hasPlantings, ganttOpen,
      changeGeometry: (geometry) => updateElementGeometry(selectedId.value, geometry),
      onChange: ({ id, geometry }) => updateElementGeometry(id, geometry),
      onUpdate: (fields) => updateElement(selectedId.value, fields),
      onInvalid: () => showError('map.errors.invalidShape'),
      onMeasure: (length) => {
        measured.value = length;
      },
      isPolygonTool: () => tool.value?.type && ELEMENT_TYPES[tool.value.type].kind === 'polygon',
    };
  },
  template: `
    <div v-if="garden" class="map-view">
      <div class="map-stage">
        <GardenMap
          ref="mapRef"
          :garden="garden"
          :background="background"
          :tool="tool"
          :selected-id="selectedId"
          :edit-mode="editMode"
          :snapping="snapping"
          :units="settings.units"
          :locating="locating"
          :period="period"
          @create="onCreate"
          @change="onChange"
          @select="onSelect"
          @draw-end="onDrawEnd"
          @invalid="onInvalid"
          @measure="onMeasure"
          @ready="onMapReady"
        />

        <ToolPalette v-if="!locating" :items="ELEMENT_TOOLS" :more="MORE_ELEMENT_TOOLS" :active="activeToolName" :snapping="snapping" @pick="pick" @toggle-snapping="snapping = !snapping" />

        <div class="map-topbar" v-if="!locating">
          <div class="segmented" role="group" :aria-label="t('map.background.label')" v-if="hasLocation">
            <button type="button" :aria-pressed="background === 'street' ? 'true' : 'false'" :disabled="!network.online" :title="network.online ? null : t('map.background.offline')" @click="chosenBackground = 'street'">{{ t('map.background.street') }}</button>
            <button type="button" :aria-pressed="background === 'plan' ? 'true' : 'false'" @click="chosenBackground = 'plan'">{{ t('map.background.plan') }}</button>
          </div>
          <button type="button" class="map-button" :title="t(hasLocation ? 'map.location.change' : 'map.location.set')" @click="startLocating">
            <AppIcon name="pin" />
            <span class="map-button-label">{{ t(hasLocation ? 'map.location.change' : 'map.location.set') }}</span>
          </button>
          <button type="button" class="map-button" :title="t('map.fit')" @click="mapRef?.fitGarden()">
            <AppIcon name="fit" :label="t('map.fit')" />
          </button>
          <button type="button" class="map-button" :title="t('map.undo')" :disabled="!editor.canUndo" @click="undo">
            <AppIcon name="undo" :label="t('map.undo')" />
          </button>
          <button type="button" class="map-button" :title="t('map.redo')" :disabled="!editor.canRedo" @click="redo">
            <AppIcon name="redo" :label="t('map.redo')" />
          </button>
        </div>

        <div v-if="tool && !locating" class="draw-bar" role="status">
          <p>{{ measuredText || drawHint }}</p>
          <div class="btn-row">
            <div v-if="isPolygonTool()" class="segmented" role="group" :aria-label="t('map.draw.shape')">
              <button type="button" :aria-pressed="tool.draw === 'rectangle' ? 'true' : 'false'" :title="t('map.draw.shapeRectangle')" @click="setShape('rectangle')">
                <AppIcon name="rectangle" :label="t('map.draw.shapeRectangle')" />
              </button>
              <button type="button" :aria-pressed="tool.draw === 'polygon' ? 'true' : 'false'" :title="t('map.draw.shapePolygon')" @click="setShape('polygon')">
                <AppIcon name="polygon" :label="t('map.draw.shapePolygon')" />
              </button>
            </div>
            <button type="button" class="btn btn-text" @click="tool = null">{{ t('common.cancel') }}</button>
            <button v-if="canFinish" type="button" class="btn btn-primary" @click="mapRef?.finishDraw()">
              <AppIcon name="check" />
              <span>{{ t('map.draw.done') }}</span>
            </button>
          </div>
        </div>
      </div>

      <aside class="map-panel" :class="{ 'is-collapsed': panelCollapsed }" :aria-label="t('map.panel.label')">
        <button type="button" class="map-panel-toggle" :aria-expanded="panelCollapsed ? 'false' : 'true'" @click="panelCollapsed = !panelCollapsed">
          <span class="map-panel-handle" aria-hidden="true"></span>
          <span class="visually-hidden">{{ t('map.panel.toggle') }}</span>
        </button>
        <div class="map-panel-content">
          <!-- In the panel, not over the map: the cross in the middle must stay visible -->
          <SetupPanel
            v-if="setup"
            :garden="garden"
            :step="step"
            :units="settings.units"
            :online="network.online"
            :active-tool="tool?.type ?? null"
            :active-draw="tool?.draw ?? null"
            @step="goStep"
            @draw="drawFromSetup"
            @add-by-size="openAddDialog"
            @select="onSelect"
            @redraw-parcel="redrawParcel"
            @finish="leaveSetup(true)"
            @close="leaveSetup(false)"
            @fly="mapRef?.flyTo($event.lat, $event.lng, $event.zoom)"
            @confirm-location="confirmLocation"
            @skip-location="cancelLocating"
            @remove-location="removeLocation"
          />
          <LocationBar
            v-else-if="locating"
            :has-location="hasLocation"
            @fly="mapRef?.flyTo($event.lat, $event.lng, $event.zoom)"
            @confirm="confirmLocation"
            @cancel="cancelLocating"
            @remove="removeLocation"
          />
          <template v-else>
            <PeriodBar :plantings="garden.plantings" />
            <div v-if="firstBed && !hasPlantings && !selected" class="hint-card">
              <AppIcon name="seedling" />
              <div>
                <p><strong>{{ t('map.hints.noPlantings.title') }}</strong></p>
                <p class="small">{{ t('map.hints.noPlantings.text') }}</p>
                <button type="button" class="btn btn-secondary" @click="openBed(firstBed.id)">{{ t('map.hints.noPlantings.action') }}</button>
              </div>
            </div>
            <div v-else-if="!hasLocation && !selected" class="hint-card">
              <AppIcon name="pin" />
              <div>
                <p><strong>{{ t('map.noLocation.title') }}</strong></p>
                <p class="small">{{ t('map.noLocation.text') }}</p>
                <div class="btn-row">
                  <button type="button" class="btn btn-secondary" @click="startLocating">{{ t('map.location.set') }}</button>
                  <button type="button" class="btn btn-text" @click="startSetup">{{ t('setup.start') }}</button>
                </div>
              </div>
            </div>
            <div v-else-if="!hasParcel && !selected" class="hint-card">
              <AppIcon name="parcel" />
              <div>
                <p><strong>{{ t('setup.noParcel.title') }}</strong></p>
                <p class="small">{{ t('setup.noParcel.text') }}</p>
                <button type="button" class="btn btn-secondary" @click="startSetup">{{ t('setup.start') }}</button>
              </div>
            </div>
            <div v-else-if="!firstBed && !selected" class="hint-card">
              <AppIcon name="bed" />
              <div>
                <p><strong>{{ t('map.hints.noBeds.title') }}</strong></p>
                <p class="small">{{ t('map.hints.noBeds.text') }}</p>
                <button type="button" class="btn btn-secondary" @click="pick('bed')">{{ t('map.hints.noBeds.action') }}</button>
              </div>
            </div>
          </template>
          <ElementPanel
            v-if="selected && !locating"
            :key="selected.id"
            :element="selected"
            :units="settings.units"
            :edit-mode="editMode"
            :plantings="garden.plantings"
            :year="period.year"
            @close="selectedId = null"
            @update="onUpdate"
            @geometry="changeGeometry"
            @mode="editMode = $event"
            @delete="remove"
            @open-bed="openBed(selected.id)"
            @gantt="ganttOpen = true"
          />
          <ShownPlants v-if="hasPlantings && !selected && !setup && !locating" :garden="garden" :period="period" @open-bed="openBed" />
          <ElementList v-if="!selected && !setup && !locating" :elements="garden.elements" :units="settings.units" :plantings="garden.plantings" :year="period.year" @select="onSelect" @add="openAddDialog()" />
        </div>
      </aside>

      <BedGanttDialog v-if="selected && selected.type === 'bed'" v-model:open="ganttOpen" :garden="garden" :bed="selected" @assign="openBed(selected.id)" />
      <AddElementDialog v-model:open="addOpen" :units="settings.units" :has-parcel="hasParcel" :initial-type="addType" @add="addBySize" />
    </div>

    <div v-else class="page">
      <div class="page-header"><h1>{{ t('nav.map') }}</h1></div>
      <EmptyState :title="t('placeholder.noGardenTitle')" :text="t('placeholder.noGardenText')">
        <router-link to="/gardens" class="btn btn-primary">
          <AppIcon name="garden" />
          <span>{{ t('placeholder.toGardens') }}</span>
        </router-link>
      </EmptyState>
    </div>
  `,
};
