import React, { useState } from 'react';
import { Network } from 'vis-network';

interface IEdgeInfoProps {
  edge: any;
  setEdge: React.Dispatch<any>;
  network: Network;
}

export default function EdgeInfo({ edge, setEdge, network }: IEdgeInfoProps) {
  const [editionMode, setEditionMode] = useState<boolean>(false);
  const [newProperty, setNewProperty] = useState<any>({});

  // TODO manage label remove whe updating one
  // (at the moment, only add a new one)
  const handleSaveNode = async () => {
    const cloneData: any = {};
    // { ...addNodeData.data };
    cloneData.id = edge.id;
    cloneData.label = edge.label;
    cloneData.properties = edge.properties;
    // addNodeData.callback(cloneData);
    // await neo4jService.updateNodeProperties(edge.id, edge.properties);
    // await neo4jService.updateNodeLabel(edge.id, [edge.label]);
  };

  const cancelEdit = () => {
    network?.disableEditMode();
    // setEdge({ ...edge, ...addNodeData.data });
    setEditionMode(false);
  };

  const handleEdition = () => {
    network?.enableEditMode();
    network?.editEdgeMode();
    setEditionMode(true);
  };

  const handleLabel = (e: any) => {
    setEdge({ ...edge, label: e.target.value });
  };

  const handleOnChangeProperty = (key: string, value: string) => {
    setEdge({ ...edge, properties: { ...edge.properties, [key]: value } });
  };

  const handleAddProperty = () => {
    setEdge({
      ...edge,
      properties: { ...edge.properties, [newProperty.key]: newProperty.value },
    });
    setNewProperty({});
  };

  const handleRemoveProperty = (key: string) => {
    setEdge({
      ...edge,
      properties: { ...edge.properties, [key]: null },
    });
  };

  return (
    <div className="node-item">
      <div className="node-item-data">
        <span>Id:</span> <span>{edge.id}</span>
      </div>
      <div className="node-item-data">
        <span>Type:</span> <span>{edge.label}</span>
      </div>
      <div className="node-item-data">
        <span>From:</span> <span>{edge.from}</span>
      </div>
      <div className="node-item-data">
        <span>To:</span> <span>{edge.to}</span>
      </div>
      <div className="node-item-properties">
        <span>Properties:</span>
        {Object.keys(edge.properties).map((key) => {
          if (edge.properties[key] === null) return;
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
                    value={edge.properties[key]}
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
                <div>{`${edge.properties[key]}`}</div>
              )}
            </div>
          );
        })}
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
    </div>
  );
}