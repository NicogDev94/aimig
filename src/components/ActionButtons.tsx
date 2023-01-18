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
}

export default function ActionButtons({ node, edge }: IActionButtonsProps) {
  const dispatch = useAppDispatch();

  const { addEdgeMode, addNodeMode, editEdgeMode, editMode } =
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

  return (
    <div style={{ top: 5, left: 5, zIndex: 99 }} className="absolute">
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

          {node && (
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
