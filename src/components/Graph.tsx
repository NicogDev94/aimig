import React, { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../hooks';
import {
  setEdges,
  setIsolatedMode,
  setNodes,
  setSelections,
} from '../slices/app.slice';
import styled from 'styled-components';
import neo4jService from '../services/neo4j.service';

const GraphContainer = styled.div`
  width: 100vw;
  height: 100vh;
`;

const RightPanel = styled.div`
  position: absolute;
  right: 0;
  top: 0;
  width: 200px;
  display: flex;
  flex-direction: column;
  padding: 50px 10px;
  background-color: lightgray;
  height: 100vh;
  .node-item {
  }
  .node-item > .node-item-data {
    display: flex;
    justify-content: space-between;
  }
  .node-item > .node-item-data :first-child {
    font-weight: bold;
  }
  .node-item > .node-item-properties {
    display: flex;
    flex-direction: column;
  }
  .node-item > .node-item-properties :first-child {
    font-weight: bold;
  }
`;

export default function Graph() {
  const dispatch = useAppDispatch();
  const { network, selectedNodes, selectedEdges, nodes, edges } =
    useAppSelector((state) => state.appDatas);

  const handleOnCLick = (data: any) => {
    console.log(data);
    dispatch(setSelections(data));
  };

  const handleDoubleClick = async (data: any) => {
    const res = await neo4jService.getNodeAndRelations(data.nodes[0]);
    dispatch(setNodes(res));
    dispatch(setEdges(res));
    dispatch(setIsolatedMode(true));
  };
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
      {(selectedNodes.length > 0 || selectedEdges.length > 0) && (
        <RightPanel>
          {selectedNodes.map((n) => {
            return (
              <div className="node-item">
                <div className="node-item-data">
                  <span>Id:</span> <span>{n.id}</span>
                </div>
                <div className="node-item-data">
                  <span>Label:</span> <span>{n.label}</span>
                </div>
                <div className="node-item-properties">
                  <span>Properties:</span>
                  {Object.keys(n.properties).map((key) => {
                    return (
                      <div className="flex justify-between ml-2">
                        <div>{key}</div>
                        <div>{n.properties[key]}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {selectedEdges.map((n) => {
            return (
              <div className="node-item">
                <div className="node-item-data">
                  <span>Id:</span> <span>{n.id}</span>
                </div>
                <div className="node-item-data">
                  <span>Type:</span> <span>{n.type}</span>
                </div>
                <div className="node-item-data">
                  <span>From:</span> <span>{n.from}</span>
                </div>
                <div className="node-item-data">
                  <span>To:</span> <span>{n.to}</span>
                </div>
                <div className="node-item-properties">
                  <span>Properties:</span>
                  {Object.keys(n.properties).map((key) => {
                    return (
                      <div className="flex justify-between ml-2">
                        <div>{key}</div>
                        <div>{n.properties[key]}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </RightPanel>
      )}
    </>
  );
}
