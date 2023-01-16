import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import {
  subscribeToEvent,
  EventType,
  unSubscribeToEvent,
} from '../helpers/custom-event.helper';
import { useAppSelector } from '../hooks';
import neo4jService from '../services/neo4j.service';

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

export default function RightPanel() {
  const { selectedNodes, selectedEdges, network } = useAppSelector(
    (state) => state.appDatas,
  );

  const [editionMode, setEditionMode] = useState<boolean>(false);
  const [toEdit, setToEdit] = useState<any>(null);

  const [displayModal, setDisplayModal] = useState<boolean>(false);
  const [node, setNode] = useState<any>(null);
  const [addNodeData, setAddNodeData] = useState<any>(null);
  const [newProperty, setNewProperty] = useState<any>({});

  const handleId = (e: any) => {
    setNode({ ...node, id: e.target.value });
  };
  const handleLabel = (e: any) => {
    setNode({ ...node, label: e.target.value });
  };

  // TODO manage label remove whe updating one
  // (at the moment, only add a new one)
  const handleSaveNode = async () => {
    const cloneData = { ...addNodeData.data };
    cloneData.id = node.id;
    cloneData.label = node.label;
    cloneData.properties = node.properties;
    addNodeData.callback(cloneData);
    await neo4jService.updateNodeProperties(node.id, node.properties);
    await neo4jService.updateNodeLabel(node.id, [node.label]);
    setDisplayModal(false);
  };

  const handleAddNodeCallback = (event: any) => {
    console.log('edit');
    const { detail } = event;
    setNode({ ...node, ...detail.data });
    setAddNodeData(detail);
    setDisplayModal(true);
  };

  const cancelEdit = () => {
    network?.disableEditMode();
    setNode({ ...node, ...addNodeData.data });
    setEditionMode(false);
  };

  useEffect(() => {
    subscribeToEvent(EventType.ADD_NODE, handleAddNodeCallback);
    return () => {
      unSubscribeToEvent(EventType.ADD_NODE, handleAddNodeCallback);
    };
  }, []);

  useEffect(() => {
    if (selectedNodes.length) setNode({ ...selectedNodes[0] });
    else setNode(null);
  }, [selectedNodes]);

  const handleEdition = () => {
    network?.enableEditMode();
    network?.editNode();
    setEditionMode(true);
  };

  const handleOnChangeProperty = (key: string, value: string) => {
    setNode({ ...node, properties: { ...node.properties, [key]: value } });
  };

  const handleAddProperty = () => {
    setNode({
      ...node,
      properties: { ...node.properties, [newProperty.key]: newProperty.value },
    });
    setNewProperty({});
  };

  const handleRemoveProperty = (key: string) => {
    setNode({
      ...node,
      properties: { ...node.properties, [key]: null },
    });
  };

  return (
    <>
      {/** // TODO change condition to include edges edition */}
      {node && (
        <RightPanelContainer>
          {node && (
            <div className="node-item">
              <div className="node-item-data">
                <span>Id:</span> <span>{node.id}</span>
              </div>
              <div className="node-item-data">
                <span className="flex-1">Label:</span>{' '}
                {editionMode ? (
                  <input
                    type={'text'}
                    className="text-right flex-3"
                    value={node.label}
                    onChange={handleLabel}
                  />
                ) : (
                  <div>{node.label}</div>
                )}
              </div>
              <div className="node-item-properties">
                <span>Properties:</span>
                {Object.keys(node.properties).map((key) => {
                  if (node.properties[key] === null) return;
                  return (
                    <div className="flex justify-between ml-2">
                      <div className="flex-1">{key}</div>
                      {editionMode ? (
                        <>
                          <input
                            className="text-right w-100 flex-3"
                            onChange={(e: any) =>
                              handleOnChangeProperty(key, e.target.value)
                            }
                            value={node.properties[key]}
                          />
                          <button
                            onClick={() => handleRemoveProperty(key)}
                            style={{ background: 'red' }}
                            title="remove"
                          >
                            X
                          </button>
                        </>
                      ) : (
                        <div>{`${node.properties[key]}`}</div>
                      )}
                    </div>
                  );
                })}
              </div>
              {editionMode && (
                <div className="f-column gap-5 mt-2">
                  <div className="fw-700">Add new property</div>
                  <div>
                    <div className="fw-700">Name:</div>
                    <input
                      type={'text'}
                      className="w-100"
                      placeholder="name of the property"
                      onChange={(e: any) =>
                        setNewProperty({
                          ...newProperty,
                          key: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <div className="fw-700">Value:</div>
                    <input
                      type={'text'}
                      placeholder="value of the property"
                      className="w-100"
                      onChange={(e: any) =>
                        setNewProperty({
                          ...newProperty,
                          value: e.target.value,
                        })
                      }
                    />
                  </div>
                  <button onClick={handleAddProperty}>Add property</button>
                </div>
              )}
              {editionMode ? (
                <div className="flex gap-10">
                  <button onClick={cancelEdit}>Cancel</button>
                  <button onClick={() => handleSaveNode()}>Save node</button>
                </div>
              ) : (
                <button onClick={() => handleEdition()}>Edit node</button>
              )}
            </div>
          )}
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
        </RightPanelContainer>
      )}
    </>
  );
}
