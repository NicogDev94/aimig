import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import neo4jService from '../services/neo4j.service';
import update from 'immutability-helper';
import { INode } from '../interfaces/node.interface';
import { createEdge, createNode } from '../helpers/data-creation.helper';

// Define a type for the slice state
interface AppState {
  edges: any[];
  nodes: any[];
  loading: boolean;
  selectedNodes: any[];
  selectedEdges: any[];
  isolatedMode: boolean;
}

// Define the initial state using that type
const initialState: AppState = {
  edges: [],
  nodes: [],
  loading: false,
  selectedEdges: [],
  selectedNodes: [],
  isolatedMode: false,
};

export const fetchAll = createAsyncThunk(
  'appDatas/fetchAll',
  async (_: void, { dispatch, getState }) => {
    const res = await neo4jService.getAll();
    dispatch(setNodes(res.nodes));
    dispatch(setEdges(res.edges));
    return res;
  },
);

export const appDatasSlice = createSlice({
  name: 'appDatas',
  // `createSlice` will infer the state type from the `initialState` argument
  initialState,
  reducers: {
    setEdges: (state: AppState, action: PayloadAction<any[]>) => {
      const edges = action.payload.map((l) => {
        return createEdge(l);
      });
      state.edges = edges;
    },
    setNodes: (state: AppState, action: PayloadAction<any>) => {
      const nodes: INode[] = action.payload.map((n: any) => {
        return createNode(n);
      });

      state.nodes = nodes;
    },
    addNode: (state: AppState, action: PayloadAction<any>) => {
      state.nodes = update(state.nodes, { $push: [action.payload] });
      // state.network?.setData({ nodes: state.nodes, edges: state.edges });
    },
    updateNode: (state: AppState, action: PayloadAction<any>) => {
      const index = state.nodes.findIndex(
        (n) => n.properties.id === action.payload.properties.idF,
      );
      if (index !== -1)
        state.nodes = update(state.nodes, {
          [index]: { $merge: { ...action.payload } },
        });
    },
    setIsolatedMode: (state: AppState, action: PayloadAction<boolean>) => {
      state.isolatedMode = action.payload;
    },
    setSelections: (state: AppState, action: PayloadAction<any>) => {
      const edges = state.edges.filter((e) =>
        action.payload.edges.includes(e.id),
      );
      const nodes = state.nodes.filter((e) =>
        action.payload.nodes.includes(e.id),
      );
      state.selectedEdges = edges;
      state.selectedNodes = nodes;
    },
  },
  extraReducers: (builder) => {
    // Add reducers for additional action types here, and handle loading state as needed
    builder.addCase(fetchAll.pending, (state, action) => {
      state.loading = true;
    });
    builder.addCase(fetchAll.rejected, (state, action) => {
      state.loading = false;
    });
    builder.addCase(fetchAll.fulfilled, (state, action) => {
      state.loading = false;
    });
  },
});

export const {
  addNode,
  updateNode,
  setIsolatedMode,
  setEdges,
  setNodes,
  setSelections,
} = appDatasSlice.actions;

export default appDatasSlice.reducer;
