import React, { useEffect, useState } from 'react';
import {
  EventType,
  subscribeToEvent,
  unSubscribeToEvent,
} from '../helpers/custom-event.helper';
import neo4jService from '../services/neo4j.service';

export default function Modal() {
  

  return (
    <>
      {false && (
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
           
          </div>
        </div>
      )}
    </>
  );
}
