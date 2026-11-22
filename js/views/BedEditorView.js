// Bed editor (docs/concept.md §2): one bed, its planting areas and single plants
// over time. The map component runs in bed mode.

import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { gardens, editor, addPlantings, updatePlanting, deletePlanting, undo, redo } from '../stores/gardens.js';
import { settings } from '../stores/settings.js';
import { period, setYear, isLocked, unlockYear, currentYear } from '../stores/period.js';
import { showToast, showError } from '../stores/toast.js';
import { plantById as getPlant } from '../stores/catalog.js';
import { createPlanting, defaultEnd, fitShapeToBed, copyForward, shapeArea } from '../logic/plantings.js';
import { todayIso, toIsoDate } from '../logic/dates.js';
import { proposedStart } from '../logic/hints.js';
import { formatArea, formatLength } from '../logic/units.js';
import { measure } from '../logic/elements.js';
import { useMapKeys } from '../composables/useMapKeys.js';
import AppIcon from '../components/AppIcon.js';
import EmptyState from '../components/EmptyState.js';
import PeriodBar from '../components/PeriodBar.js';
import PlantSelect from '../components/PlantSelect.js';
import GardenMap from '../components/map/GardenMap.js';
import ToolPalette from '../components/map/ToolPalette.js';
import PlantingPanel from '../components/bed/PlantingPanel.js';
import BedOverview from '../components/bed/BedOverview.js';
import { plantName } from '../components/bed/plantingText.js';

const BED_TOOLS = [
  { id: 'area', icon: 'area', labelKey: 'bed.tools.area' },
  { id: 'plant', icon: 'seedling', labelKey: 'bed.tools.plant' },
];

export default {
  name: 'BedEditorView',
  components: { AppIcon, EmptyState, PeriodBar, PlantSelect, GardenMap, ToolPalette, PlantingPanel, BedOverview },
  setup() {
    const { t, locale } = useI18n();
    const route = useRoute();
    const router = useRouter();
    const mapRef = ref(null);

    const garden = computed(() => gardens.active);
    const bed = computed(() => garden.value?.elements.find((element) => element.id === route.params.id && element.type === 'bed') ?? null);
    const tool = ref(null);
    const areaShape = ref('rectangle');
    const plantId = ref('carrot');
    const selectedId = ref(null);
    const editMode = ref('shape');
    const snapping = ref(true);
    const measured = ref(null);
    const panelCollapsed = ref(false);

    const readOnly = computed(() => isLocked(period.year));
    const selected = computed(() => garden.value?.plantings.find((planting) => planting.id === selectedId.value) ?? null);
    const background = computed(() => (garden.value?.location ? 'street' : 'plan'));
    const bedSize = computed(() => {
      if (!bed.value) return '';
      const result = measure(bed.value);
      if (result.rectangle) {
        return `${formatLength(result.rectangle.width, settings.units, locale.value)} × ${formatLength(result.rectangle.depth, settings.units, locale.value)} · ${formatArea(result.area, settings.units, locale.value)}`;
      }
      return formatArea(result.area, settings.units, locale.value);
    });
    const drawHint = computed(() => (tool.value ? t(`bed.draw.${tool.value.type === 'area' ? tool.value.draw : tool.value.type}`) : ''));
    const measuredText = computed(() => (measured.value === null ? '' : t('map.draw.measured', { length: formatLength(measured.value, settings.units, locale.value) })));
    const canFinish = computed(() => tool.value?.draw === 'polygon' || tool.value?.type === 'measure');

    watch(selected, (planting) => {
      if (!planting) selectedId.value = null;
    });
    watch(readOnly, (locked) => {
      if (locked) tool.value = null;
    });
    watch(() => route.params.id, () => {
      tool.value = null;
      selectedId.value = null;
    });

    function buildTool(id) {
      if (id === 'measure') return { type: 'measure', draw: 'measure' };
      if (id === 'plant') return { type: 'plant', draw: 'point', plantId: plantId.value };
      return { type: 'area', draw: areaShape.value, plantId: plantId.value };
    }

    function pick(id) {
      measured.value = null;
      selectedId.value = null;
      tool.value = id === null ? null : buildTool(id);
    }

    function setAreaShape(shape) {
      areaShape.value = shape;
      if (tool.value?.type === 'area') tool.value = buildTool('area');
    }

    watch(plantId, () => {
      if (tool.value && tool.value.type !== 'measure') tool.value = buildTool(tool.value.type);
    });

    /**
     * Start date for new plantings: the shown day; for the whole year the plant's
     * planting-out or sowing window (climate-adjusted); else today or 1 April.
     */
    function newStart(plant) {
      if (period.day) return period.day;
      const proposed = proposedStart(plant, garden.value.climate, period.year);
      if (proposed) return proposed;
      return period.year === currentYear() ? todayIso() : toIsoDate(period.year, 4, 1);
    }

    function onCreate({ geometry }) {
      if (!bed.value || readOnly.value) return;
      const fitted = fitShapeToBed(geometry, bed.value.geometry.points);
      if (fitted.error) {
        showError(`bed.errors.${fitted.error}`);
        return;
      }
      const plant = getPlant(plantId.value);
      const start = newStart(plant);
      const planting = createPlanting({ bedId: bed.value.id, plantId: plant.id, shape: fitted.shape, start, end: defaultEnd(plant, start) });
      addPlantings([planting]);
      if (tool.value?.draw === 'point') return; // keep placing single plants
      selectedId.value = planting.id;
      editMode.value = 'shape';
      panelCollapsed.value = false;
    }

    function onChange({ id, shape }) {
      const fitted = fitShapeToBed(shape, bed.value.geometry.points);
      if (fitted.error) {
        showError(`bed.errors.${fitted.error}`);
        mapRef.value?.refresh(id);
        return;
      }
      updatePlanting(id, { shape: fitted.shape });
      if (JSON.stringify(fitted.shape) !== JSON.stringify(shape)) mapRef.value?.refresh(id);
    }

    function onDrawEnd() {
      if (tool.value && tool.value.type !== 'measure') tool.value = null;
    }

    function onSelect(id) {
      if (id !== selectedId.value) editMode.value = 'shape';
      selectedId.value = id;
      if (id) panelCollapsed.value = false;
    }

    function remove() {
      const planting = selected.value;
      if (!planting || readOnly.value) return false;
      const copy = deletePlanting(planting.id);
      selectedId.value = null;
      showToast('bed.deleted', {
        params: { name: plantName(planting.plantId, t) },
        action: { key: 'common.undo', handler: () => addPlantings([copy]) },
      });
      return true;
    }

    function copyToNextYear(ids) {
      const copies = garden.value.plantings.filter((planting) => ids.includes(planting.id)).map((planting) => copyForward(planting));
      addPlantings(copies);
      const year = period.year + 1;
      showToast('bed.copied', {
        params: { count: copies.length, year },
        action: { key: 'bed.showYear', handler: () => setYear(year) },
      });
    }

    useMapKeys({
      onEscape: () => {
        if (tool.value) tool.value = null;
        else selectedId.value = null;
      },
      onEnter: () => {
        if (canFinish.value) mapRef.value?.finishDraw();
      },
      onDelete: () => (tool.value ? false : remove()),
    });

    return {
      t, mapRef, garden, bed, settings, editor, period, tool, areaShape, plantId, selectedId, selected, editMode, snapping,
      measuredText, drawHint, canFinish, panelCollapsed, readOnly, background, bedSize, BED_TOOLS,
      pick, setAreaShape, onCreate, onChange, onDrawEnd, onSelect, remove, copyToNextYear, undo, redo, setYear, unlockYear,
      activeTool: computed(() => tool.value?.type ?? null),
      onUpdate: (fields) => updatePlanting(selectedId.value, fields),
      onInvalid: () => showError('map.errors.invalidShape'),
      onMeasure: (length) => {
        measured.value = length;
      },
      backToMap: () => router.push('/map'),
      shapeArea,
    };
  },
  template: `
    <div v-if="garden && bed" class="map-view">
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
          :period="period"
          :focus-bed-id="bed.id"
          :read-only="readOnly"
          @create="onCreate"
          @change="onChange"
          @select="onSelect"
          @draw-end="onDrawEnd"
          @invalid="onInvalid"
          @measure="onMeasure"
        />

        <ToolPalette :items="BED_TOOLS" :active="activeTool" :snapping="snapping" :disabled="readOnly" @pick="pick" @toggle-snapping="snapping = !snapping" />

        <div class="map-topbar">
          <button type="button" class="map-button" :title="t('bed.backToMap')" @click="backToMap">
            <AppIcon name="chevron-left" />
            <span class="map-button-label">{{ t('bed.backToMap') }}</span>
          </button>
          <button type="button" class="map-button" :title="t('bed.fit')" @click="mapRef?.fitGarden()">
            <AppIcon name="fit" :label="t('bed.fit')" />
          </button>
          <button type="button" class="map-button" :title="t('map.undo')" :disabled="!editor.canUndo" @click="undo">
            <AppIcon name="undo" :label="t('map.undo')" />
          </button>
          <button type="button" class="map-button" :title="t('map.redo')" :disabled="!editor.canRedo" @click="redo">
            <AppIcon name="redo" :label="t('map.redo')" />
          </button>
        </div>

        <div v-if="tool" class="draw-bar" role="status">
          <p>{{ measuredText || drawHint }}</p>
          <div class="btn-row draw-bar-controls">
            <PlantSelect v-if="tool.type !== 'measure'" v-model="plantId" placement="bed" :label="t('planting.plant')" hide-label />
            <div v-if="tool.type === 'area'" class="segmented" role="group" :aria-label="t('map.draw.shape')">
              <button type="button" :aria-pressed="tool.draw === 'rectangle' ? 'true' : 'false'" :title="t('map.draw.shapeRectangle')" @click="setAreaShape('rectangle')">
                <AppIcon name="rectangle" :label="t('map.draw.shapeRectangle')" />
              </button>
              <button type="button" :aria-pressed="tool.draw === 'polygon' ? 'true' : 'false'" :title="t('map.draw.shapePolygon')" @click="setAreaShape('polygon')">
                <AppIcon name="polygon" :label="t('map.draw.shapePolygon')" />
              </button>
            </div>
            <button type="button" class="btn btn-text" @click="tool = null">{{ tool.type === 'plant' ? t('map.draw.done') : t('common.cancel') }}</button>
            <button v-if="canFinish" type="button" class="btn btn-primary" @click="mapRef?.finishDraw()">
              <AppIcon name="check" />
              <span>{{ t('map.draw.done') }}</span>
            </button>
          </div>
        </div>
      </div>

      <aside class="map-panel" :class="{ 'is-collapsed': panelCollapsed }" :aria-label="t('bed.panel')">
        <button type="button" class="map-panel-toggle" :aria-expanded="panelCollapsed ? 'false' : 'true'" @click="panelCollapsed = !panelCollapsed">
          <span class="map-panel-handle" aria-hidden="true"></span>
          <span class="visually-hidden">{{ t('map.panel.toggle') }}</span>
        </button>
        <div class="map-panel-content">
          <div class="panel-header bed-title">
            <div>
              <h2>{{ bed.name || t('elements.types.bed') }}</h2>
              <p class="small muted">{{ bedSize }}</p>
            </div>
          </div>
          <PeriodBar />
          <div v-if="readOnly" class="hint-card">
            <AppIcon name="lock" />
            <div>
              <p class="small">{{ t('bed.locked', { year: period.year }) }}</p>
              <button type="button" class="btn btn-secondary" @click="unlockYear(period.year)">{{ t('bed.unlock') }}</button>
            </div>
          </div>
          <PlantingPanel
            v-if="selected"
            :key="selected.id"
            :planting="selected"
            :units="settings.units"
            :edit-mode="editMode"
            :read-only="readOnly"
            @close="selectedId = null"
            @update="onUpdate"
            @mode="editMode = $event"
            @delete="remove"
          />
          <BedOverview
            v-else
            :bed="bed"
            :plantings="garden.plantings"
            :period="period"
            :read-only="readOnly"
            @select="onSelect"
            @year="setYear"
            @copy="copyToNextYear"
          />
        </div>
      </aside>
    </div>

    <div v-else class="page">
      <div class="page-header"><h1>{{ t('elements.types.bed') }}</h1></div>
      <EmptyState :title="t('bed.notFoundTitle')" :text="t('bed.notFoundText')">
        <router-link to="/map" class="btn btn-primary">
          <AppIcon name="map" />
          <span>{{ t('bed.backToMap') }}</span>
        </router-link>
      </EmptyState>
    </div>
  `,
};
