import React, { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../hooks';
import {
  setEdges,
  setIsolatedMode,
  setNetwork,
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

const GraphContainer = styled.div`
  width: 100vw;
  height: 100vh;
`;

export default function Graph() {
  const dispatch = useAppDispatch();
  const { network, nodes, edges, selectedNodes, selectedEdges } =
    useAppSelector((state) => state.appDatas);

  const [node, setNode] = useState<any>(null);
  const [addNodeData, setAddNodeData] = useState<any>(null);
  const [edge, setEdge] = useState<any>(null);
  const [edgeData, setEdgeData] = useState<any>(null);

  const handleOnCLick = (data: any) => {
    dispatch(setSelections(data));
  };

  const handleDoubleClick = async (data: any) => {
    const res = await neo4jService.getNodeAndRelations(data.nodes[0]);
    dispatch(setNodes(res));
    dispatch(setEdges(res));
    dispatch(setIsolatedMode(true));
  };

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
  }, [network]);

  const handleAddNodeCallback = (event: any) => {
    console.log('edit');
    const { detail } = event;
    setNode({ ...node, ...detail.data });
    setAddNodeData(detail);
  };

  const handleEditEdge = async ({ detail }: any) => {
    console.log('edit edge');
    console.log(detail);
    await neo4jService.updateEdgeLinks(edge, detail.data);
    setEdgeData(detail);
  };

  useEffect(() => {
    subscribeToEvent(EventType.ADD_NODE, handleAddNodeCallback);
    subscribeToEvent(EventType.EDIT_EDGE, handleEditEdge);
    return () => {
      unSubscribeToEvent(EventType.ADD_NODE, handleAddNodeCallback);
      unSubscribeToEvent(EventType.EDIT_EDGE, handleEditEdge);
    };
  }, [edge]);

  useEffect(() => {
    if (selectedNodes.length) setNode({ ...selectedNodes[0] });
    else setNode(null);
    if (selectedEdges.length) setEdge({ ...selectedEdges[0] });
    else setEdge(null);
  }, [selectedNodes, selectedEdges]);

  return (
    <>
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
