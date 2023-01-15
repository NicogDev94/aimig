import React, { useEffect, useState } from 'react';
import {
  EventType,
  subscribeToEvent,
  unSubscribeToEvent,
} from '../helpers/custom-event.helper';

export default function NodeModal() {
  const [displayModal, setDisplayModal] = useState<boolean>(false);
  const [node, setNode] = useState<any>({});
  const [addNodeData, setAddNodeData] = useState<any>(null);

  const handleId = (e: any) => {
    setNode({ ...node, id: e.target.value });
  };
  const handleLabel = (e: any) => {
    setNode({ ...node, label: e.target.value });
  };

  const handleSaveNode = () => {
    const cloneData = { ...addNodeData.data };
    cloneData.id = node.id;
    cloneData.label = node.label;
    console.log(cloneData)
    addNodeData.callback(cloneData);
    setDisplayModal(false);
  };

  const handleAddNodeCallback = (event: any) => {
    const { detail } = event;
    setNode({ ...node, id: detail.data.id, label: detail.data.label });
    setAddNodeData(detail);
    setDisplayModal(true);
  };

  useEffect(() => {
    subscribeToEvent(EventType.ADD_NODE, handleAddNodeCallback);
    return () => {
      unSubscribeToEvent(EventType.ADD_NODE, handleAddNodeCallback);
    };
  }, []);

  return (
    <>
      {displayModal && (
        <div
          style={{
            position: 'absolute',
            zIndex: 999,
            width: '100vw',
            height: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.2)',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: 'white',
              width: 200,
              borderRadius: 10,
              padding: '10px 15px',
              gap: 10,
            }}
          >
            <div>
              Node id:
              <input value={node.id} type={'text'} onChange={handleId} />
            </div>
            <div>
              Label:
              <input value={node.label} type={'text'} onChange={handleLabel} />
            </div>
            <button style={{ margin: 'auto' }} onClick={handleSaveNode}>
              Save node
            </button>
          </div>
        </div>
      )}
    </>
  );
}
