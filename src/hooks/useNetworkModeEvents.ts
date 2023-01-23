import React, { useCallback, useEffect, useState } from 'react';
import {
  subscribeToEvent,
  EventType,
  unSubscribeToEvent,
} from '../helpers/custom-event.helper';
import neo4jService from '../services/neo4j.service';
import { v4 as uuidv4 } from 'uuid';

export function useNetworkModeEvents() {
  const [addNodeData, setAddNodeData] = useState<any>(null);
  const [node, setNode] = useState<any>(null);
  const [edge, setEdge] = useState<any>(null);
  const [edgeData, setEdgeData] = useState<any>(null);

  const handleAddNodeCallback = useCallback((event: any) => {
    const { detail } = event;
    setNode(detail.data);
    setAddNodeData(detail);
  }, []);

  const handleEditNodeCallback = useCallback(
    (event: any) => {
      const { detail } = event;
      setNode({ ...node, ...detail.data });
      setAddNodeData(detail);
    },
    [node],
  );

  const handleEditEdge = useCallback(
    async ({ detail }: any) => {
      await neo4jService.updateEdgeLinks(edge, detail.data);
      setEdgeData(detail);
    },
    [edge],
  );

  const handleAddEdge = useCallback(async ({ detail }: any) => {
    setNode(null);
    setEdge({ properties: { id: uuidv4() }, ...detail.data });
    setEdgeData(detail);
    detail.callback(detail.data);
  }, []);

  useEffect(() => {
    subscribeToEvent(EventType.ADD_NODE, handleAddNodeCallback);
    subscribeToEvent(EventType.EDIT_NODE, handleEditNodeCallback);
    subscribeToEvent(EventType.EDIT_EDGE, handleEditEdge);
    subscribeToEvent(EventType.ADD_EDGE, handleAddEdge);
    return () => {
      unSubscribeToEvent(EventType.ADD_NODE, handleAddNodeCallback);
      unSubscribeToEvent(EventType.EDIT_NODE, handleEditNodeCallback);
      unSubscribeToEvent(EventType.EDIT_EDGE, handleEditEdge);
      unSubscribeToEvent(EventType.ADD_EDGE, handleAddEdge);
    };
  }, [edge, node]);

  return {
    addNodeData,
    edge,
    node,
    edgeData,
    setNode,
    setEdge,
  };
}
