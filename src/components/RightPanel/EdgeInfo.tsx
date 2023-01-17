import React, { useState } from 'react';
import { Network } from 'vis-network';
import neo4jService from '../../services/neo4j.service';

interface IEdgeInfoProps {
  edge: any;
  setEdge: React.Dispatch<any>;
  network: Network;
  edgeData: any;
}

export default function EdgeInfo({
  edge,
  setEdge,
  network,
  edgeData,
}: IEdgeInfoProps) {
  const [editionMode, setEditionMode] = useState<boolean>(false);
  const [newProperty, setNewProperty] = useState<any>({});

  // TODO manage label remove whe updating one
  // (at the moment, only add a new one)
  const handleSaveEdge = async () => {
    if (edgeData) {
      const cloneData: any = { ...edgeData.data };
      cloneData.id = edge.id;
      cloneData.label = edge.label;
      cloneData.properties = edge.properties;
      edgeData.callback(cloneData);
    }
    await neo4jService.updateEdgeProperties(edge.id, edge.properties);
    await neo4jService.updateNodeLabel(edge.id, [edge.label]);
  };

  // FIXME when cancel change without editing graph relation,
  // edge does not get his old data. (because edgeData is null)
  const cancelEdit = () => {
    network?.disableEditMode();
    if (edgeData) setEdge({ ...edge, ...edgeData.data });
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
      {editionMode && (
        <div>
          Click on the control points and drag them to a node to connect to it.
        </div>
      )}
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
            <button onClick={() => handleSaveEdge()}>Save edge</button>
          </div>
        ) : (
          <button onClick={() => handleEdition()}>Edit edge</button>
        )}
      </div>
    </div>
  );
}
