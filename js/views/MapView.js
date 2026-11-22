import { ref, computed, watch, onMounted, onBeforeUnmount, toRaw } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  gardens, editor, addElement, updateElementGeometry, updateElement, deleteElement, undo, redo, setLocation,
} from '../stores/gardens.js';
import { settings } from '../stores/settings.js';
import { showToast, showError } from '../stores/toast.js';
import { ELEMENT_TYPES, createElement, createElementAt, elementsBounds } from '../logic/elements.js';
import { metresPerDegree } from '../logic/geometry.js';
import { formatLength } from '../logic/units.js';
import AppIcon from '../components/AppIcon.js';
import EmptyState from '../components/EmptyState.js';
import GardenMap from '../components/map/GardenMap.js';
import ToolPalette from '../components/map/ToolPalette.js';
import ElementPanel from '../components/map/ElementPanel.js';
import ElementList from '../components/map/ElementList.js';
import AddElementDialog from '../components/map/AddElementDialog.js';
import LocationBar from '../components/map/LocationBar.js';
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

function isTyping(target) {
  return target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName));
}

export default {
  name: 'MapView',
  components: { AppIcon, EmptyState, GardenMap, ToolPalette, ElementPanel, ElementList, AddElementDialog, LocationBar },
  setup() {
    const { t, locale } = useI18n();
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
    const panelCollapsed = ref(false);

    const hasLocation = computed(() => Boolean(garden.value?.location));
    const background = computed(() => {
      if (locating.value) return 'street';
      return hasLocation.value ? chosenBackground.value : 'plan';
    });
    const selected = computed(() => garden.value?.elements.find((element) => element.id === selectedId.value) ?? null);
    const hasParcel = computed(() => garden.value?.elements.some((element) => element.type === 'parcel') ?? false);
    const activeToolName = computed(() => (tool.value ? tool.value.type ?? 'measure' : null));
    const drawHint = computed(() => (tool.value ? t(`map.draw.${tool.value.draw}`) : ''));
    const canFinish = computed(() => ['polygon', 'line', 'measure'].includes(tool.value?.draw));
    const measuredText = computed(() => (measured.value === null ? '' : t('map.draw.measured', { length: formatLength(measured.value, settings.units, locale.value) })));

    watch(() => garden.value?.id, () => {
      tool.value = null;
      selectedId.value = null;
      locating.value = false;
    });
    watch(selected, (element) => {
      if (!element) selectedId.value = null;
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

    function remove() {
      const element = selected.value;
      if (!element) return;
      const copy = structuredClone(toRaw(element));
      deleteElement(element.id);
      selectedId.value = null;
      showToast('map.deleted', {
        params: { name: elementName(element, t) },
        action: { key: 'common.undo', handler: () => addElement(copy) },
      });
    }

    // --- Location -------------------------------------------------------------

    function startLocating() {
      tool.value = null;
      selectedId.value = null;
      locating.value = true;
      panelCollapsed.value = false;
      if (!hasLocation.value) {
        const [lat, lng, zoom] = START_VIEWS[locale.value] ?? START_VIEWS.en;
        setTimeout(() => mapRef.value?.flyTo(lat, lng, zoom), 0);
      }
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
    }

    function cancelLocating() {
      locating.value = false;
      setTimeout(() => mapRef.value?.fitGarden(), 0);
    }

    function removeLocation() {
      setLocation(null);
      locating.value = false;
    }

    // --- Keyboard -------------------------------------------------------------

    function onKeydown(event) {
      if (document.querySelector('dialog[open]')) return;
      const mod = event.ctrlKey || event.metaKey;
      if (mod && event.key.toLowerCase() === 'z' && !isTyping(event.target)) {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && event.key.toLowerCase() === 'y' && !isTyping(event.target)) {
        event.preventDefault();
        redo();
        return;
      }
      if (isTyping(event.target)) return;
      if (event.key === 'Escape') {
        if (tool.value) tool.value = null;
        else if (locating.value) cancelLocating();
        else selectedId.value = null;
      } else if (event.key === 'Enter' && canFinish.value) {
        mapRef.value?.finishDraw();
      } else if ((event.key === 'Delete' || event.key === 'Backspace') && selected.value && !tool.value) {
        event.preventDefault();
        remove();
      }
    }

    onMounted(() => window.addEventListener('keydown', onKeydown));
    onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown));

    return {
      t, mapRef, garden, settings, editor, tool, selectedId, selected, editMode, snapping, background, chosenBackground,
      locating, hasLocation, hasParcel, activeToolName, drawHint, canFinish, measured, measuredText, addOpen, panelCollapsed,
      pick, setShape, onCreate, onDrawEnd, onSelect, addBySize, remove, startLocating, confirmLocation, cancelLocating,
      removeLocation, undo, redo,
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
          @create="onCreate"
          @change="onChange"
          @select="onSelect"
          @draw-end="onDrawEnd"
          @invalid="onInvalid"
          @measure="onMeasure"
        />

        <ToolPalette v-if="!locating" :active="activeToolName" :snapping="snapping" @pick="pick" @toggle-snapping="snapping = !snapping" />

        <div class="map-topbar" v-if="!locating">
          <div class="segmented" role="group" :aria-label="t('map.background.label')" v-if="hasLocation">
            <button type="button" :aria-pressed="background === 'street' ? 'true' : 'false'" @click="chosenBackground = 'street'">{{ t('map.background.street') }}</button>
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
          <LocationBar
            v-if="locating"
            :has-location="hasLocation"
            @fly="mapRef?.flyTo($event.lat, $event.lng, $event.zoom)"
            @confirm="confirmLocation"
            @cancel="cancelLocating"
            @remove="removeLocation"
          />
          <template v-else>
          <div v-if="!hasLocation && !selected" class="hint-card">
            <AppIcon name="pin" />
            <div>
              <p><strong>{{ t('map.noLocation.title') }}</strong></p>
              <p class="small">{{ t('map.noLocation.text') }}</p>
              <button type="button" class="btn btn-secondary" @click="startLocating">{{ t('map.location.set') }}</button>
            </div>
          </div>
          <ElementPanel
            v-if="selected"
            :key="selected.id"
            :element="selected"
            :units="settings.units"
            :edit-mode="editMode"
            @close="selectedId = null"
            @update="onUpdate"
            @geometry="changeGeometry"
            @mode="editMode = $event"
            @delete="remove"
          />
          <ElementList v-else :elements="garden.elements" :units="settings.units" @select="onSelect" @add="addOpen = true" />
          </template>
        </div>
      </aside>

      <AddElementDialog v-model:open="addOpen" :units="settings.units" :has-parcel="hasParcel" @add="addBySize" />
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
