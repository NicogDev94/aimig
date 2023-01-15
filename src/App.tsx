import React, { useEffect } from 'react';
import './App.css';
import { useAppDispatch, useAppSelector } from './hooks';
import { fetchAll } from './slices/app.slice';
import Graph from './components/Graph';
import ActionButtons from './components/NodeModal';

function App() {
  const dispatch = useAppDispatch();

  const { loading } = useAppSelector((state) => state.appDatas);

  useEffect(() => {
    dispatch(fetchAll());
  }, []);

  return (
    <>
    <ActionButtons />
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
