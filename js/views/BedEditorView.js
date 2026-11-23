// Bed editor (docs/concept.md §2): one bed, its planting areas and single plants
// over time. The map component runs in bed mode.

import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { gardens, editor, addPlantings, updatePlanting, deletePlanting, undo, redo } from '../stores/gardens.js';
import { settings } from '../stores/settings.js';
import { period, setYear, setWeek, thisWeek, isLocked, unlockYear, currentYear } from '../stores/period.js';
import { showToast, showError } from '../stores/toast.js';
import { plantById as getPlant } from '../stores/catalog.js';
import { createPlanting, defaultEnd, fitShapeToBed, copyForward, shapeArea, visiblePlantings } from '../logic/plantings.js';
import { todayIso, toIsoDate, yearOf, addDays } from '../logic/dates.js';
import { startOnOrAfter, proposedPeriod } from '../logic/hints.js';
import { plantingBadges, pickerAdvice } from '../logic/rotation.js';
import { catalog } from '../stores/catalog.js';
import { formatArea, formatLength } from '../logic/units.js';
import { measure } from '../logic/elements.js';
import { useMapKeys } from '../composables/useMapKeys.js';
import AppIcon from '../components/AppIcon.js';
import EmptyState from '../components/EmptyState.js';
import PeriodBar from '../components/PeriodBar.js';
import PlantIcon from '../components/PlantIcon.js';
import GardenMap from '../components/map/GardenMap.js';
import ToolPalette from '../components/map/ToolPalette.js';
import PlantingPanel from '../components/bed/PlantingPanel.js';
import BedOverview from '../components/bed/BedOverview.js';
import AddPlantingDialog from '../components/bed/AddPlantingDialog.js';
import BedGanttDialog from '../components/gantt/BedGanttDialog.js';
import { plantName, periodText, preText } from '../components/bed/plantingText.js';

const BED_TOOLS = [
  { id: 'area', icon: 'area', labelKey: 'bed.tools.area' },
  { id: 'plant', icon: 'seedling', labelKey: 'bed.tools.plant' },
];

export default {
  name: 'BedEditorView',
  components: { AppIcon, EmptyState, PeriodBar, PlantIcon, GardenMap, ToolPalette, PlantingPanel, BedOverview, AddPlantingDialog, BedGanttDialog },
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
    const addOpen = ref(false);
    const ganttOpen = ref(false);
    const addInitial = ref(null);
    let lastKind = 'area';
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
    const bedName = computed(() => bed.value?.name || t('elements.types.bed'));
    const drawHint = computed(() => (tool.value ? t(`bed.draw.${tool.value.type === 'area' ? tool.value.draw : tool.value.type}`) : ''));
    /** What is being drawn: "Carrot · 1 Apr – 30 Jun" */
    const drawing = computed(() => (tool.value?.plantId
      ? { plantId: tool.value.plantId, text: [plantName(tool.value.plantId, t), periodText(tool.value, locale.value, t, period.year), preText(tool.value, locale.value, t)].filter(Boolean).join(' · ') }
      : null));
    const measuredText = computed(() => (measured.value === null ? '' : t('map.draw.measured', { length: formatLength(measured.value, settings.units, locale.value) })));
    const canFinish = computed(() => tool.value?.draw === 'polygon' || tool.value?.type === 'measure');

    // Rotation and neighbours of this bed's plantings, and advice for the plant picker
    const badges = computed(() => {
      if (!bed.value) return {};
      const all = garden.value.plantings;
      return Object.fromEntries(all.filter((p) => p.bedId === bed.value.id).map((p) => [p.id, plantingBadges(p, all, catalog.value)]));
    });
    const advice = computed(() => {
      if (!bed.value) return {};
      const window = period.day ? { start: period.day, end: addDays(period.day, period.days - 1) } : { start: `${period.year}-01-01`, end: `${period.year}-12-31` };
      return pickerAdvice(bed.value.id, window, garden.value.plantings, catalog.value);
    });

    watch(selected, (planting) => {
      if (!planting) selectedId.value = null;
    });
    watch(readOnly, (locked) => {
      if (locked) tool.value = null;
    });
    watch(() => route.params.id, () => {
      tool.value = null;
      selectedId.value = null;
      addOpen.value = false;
    });

    /** Palette: "Area" and "Single plants" first ask for plant and period. */
    function pick(id) {
      measured.value = null;
      selectedId.value = null;
      if (id === 'area' || id === 'plant') {
        openAdd(id);
        return;
      }
      tool.value = id === 'measure' ? { type: 'measure', draw: 'measure' } : null;
    }

    function setAreaShape(shape) {
      areaShape.value = shape;
      if (tool.value?.type === 'area') tool.value = { ...tool.value, draw: shape };
    }

    // --- Adding a planting: plant, period, place -------------------------------

    function openAdd(kind = lastKind) {
      if (readOnly.value) return;
      tool.value = null;
      selectedId.value = null;
      addInitial.value = { plantId: plantId.value, kind };
      addOpen.value = true;
    }

    /** Reopens the dialog with what is being drawn */
    function changeDrawing() {
      const current = tool.value;
      if (!current?.plantId) return;
      addInitial.value = { plantId: current.plantId, kind: current.type, start: current.start, end: current.end, preStart: current.preStart, keepPre: true };
      addOpen.value = true;
    }

    /** Proposed period for a plant; with `start` only the end is proposed. */
    function propose(id, start = null) {
      const plant = getPlant(id);
      const from = start ?? newStart(plant);
      return { start: from, end: defaultEnd(plant, from) };
    }

    function onAdd({ plantId: id, kind, start, end, preStart }) {
      plantId.value = id;
      lastKind = kind;
      if (kind === 'whole') {
        tool.value = null;
        const planting = place({ kind: 'polygon', points: bed.value.geometry.points }, { plantId: id, start, end, preStart });
        if (planting) selectPlanting(planting);
        return;
      }
      tool.value = kind === 'plant'
        ? { type: 'plant', draw: 'point', plantId: id, start, end, preStart }
        : { type: 'area', draw: areaShape.value, plantId: id, start, end, preStart };
    }

    /** Creates the planting and shows a time in which it is in the bed. */
    function place(shape, { plantId: id, start, end, preStart = null }) {
      const fitted = fitShapeToBed(shape, bed.value.geometry.points);
      if (fitted.error) {
        showError(`bed.errors.${fitted.error}`);
        return null;
      }
      const planting = createPlanting({ bedId: bed.value.id, plantId: id, shape: fitted.shape, start, end, preStart });
      addPlantings([planting]);
      if (visiblePlantings([planting], period).length === 0) {
        if (period.day) setWeek(start);
        else setYear(yearOf(start));
      }
      return planting;
    }

    // Coming from a plant's page ("Plan planting", ?plant=<id>): the dialog opens for that
    // plant with the period of the current or coming season, and the timeline moves there
    watch(() => [route.query.plant, bed.value?.id], ([id]) => {
      if (!id || !bed.value) return;
      const wanted = catalog.value.get(id);
      router.replace({ path: route.path });
      if (!wanted || wanted.placement !== 'bed') return;
      const proposal = proposedPeriod(wanted, garden.value.climate, todayIso());
      setWeek(proposal.start);
      tool.value = null;
      selectedId.value = null;
      addInitial.value = { plantId: id, kind: 'area', ...proposal };
      addOpen.value = true;
    }, { immediate: true });

    function selectPlanting(planting) {
      selectedId.value = planting.id;
      editMode.value = 'shape';
      panelCollapsed.value = false;
      showToast('bed.add.planned', { params: { name: plantName(planting.plantId, t), period: periodText(planting, locale.value, t, period.year) } });
    }

    /**
     * Start proposed for a new planting: the first day from the shown week on (this week
     * and the whole current year: from today; the whole of another year: from 1 January)
     * that lies in the plant's planting-out or sowing window (climate-adjusted). Plants
     * without a window start in the shown week, today or on 1 April.
     */
    function newStart(plant) {
      const thisYear = period.year === currentYear();
      const shown = period.day === thisWeek() ? todayIso() : period.day;
      const from = shown ?? (thisYear ? todayIso() : toIsoDate(period.year, 1, 1));
      return startOnOrAfter(plant, garden.value.climate, from) ?? shown ?? (thisYear ? todayIso() : toIsoDate(period.year, 4, 1));
    }

    function onCreate({ geometry }) {
      if (!bed.value || readOnly.value) return;
      const chosen = tool.value?.start ? tool.value : { plantId: plantId.value, ...propose(plantId.value) };
      const planting = place(geometry, chosen);
      if (!planting || tool.value?.draw === 'point') return; // keep placing single plants
      selectPlanting(planting);
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
      t, mapRef, garden, bed, badges, advice, settings, editor, period, tool, areaShape, plantId, selectedId, selected, editMode, snapping,
      measuredText, drawHint, drawing, canFinish, panelCollapsed, readOnly, background, bedSize, bedName, BED_TOOLS,
      addOpen, addInitial, openAdd, ganttOpen,
      assignFromGantt: () => {
        ganttOpen.value = false;
        openAdd();
      }, changeDrawing, propose, onAdd, isLocked,
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
          :badges="badges"
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
          <div class="draw-bar-text">
            <p v-if="drawing" class="draw-bar-what">
              <PlantIcon :plant-id="drawing.plantId" :size="24" />
              <span>{{ drawing.text }}</span>
            </p>
            <p :class="{ small: drawing }">{{ measuredText || drawHint }}</p>
          </div>
          <div class="btn-row draw-bar-controls">
            <button v-if="drawing" type="button" class="btn btn-text" @click="changeDrawing">{{ t('bed.add.change') }}</button>
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
              <h2>{{ bedName }}</h2>
              <p class="small muted">{{ bedSize }}</p>
            </div>
            <button type="button" class="btn btn-secondary" @click="ganttOpen = true">
              <AppIcon name="calendar" />
              <span>{{ t('calendar.gantt.bedButton') }}</span>
            </button>
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
            :plantings="garden.plantings"
            :advice="advice"
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
            :badges="badges"
            @select="onSelect"
            @year="setYear"
            @copy="copyToNextYear"
            @add="openAdd()"
          />
        </div>
      </aside>

      <BedGanttDialog v-model:open="ganttOpen" :garden="garden" :bed="bed" @assign="assignFromGantt" />
      <AddPlantingDialog v-model:open="addOpen" :bed-name="bedName" :initial="addInitial" :propose="propose" :is-locked="isLocked" :advice="advice" @submit="onAdd" />
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
