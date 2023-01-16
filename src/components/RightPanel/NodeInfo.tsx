import React, { useState } from 'react';
import { Network } from 'vis-network';
import neo4jService from '../../services/neo4j.service';

interface INodeInfoProps {
  node: any;
  setNode: React.Dispatch<any>;
  network: Network;
  addNodeData: any;
}

export default function NodeInfo({
  node,
  setNode,
  addNodeData,
  network,
}: INodeInfoProps) {
  const [editionMode, setEditionMode] = useState<boolean>(false);
  const [newProperty, setNewProperty] = useState<any>({});

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
  };

  const cancelEdit = () => {
    network?.disableEditMode();
    setNode({ ...node, ...addNodeData.data });
    setEditionMode(false);
  };

  const handleEdition = () => {
    network?.enableEditMode();
    network?.editNode();
    setEditionMode(true);
  };

  const handleLabel = (e: any) => {
    setNode({ ...node, label: e.target.value });
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
  );
}
