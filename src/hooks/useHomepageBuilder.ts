import { useReducer, useCallback } from 'react';
import { BuilderState, BuilderAction, HomepageLayout, HomepageSection, HomepageSectionType, GridPosition } from '../types/homepage';
import { createDefaultSection } from '../config/homepageBuilderConfig';
import { v4 as uuid } from 'uuid';

const initialState: BuilderState = {
  layout: { sections: [], theme: {} },
  selectedSectionId: null,
  isDirty: false,
  isSaving: false,
  error: null,
};

function builderReducer(state: BuilderState, action: BuilderAction): BuilderState {
  switch (action.type) {
    case 'SET_LAYOUT': {
      return {
        ...state,
        layout: action.payload,
        isDirty: false,
        error: null,
      };
    }

    case 'ADD_SECTION': {
      const sectionType: HomepageSectionType = action.payload;
      const newSection = createDefaultSection(sectionType, state.layout.sections.length);

      return {
        ...state,
        layout: {
          ...state.layout,
          sections: [...state.layout.sections, newSection],
        },
        selectedSectionId: newSection.id,
        isDirty: true,
      };
    }

    case 'REMOVE_SECTION': {
      const sectionId: string = action.payload;

      return {
        ...state,
        layout: {
          ...state.layout,
          sections: state.layout.sections.filter((s) => s.id !== sectionId),
        },
        selectedSectionId: state.selectedSectionId === sectionId ? null : state.selectedSectionId,
        isDirty: true,
      };
    }

    case 'UPDATE_SECTION': {
      const { id, updates } = action.payload;

      return {
        ...state,
        layout: {
          ...state.layout,
          sections: state.layout.sections.map((s) =>
            s.id === id ? { ...s, ...updates } : s
          ),
        },
        isDirty: true,
      };
    }

    case 'REORDER_SECTIONS': {
      const newSections: any[] = action.payload;

      return {
        ...state,
        layout: {
          ...state.layout,
          sections: newSections.map((s, idx) => ({ ...s, order: idx })),
        },
        isDirty: true,
      };
    }

    case 'SELECT_SECTION': {
      return {
        ...state,
        selectedSectionId: action.payload || null,
      };
    }

    case 'UPDATE_THEME': {
      return {
        ...state,
        layout: {
          ...state.layout,
          theme: { ...state.layout.theme, ...action.payload },
        },
        isDirty: true,
      };
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

      return {
        ...state,
        layout: {
          ...state.layout,
          sections: state.layout.sections.map((s) =>
            s.id === id ? { ...s, gridPosition: position } : s
          ),
        },
        isDirty: true,
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

  return {
    state,
    actions: {
      addSection,
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
    },
  };
}
