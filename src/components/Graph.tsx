import React, { useEffect } from 'react';
import {
  appDataState,
  networkDataState,
  useAppDispatch,
  useAppSelector,
} from '../hooks';
import styled from 'styled-components';
import { getOptions } from '../constants/constants';
import { Network } from 'vis-network';
import RightPanel from './RightPanel';
import { useNetworkClickEvents } from '../hooks/useNetworkClickEvents';
import { useNetworkModeEvents } from '../hooks/useNetworkModeEvents';
import ActionButtons from './ActionButtons';
import { setNetwork, setNetworkData } from '../slices/network.slice';

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
    const container = document.getElementById('mynetwork');
    if (container) {
      const network = new Network(
        container,
        { nodes: nodes, edges: edges },
        options,
      );
      dispatch(setNetwork(network));
    }
  }, []);

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
