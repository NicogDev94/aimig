import React, { useCallback } from 'react';
import { networkDataState, useAppDispatch, useAppSelector } from '../hooks';
import {
  setAddEdgeMode,
  setAddNodeMode,
  setEditMode,
  setEditNodeMode,
  setEditEdgeMode,
} from '../slices/network.slice';

interface IActionButtonsProps {
  node: any;
  edge: any;
  addNodeData: any;
  edgeData: any;
}

export default function ActionButtons({
  node,
  edge,
  addNodeData,
  edgeData,
}: IActionButtonsProps) {
  const dispatch = useAppDispatch();

  const { addEdgeMode, addNodeMode, editEdgeMode, editMode, editNodeMode } =
    useAppSelector(networkDataState);

  const onClickAddEdge = useCallback(() => {
    dispatch(setAddEdgeMode(true));
  }, []);
  const onClickAddNode = useCallback(() => {
    dispatch(setAddNodeMode(true));
  }, []);

  const onClickEdit = useCallback(() => {
    dispatch(setEditMode(true));
  }, []);

  const onClickNodeEdition = useCallback(() => {
    dispatch(setEditNodeMode(true));
  }, []);

  const onClickEdgeEdition = useCallback(() => {
    dispatch(setEditEdgeMode(true));
  }, []);

  // FIXME when cancel change without editing graph relation,
  // edge does not get his old data. (because edgeData is null)
  const onClickCancel = useCallback(() => {
    if (edgeData) edgeData.callback(null);
    if (addNodeData) addNodeData.callback(null);
    dispatch(setEditMode(false));
    dispatch(setAddNodeMode(false));
    dispatch(setEditNodeMode(false));
    dispatch(setEditEdgeMode(false));
    dispatch(setAddEdgeMode(false));
  }, []);

  return (
    <div style={{ top: 5, left: 5, zIndex: 99 }} className="absolute">
      {(addEdgeMode || addNodeMode || editEdgeMode || editNodeMode) && (
        <button onClick={onClickCancel}>Cancel</button>
      )}
      {!editMode && (
        <button onClick={onClickEdit}>
          <i className="fa-solid fa-pen mr-2"></i>Edit
        </button>
      )}
      {editMode && (
        <div className="flex gap-10">
          {!addNodeMode && !addEdgeMode && (
            <button onClick={onClickAddNode}>
              <i className="fa-solid fa-circle-plus mr-2"></i>Add node
            </button>
          )}
          {!addEdgeMode && (
            <button onClick={onClickAddEdge}>
              <i className="fa-solid fa-circle-plus mr-2"></i>Add edge
            </button>
          )}

          {node && !addEdgeMode && !addNodeMode && (
            <button onClick={() => onClickNodeEdition()}>
              <i className="fa-solid fa-pen mr-2"></i>Edit node
            </button>
          )}
          {edge && !addEdgeMode && (
            <button onClick={() => onClickEdgeEdition()}>
              <i className="fa-solid fa-pen mr-2"></i>Edit edge
            </button>
          )}
          {(addEdgeMode || editEdgeMode) && (
            <div>
              Click on a node and drag the edge to another node to connect them.
            </div>
          )}
          {addNodeMode && (
            <div>Click in an empty space to place a new node.</div>
          )}
        </div>
      )}
    </div>
  );
}
