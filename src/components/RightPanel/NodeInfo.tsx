import React, { useState } from 'react';
import { Network } from 'vis-network';
import { createNode } from '../../helpers/data-creation.helper';
import { networkDataState, useAppDispatch, useAppSelector } from '../../hooks';
import neo4jService from '../../services/neo4j.service';
import { addNode, updateNode } from '../../slices/app.slice';
import { setAddNodeMode, setEditNodeMode } from '../../slices/network.slice';

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
  const [newProperty, setNewProperty] = useState<any>({ key: '', value: '' });

  const dispatch = useAppDispatch();
  const { addNodeMode, editNodeMode } = useAppSelector(networkDataState);

  // TODO manage label remove the updating one
  // (at the moment, only add a new one)
  const handleSaveNode = async () => {
    const cloneData = { ...addNodeData.data };
    cloneData.id = node.id;
    cloneData.label = node.label;
    cloneData.labels = [node.label];
    cloneData.properties = node.properties;
    const createdNode = createNode(cloneData);
    addNodeData.callback({ ...cloneData, ...createdNode });
    if (addNodeMode) {
      neo4jService.createNode(createdNode);
      dispatch(addNode(createdNode));
      dispatch(setAddNodeMode(false));
    } else {
      await neo4jService.updateNodeProperties(
        node.properties.id,
        node.properties,
      );
      await neo4jService.updateNodeLabel(node.properties.id, [node.label]);
      dispatch(setEditNodeMode(false));
      dispatch(updateNode(createdNode));
    }
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
    setNewProperty({ key: '', value: '' });
  };

  const handleRemoveProperty = (key: string) => {
    setNode({
      ...node,
      properties: { ...node.properties, [key]: null },
    });
  };

  const canEdit = addNodeMode || editNodeMode;

  return (
    <div className="node-item">
      <div className="node-item-data">
        <span>Id:</span> <span>{node.id}</span>
      </div>
      <div className="node-item-data">
        <span className="flex-1">Label:</span>{' '}
        {canEdit ? (
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
        {node.properties &&
          Object.keys(node.properties).map((key) => {
            if (node.properties[key] === null) return;
            return (
              <div key={key} className="flex justify-between ml-2 mb-2">
                <div className="flex-1 mr-3">{key}</div>
                {canEdit ? (
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
                  <div className="text-ellipsis">{`${node.properties[key]}`}</div>
                )}
              </div>
            );
          })}
      </div>
      {canEdit && (
        <div className="f-column gap-5 mt-2">
          <div className="fw-700">Add new property</div>
          <div>
            <div className="fw-700">Name:</div>
            <input
              type={'text'}
              className="w-100"
              placeholder="name of the property"
              value={newProperty.key}
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
              value={newProperty.value}
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
      {canEdit && (
        <div className="flex gap-10">
          <button onClick={() => handleSaveNode()}>Save node</button>
        </div>
      )}
    </div>
  );
}
