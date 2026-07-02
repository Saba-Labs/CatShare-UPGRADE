import { useReducer, useCallback } from 'react';
import {
  BuilderState,
  BuilderAction,
  HomepageLayout,
  HomepageSection,
  HomepageSectionType,
  GridPosition,
  BlockLayout,
  WebsiteModeConfig,
} from '../types/homepage';
import { createDefaultSection } from '../config/homepageBuilderConfig';
import type { BlockPresetId } from '../config/blockPresets';
import { buildBlockPresetSections } from '../config/blockPresets';
import type { FreeformElementType } from '../types/homepage';
import { createFreeformElement, createStarterFreeformSection } from '../utils/freeformElements';
import { v4 as uuid } from 'uuid';
import { layoutsShallowEqual, mergeSectionUpdate, sectionsShallowEqual } from '../utils/builderEditGuards';

const initialState: BuilderState = {
  layout: { sections: [], theme: {} },
  selectedSectionId: null,
  isDirty: false,
  isSaving: false,
  error: null,
  history: [],
  future: [],
};

const MAX_HISTORY = 100;

function withHistory(state: BuilderState, nextLayout: HomepageLayout, nextSelectedSectionId: string | null = state.selectedSectionId): BuilderState {
  const nextHistory = [...state.history, state.layout];
  return {
    ...state,
    layout: nextLayout,
    selectedSectionId: nextSelectedSectionId,
    isDirty: true,
    history: nextHistory.length > MAX_HISTORY ? nextHistory.slice(nextHistory.length - MAX_HISTORY) : nextHistory,
    future: [],
  };
}

function builderReducer(state: BuilderState, action: BuilderAction): BuilderState {
  switch (action.type) {
    case 'SET_LAYOUT': {
      return {
        ...state,
        layout: action.payload,
        isDirty: false,
        error: null,
        history: [],
        future: [],
      };
    }

    case 'ADD_SECTION': {
      const sectionType: HomepageSectionType = action.payload;
      if (sectionType === 'footer') return state;
      const newSection =
        sectionType === 'freeform'
          ? createStarterFreeformSection(state.layout.sections.length, uuid())
          : createDefaultSection(sectionType, state.layout.sections.length);
      return withHistory(
        state,
        {
          ...state.layout,
          sections: [...state.layout.sections, newSection],
        },
        newSection.id
      );
    }

    case 'ADD_PRESET_SECTIONS': {
      const newSections = action.payload as Array<HomepageSection & { id: string; order: number }>;
      if (!newSections.length) return state;
      const lastId = newSections[newSections.length - 1].id;
      return withHistory(
        state,
        {
          ...state.layout,
          sections: [...state.layout.sections, ...newSections],
        },
        lastId
      );
    }

    case 'INSERT_SECTION_AT': {
      const { sectionType, index } = action.payload as { sectionType: HomepageSectionType; index: number };
      if (sectionType === 'footer') return state;
      const sections = [...state.layout.sections];
      const clampedIndex = Math.max(0, Math.min(index, sections.length));
      const newSection =
        sectionType === 'freeform'
          ? createStarterFreeformSection(clampedIndex, uuid())
          : createDefaultSection(sectionType, index);
      sections.splice(clampedIndex, 0, newSection);
      const reordered = sections.map((s, i) => ({ ...s, order: i }));
      return withHistory(state, { ...state.layout, sections: reordered }, newSection.id);
    }

    case 'INSERT_PRESET_AT': {
      const { presetId, index } = action.payload as { presetId: BlockPresetId; index: number };
      const newSections = buildBlockPresetSections(presetId, index);
      if (!newSections.length) return state;
      const sections = [...state.layout.sections];
      const clampedIndex = Math.max(0, Math.min(index, sections.length));
      sections.splice(clampedIndex, 0, ...newSections);
      const reordered = sections.map((s, i) => ({ ...s, order: i }));
      const lastId = newSections[newSections.length - 1].id;
      return withHistory(state, { ...state.layout, sections: reordered }, lastId);
    }

    case 'ADD_FREEFORM_ELEMENT': {
      const elementType = action.payload as FreeformElementType;
      const index = state.layout.sections.length;
      const id = uuid();
      const newSection = createStarterFreeformSection(index, id);
      newSection.content.elements = [createFreeformElement(elementType, 1)];
      const sections = [...state.layout.sections, newSection];
      const reordered = sections.map((s, i) => ({ ...s, order: i }));
      return withHistory(state, { ...state.layout, sections: reordered }, newSection.id);
    }

    case 'REMOVE_SECTION': {
      const sectionId: string = action.payload;
      return withHistory(
        state,
        {
          ...state.layout,
          sections: state.layout.sections.filter((s) => s.id !== sectionId),
        },
        state.selectedSectionId === sectionId ? null : state.selectedSectionId
      );
    }

    case 'UPDATE_SECTION': {
      const { id, updates } = action.payload;
      const existing = state.layout.sections.find((s) => s.id === id);
      if (!existing) return state;
      const merged = mergeSectionUpdate(existing, updates);
      if (sectionsShallowEqual(existing, merged)) return state;
      return withHistory(state, {
        ...state.layout,
        sections: state.layout.sections.map((s) => (s.id === id ? merged : s)),
      });
    }

    case 'REORDER_SECTIONS': {
      const newSections: any[] = action.payload;
      return withHistory(state, {
        ...state.layout,
        sections: newSections.map((s, idx) => ({ ...s, order: idx })),
      });
    }

    case 'SELECT_SECTION': {
      return {
        ...state,
        selectedSectionId: action.payload || null,
      };
    }

    case 'UPDATE_THEME': {
      const nextTheme = { ...state.layout.theme, ...action.payload };
      if (JSON.stringify(state.layout.theme) === JSON.stringify(nextTheme)) return state;
      return withHistory(state, {
        ...state.layout,
        theme: nextTheme,
      });
    }

    case 'SET_ERROR': {
      return {
        ...state,
        error: action.payload,
      };
    }

    case 'MARK_SAVED': {
      return {
        ...state,
        isDirty: false,
        isSaving: false,
      };
    }

    case 'UPDATE_SECTION_POSITION': {
      const { id, position } = action.payload;
      return withHistory(state, {
        ...state.layout,
        sections: state.layout.sections.map((s) =>
          s.id === id ? { ...s, gridPosition: position } : s
        ),
      });
    }

    case 'UPDATE_WEBSITE_CONFIG': {
      if (
        state.layout.websiteConfig &&
        JSON.stringify(state.layout.websiteConfig) === JSON.stringify(action.payload)
      ) {
        return state;
      }
      return withHistory(state, {
        ...state.layout,
        websiteConfig: action.payload,
      });
    }

    case 'UPDATE_SECTION_LAYOUT': {
      const { id, blockLayout } = action.payload;
      const existing = state.layout.sections.find((s) => s.id === id);
      if (!existing) return state;
      const nextBlockLayout = { ...existing.blockLayout, ...blockLayout };
      if (JSON.stringify(existing.blockLayout) === JSON.stringify(nextBlockLayout)) return state;
      return withHistory(state, {
        ...state.layout,
        sections: state.layout.sections.map((s) =>
          s.id === id ? { ...s, blockLayout: nextBlockLayout } : s
        ),
      });
    }

    case 'SWITCH_EDITING_PAGE': {
      const { websiteConfig, sections, theme } = action.payload;
      const nextLayout = {
        ...state.layout,
        websiteConfig,
        sections,
        theme,
      };
      if (layoutsShallowEqual(state.layout, nextLayout)) return state;
      return withHistory(state, nextLayout);
    }

    case 'UNDO': {
      if (state.history.length === 0) return state;
      const previousLayout = state.history[state.history.length - 1];
      return {
        ...state,
        layout: previousLayout,
        selectedSectionId: null,
        isDirty: true,
        history: state.history.slice(0, -1),
        future: [state.layout, ...state.future].slice(0, MAX_HISTORY),
      };
    }

    case 'REDO': {
      if (state.future.length === 0) return state;
      const [nextLayout, ...remainingFuture] = state.future;
      return {
        ...state,
        layout: nextLayout,
        selectedSectionId: null,
        isDirty: true,
        history: [...state.history, state.layout].slice(-MAX_HISTORY),
        future: remainingFuture,
      };
    }

    default:
      return state;
  }
}

export function useHomepageBuilder(initialLayout?: HomepageLayout) {
  const [state, dispatch] = useReducer(builderReducer, {
    ...initialState,
    layout: initialLayout || initialState.layout,
  });

  const addSection = useCallback((type: HomepageSectionType) => {
    dispatch({ type: 'ADD_SECTION', payload: type });
  }, []);

  const insertSectionAt = useCallback((type: HomepageSectionType, index: number) => {
    dispatch({ type: 'INSERT_SECTION_AT', payload: { sectionType: type, index } });
  }, []);

  const addBlockPreset = useCallback(
    (presetId: BlockPresetId) => {
      const startOrder = state.layout.sections.length;
      const sections = buildBlockPresetSections(presetId, startOrder);
      dispatch({ type: 'ADD_PRESET_SECTIONS', payload: sections });
    },
    [state.layout.sections.length]
  );

  const insertPresetAt = useCallback((presetId: BlockPresetId, index: number) => {
    dispatch({ type: 'INSERT_PRESET_AT', payload: { presetId, index } });
  }, []);

  const addFreeformElement = useCallback((elementType: FreeformElementType) => {
    dispatch({ type: 'ADD_FREEFORM_ELEMENT', payload: elementType });
  }, []);

  const removeSection = useCallback((sectionId: string) => {
    dispatch({ type: 'REMOVE_SECTION', payload: sectionId });
  }, []);

  const updateSection = useCallback((id: string, updates: Partial<HomepageSection>) => {
    dispatch({ type: 'UPDATE_SECTION', payload: { id, updates } });
  }, []);

  const reorderSections = useCallback((sections: HomepageSection[]) => {
    dispatch({ type: 'REORDER_SECTIONS', payload: sections });
  }, []);

  const selectSection = useCallback((sectionId: string | null) => {
    dispatch({ type: 'SELECT_SECTION', payload: sectionId });
  }, []);

  const updateTheme = useCallback((theme: any) => {
    dispatch({ type: 'UPDATE_THEME', payload: theme });
  }, []);

  const setLayout = useCallback((layout: HomepageLayout) => {
    dispatch({ type: 'SET_LAYOUT', payload: layout });
  }, []);

  const setError = useCallback((error: string | null) => {
    dispatch({ type: 'SET_ERROR', payload: error });
  }, []);

  const markSaved = useCallback(() => {
    dispatch({ type: 'MARK_SAVED' });
  }, []);

  const duplicateSection = useCallback((sectionId: string) => {
    const section = state.layout.sections.find((s) => s.id === sectionId);
    if (!section) return;

    const duplicate = {
      ...JSON.parse(JSON.stringify(section)),
      id: uuid(),
      order: state.layout.sections.length,
    };

    dispatch({
      type: 'REORDER_SECTIONS',
      payload: [...state.layout.sections, duplicate],
    });
  }, [state.layout.sections]);

  const updateSectionPosition = useCallback((sectionId: string, position: GridPosition) => {
    dispatch({ type: 'UPDATE_SECTION_POSITION', payload: { id: sectionId, position } });
  }, []);

  const updateSectionLayout = useCallback((sectionId: string, blockLayout: BlockLayout) => {
    dispatch({ type: 'UPDATE_SECTION_LAYOUT', payload: { id: sectionId, blockLayout } });
  }, []);

  const updateWebsiteConfig = useCallback((websiteConfig: WebsiteModeConfig) => {
    dispatch({ type: 'UPDATE_WEBSITE_CONFIG', payload: websiteConfig });
  }, []);

  const switchEditingPage = useCallback(
    (payload: {
      websiteConfig: WebsiteModeConfig;
      sections: HomepageLayout['sections'];
      theme: HomepageLayout['theme'];
    }) => {
      dispatch({ type: 'SWITCH_EDITING_PAGE', payload });
    },
    []
  );

  const undo = useCallback(() => {
    dispatch({ type: 'UNDO' });
  }, []);

  const redo = useCallback(() => {
    dispatch({ type: 'REDO' });
  }, []);

  return {
    state,
    actions: {
      addSection,
      insertSectionAt,
      addBlockPreset,
      insertPresetAt,
      addFreeformElement,
      removeSection,
      updateSection,
      reorderSections,
      selectSection,
      updateTheme,
      setLayout,
      setError,
      markSaved,
      duplicateSection,
      updateSectionPosition,
      updateSectionLayout,
      updateWebsiteConfig,
      switchEditingPage,
      undo,
      redo,
    },
  };
}
