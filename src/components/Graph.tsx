import React, { useCallback, useEffect, useState } from 'react';
import {
  appDataState,
  networkDataState,
  useAppDispatch,
  useAppSelector,
} from '../hooks';
import {
  setEdges,
  setIsolatedMode,
  setNodes,
  setSelections,
} from '../slices/app.slice';
import styled from 'styled-components';
import neo4jService from '../services/neo4j.service';
import { getOptions } from '../constants/constants';
import { Network } from 'vis-network';
import RightPanel from './RightPanel';
import {
  subscribeToEvent,
  EventType,
  unSubscribeToEvent,
} from '../helpers/custom-event.helper';
import { v4 as uuidv4 } from 'uuid';
import {
  setAddEdgeMode,
  setAddNodeMode,
  setEditEdgeMode,
  setEditMode,
  setEditNodeMode,
  setNetwork,
} from '../slices/network.slice';
import { uniqBy } from 'lodash';
import { useNetworkClickEvents } from '../hooks/useNetworkClickEvents';
import { useNetworkModeEvents } from '../hooks/useNetworkModeEvents';
import ActionButtons from './ActionButtons';

const GraphContainer = styled.div`
  width: 100vw;
  height: 100vh;
`;

export default function Graph() {
  // selector
  const { nodes, edges, selectedEdges, selectedNodes } =
    useAppSelector(appDataState);
  const { network, addNodeMode } = useAppSelector(networkDataState);

  // Custom hook
  useNetworkClickEvents();
  const { node, addNodeData, edge, edgeData, setEdge, setNode } =
    useNetworkModeEvents();

  const dispatch = useAppDispatch();

  useEffect(() => {
    if (selectedNodes.length) setNode({ ...selectedNodes[0] });
    else if (!addNodeMode) setNode(null);
    if (selectedEdges.length) setEdge({ ...selectedEdges[0] });
    else setEdge(null);
  }, [selectedNodes, selectedEdges]);

  useEffect(() => {
    // Add user to the state array
    var options: any = getOptions();
    if (network) {
      network.setData({ nodes: nodes, edges: edges });
    } else {
      const container = document.getElementById('mynetwork');
      if (container) {
        const network = new Network(
          container,
          { nodes: nodes, edges: edges },
          options,
        );
        dispatch(setNetwork(network));
      }
    }
  }, [nodes, edges, network]);

  return (
    <>
      <ActionButtons
        addNodeData={addNodeData}
        edgeData={edgeData}
        node={node}
        edge={edge}
      />
      <GraphContainer
        id="mynetwork"
        style={{ width: '100vw', height: '100vh' }}
      ></GraphContainer>
      {(node || edge) && (
        <RightPanel
          addNodeData={addNodeData}
          node={node}
          setNode={setNode}
          edge={edge}
          setEdge={setEdge}
          edgeData={edgeData}
        />
      )}
    </>
  );
}
