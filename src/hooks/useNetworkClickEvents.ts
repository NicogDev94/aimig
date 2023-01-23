import { uniqBy } from 'lodash';
import { useCallback, useEffect } from 'react';
import {
  appDataState,
  networkDataState,
  useAppDispatch,
  useAppSelector,
} from '../hooks';
import neo4jService from '../services/neo4j.service';
import {
  setEdges,
  setIsolatedMode,
  setNodes,
  setSelections,
} from '../slices/app.slice';

export function useNetworkClickEvents() {
  const { nodes } = useAppSelector(appDataState);
  const { network } = useAppSelector(networkDataState);

  const dispatch = useAppDispatch();

  const handleOnCLick = useCallback((data: any) => {
    dispatch(setSelections(data));
  }, []);

  const handleDoubleClick = useCallback(
    async (data: any) => {
      const node = nodes.find((n) => n.id === data.nodes[0]);
      if (node && node.properties.id) {
        const res = await neo4jService.getNodeAndHisRelations(
          node.properties.id,
        );
        dispatch(setNodes(uniqBy(res.nodes, (n) => n.elementId)));
        dispatch(setEdges(uniqBy(res.edges, (e) => e.elementId)));
        dispatch(setIsolatedMode(true));
      }
    },
    [nodes],
  );

  useEffect(() => {
    if (network) {
      network.on('click', handleOnCLick);
      network.on('doubleClick', handleDoubleClick);
    }
    return () => {
      if (network) {
        network.off('click', handleOnCLick);
        network.off('doubleClick', handleDoubleClick);
      }
    };
  }, [network, nodes]);
}
