import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import { Network } from 'vis-network';

// Define a type for the slice state
interface NetworkState {
  network: Network | null;
  addNodeMode: boolean;
  addEdgeMode: boolean;
  editNodeMode: boolean;
  editEdgeMode: boolean;
  editMode: boolean;
}

// Define the initial state using that type
const initialState: NetworkState = {
  network: null,
  addNodeMode: false,
  addEdgeMode: false,
  editNodeMode: false,
  editEdgeMode: false,
  editMode: false,
};

export const networkSlice = createSlice({
  name: 'network',
  // `createSlice` will infer the state type from the `initialState` argument
  initialState,
  reducers: {
    setNetwork: (state: NetworkState, action: PayloadAction<Network>) => {
      state.network = action.payload;
    },
    setAddNodeMode: (state: NetworkState, action: PayloadAction<boolean>) => {
      state.addNodeMode = action.payload;
      action.payload && state.network!.addNodeMode();
    },
    setAddEdgeMode: (state: NetworkState, action: PayloadAction<boolean>) => {
      state.addEdgeMode = action.payload;
      action.payload && state.network!.addEdgeMode();
    },
    setEditNodeMode: (state: NetworkState, action: PayloadAction<boolean>) => {
      state.editNodeMode = action.payload;
      action.payload && state.network!.editNode();
    },
    setEditEdgeMode: (state: NetworkState, action: PayloadAction<boolean>) => {
      state.editEdgeMode = action.payload;
      action.payload && state.network!.editEdgeMode();
    },
    setEditMode: (state: NetworkState, action: PayloadAction<boolean>) => {
      state.editMode = action.payload;
      action.payload
        ? state.network!.editNode()
        : state.network!.disableEditMode();
    },
  },
});

export const {
  setNetwork,
  setAddEdgeMode,
  setAddNodeMode,
  setEditEdgeMode,
  setEditNodeMode,
  setEditMode,
} = networkSlice.actions;

export default networkSlice.reducer;
