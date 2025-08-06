import { useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/api';

export interface AppState {
  apps: any[];
  currentApp: any;
  appData: Record<string, any[]>;
  loading: boolean;
  error: string | null;
}

export function useAppState() {
  const [state, setState] = useState<AppState>({
    apps: [],
    currentApp: null,
    appData: {},
    loading: false,
    error: null,
  });

  // Load all apps
  const loadApps = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    const response = await apiService.getApps();
    
    if (response.error) {
      setState(prev => ({ ...prev, loading: false, error: response.error || null }));
    } else {
      setState(prev => ({ ...prev, loading: false, apps: response.data }));
    }
  }, []);

  // Create a new app
  const createApp = useCallback(async (name: string, spec: any) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    const response = await apiService.createApp(name, spec);
    
    if (response.error) {
      setState(prev => ({ ...prev, loading: false, error: response.error || null }));
      return null;
    } else {
      setState(prev => ({ 
        ...prev, 
        loading: false, 
        apps: [response.data, ...prev.apps],
        currentApp: response.data 
      }));
      return response.data;
    }
  }, []);

  // Load data for a collection
  const loadData = useCallback(async (collection: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    const response = await apiService.getData(collection);
    
    if (response.error) {
      setState(prev => ({ ...prev, loading: false, error: response.error || null }));
    } else {
      setState(prev => ({ 
        ...prev, 
        loading: false, 
        appData: { ...prev.appData, [collection]: response.data }
      }));
    }
  }, []);

  // Create data in a collection
  const createData = useCallback(async (collection: string, data: any) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    const response = await apiService.createData(collection, data);
    
    if (response.error) {
      setState(prev => ({ ...prev, loading: false, error: response.error || null }));
      return null;
    } else {
      setState(prev => ({ 
        ...prev, 
        loading: false,
        appData: {
          ...prev.appData,
          [collection]: [response.data, ...(prev.appData[collection] || [])]
        }
      }));
      return response.data;
    }
  }, []);

  // Update data in a collection
  const updateData = useCallback(async (collection: string, id: number, data: any) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    const response = await apiService.updateData(collection, id, data);
    
    if (response.error) {
      setState(prev => ({ ...prev, loading: false, error: response.error || null }));
      return null;
    } else {
      setState(prev => ({ 
        ...prev, 
        loading: false,
        appData: {
          ...prev.appData,
          [collection]: (prev.appData[collection] || []).map(item => 
            item.id === id ? response.data : item
          )
        }
      }));
      return response.data;
    }
  }, []);

  // Delete data from a collection
  const deleteData = useCallback(async (collection: string, id: number) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    const response = await apiService.deleteData(collection, id);
    
    if (response.error) {
      setState(prev => ({ ...prev, loading: false, error: response.error || null }));
      return false;
    } else {
      setState(prev => ({ 
        ...prev, 
        loading: false,
        appData: {
          ...prev.appData,
          [collection]: (prev.appData[collection] || []).filter(item => item.id !== id)
        }
      }));
      return true;
    }
  }, []);

  return {
    ...state,
    loadApps,
    createApp,
    loadData,
    createData,
    updateData,
    deleteData,
  };
}