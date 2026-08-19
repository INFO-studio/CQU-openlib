import { useEffect, useState } from 'react';
import { loadCampusItems } from '../data';
import type { CampusDataStatus, CampusId, MapItem } from '../type';

export const useCampusItems = (campusId: CampusId) => {
  const [state, setState] = useState<{
    campusId: CampusId;
    status: CampusDataStatus;
    items: readonly MapItem[];
  } | null>(null);

  useEffect(() => {
    let active = true;
    setState({
      campusId,
      status: 'loading',
      items: [],
    });
    void loadCampusItems(campusId).then(
      (items) => {
        if (active) setState({ campusId, status: 'ready', items });
      },
      () => {
        if (active) {
          setState({
            campusId,
            status: 'error',
            items: [],
          });
        }
      },
    );
    return () => {
      active = false;
    };
  }, [campusId]);

  if (state?.campusId === campusId) return state;
  return {
    campusId,
    status: 'loading' as const,
    items: [],
  };
};
