import React from 'react';
import styled from 'styled-components';
import { networkDataState, useAppSelector } from '../hooks';
import EdgeInfo from './RightPanel/EdgeInfo';
import NodeInfo from './RightPanel/NodeInfo';

const RightPanelContainer = styled.div`
  position: absolute;
  right: 0;
  top: 0;
  width: 300px;
  display: flex;
  flex-direction: column;
  padding: 50px 10px;
  background-color: lightgray;
  height: 100vh;
  .node-item {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .node-item > .node-item-data {
    display: flex;
    justify-content: space-between;
  }
  .node-item > .node-item-data :first-child {
    font-weight: bold;
  }
  .node-item > .node-item-data > div[contentEditable='true'] {
    padding: 3px 6px;
    border: 1px solid black;
    background: white;
  }
  .node-item > .node-item-properties > div > div[contentEditable='true'] {
    padding: 3px 6px;
    border: 1px solid black;
    background: white;
  }
  .node-item > .node-item-properties {
    display: flex;
    flex-direction: column;
  }
  .node-item > .node-item-properties :first-child {
    font-weight: bold;
  }
`;

interface IRightPanelProps {
  node: any;
  setNode: React.Dispatch<any>;
  addNodeData: any;
  edge: any;
  setEdge: React.Dispatch<any>;
  edgeData: any;
}

export default function RightPanel({
  node,
  setNode,
  addNodeData,
  edge,
  setEdge,
  edgeData,
}: IRightPanelProps) {
  const { network } = useAppSelector(networkDataState);

  return (
    <>
      <RightPanelContainer>
        {node && (
          <NodeInfo
            node={node}
            setNode={setNode}
            network={network!}
            addNodeData={addNodeData}
          />
        )}
        {edge && (
          <EdgeInfo
            edgeData={edgeData}
            network={network!}
            edge={edge}
            setEdge={setEdge}
          />
        )}
      </RightPanelContainer>
    </>
  );
}
