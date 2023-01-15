import React, { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../hooks';
import { setSelections } from '../slices/app.slice';

export default function Graph() {
  const dispatch = useAppDispatch();
  const { network } =
    useAppSelector((state) => state.appDatas);

  const handleOnCLick = (data: any) => {
    console.log(data);
    dispatch(setSelections(data));
  };

  useEffect(() => {
    if (network) {
      network.on('click', handleOnCLick);
      network.on('dragStart',(data) => console.log(data))
    }
    return () => {
      if (network) {
        network.off('click', handleOnCLick);
      }
    };
  }, [network]);

  return (
    <>
      <div id="mynetwork" style={{ width: '100vw', height: '100vh' }}></div>
    </>
  );
}
