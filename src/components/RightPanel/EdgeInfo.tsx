import React, { useState } from 'react';
import { v4 } from 'uuid';
import { Network } from 'vis-network';
import { createEdge } from '../../helpers/data-creation.helper';
import { networkDataState, useAppDispatch, useAppSelector } from '../../hooks';
import neo4jService from '../../services/neo4j.service';
import { setAddEdgeMode, setEditEdgeMode } from '../../slices/network.slice';

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
  const [newProperty, setNewProperty] = useState<any>({});
  const { addEdgeMode, editEdgeMode } = useAppSelector(networkDataState);
  const dispatch = useAppDispatch();

  // TODO manage label remove whe updating one
  // (at the moment, only add a new one)
  const handleSaveEdge = async () => {
    if (edgeData) {
      const cloneData: any = { ...edgeData.data };
      cloneData.label = edge.label;
      cloneData.labels = [edge.label];
      cloneData.properties = edge.properties;
      const newEdge = createEdge(cloneData);
      if (addEdgeMode) {
        await neo4jService.createEdge(newEdge);
        dispatch(setAddEdgeMode(false));
        network!.updateEdge(cloneData.id, { ...cloneData, ...newEdge });
      } else {
        await neo4jService.updateEdgeProperties(
          edge.properties.id,
          edge.properties,
        );
        await neo4jService.updateEdgeLinks(cloneData, cloneData);
        dispatch(setEditEdgeMode(false));
        edgeData.callback({ ...cloneData, ...newEdge });
      }
    }
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

  const canEdit = editEdgeMode || addEdgeMode;

  return (
    <div className="node-item">
      <div className="node-item-data">
        <span>Id:</span> <span>{edge.id}</span>
      </div>
      <div className="node-item-data">
        <span className="flex-1">Label:</span>{' '}
        {canEdit ? (
          <input
            type={'text'}
            className="text-right flex-3"
            value={edge.label}
            onChange={handleLabel}
          />
        ) : (
          <div>{edge.label}</div>
        )}
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
              <div className="flex-1 mr-3">{key}</div>
              {canEdit ? (
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
                <div className="text-ellipsis">{`${edge.properties[key]}`}</div>
              )}
            </div>
          );
        })}
        {canEdit && (
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
        {canEdit && (
          <div className="flex gap-10">
            <button onClick={() => handleSaveEdge()}>Save edge</button>
          </div>
        )}
      </div>
    </div>
  );
}
