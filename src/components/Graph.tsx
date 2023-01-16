import React, { useEffect } from 'react';
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

const GraphContainer = styled.div`
  width: 100vw;
  height: 100vh;
`;

export default function Graph() {
  const dispatch = useAppDispatch();
  const { network,nodes, edges } =
    useAppSelector((state) => state.appDatas);

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

  return (
    <>
      <GraphContainer
        id="mynetwork"
        style={{ width: '100vw', height: '100vh' }}
      ></GraphContainer>
      <RightPanel />
    </>
  );
}
