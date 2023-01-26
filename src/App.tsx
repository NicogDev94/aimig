import React, { useEffect } from 'react';
import './App.css';
import { useAppDispatch, useAppSelector } from './hooks';
import { fetchAll, setIsolatedMode } from './slices/app.slice';
import Graph from './components/Graph';
import NodeModal from './components/NodeModal';
import styled from 'styled-components';

const IsolatedModeActions = styled.div`
  z-index: 50;
  position: absolute;
  left: 0;
  top: 44px;
  height: 28px;
`;

function App() {
  const dispatch = useAppDispatch();

  const { loading, isolatedMode } = useAppSelector((state) => state.appDatas);

  useEffect(() => {
    if (!isolatedMode) dispatch(fetchAll());
  }, [isolatedMode]);

  useEffect(() => {});

  const handleBackPlainView = () => {
    dispatch(setIsolatedMode(false));
  };

  return (
    <>
      <NodeModal />
      {isolatedMode && (
        <IsolatedModeActions>
          <button onClick={handleBackPlainView}>Back</button>
        </IsolatedModeActions>
      )}
      <Graph />
      {loading && (
        <div style={{ position: 'absolute', top: '45vh', left: '45vw' }}>
          Loading datas...
        </div>
      )}
    </>
  );
}

export default App;
