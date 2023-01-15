import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import { Network } from 'vis-network';
import neo4jService from '../services/neo4j.service';
import { flatten, uniqBy } from 'lodash';
import { getOptions } from '../constants/constants';
import update from 'immutability-helper';
import { INode } from '../interfaces/node.interface';
import { createEdge, createNode } from '../helpers/data-creation.helper';

// Define a type for the slice state
interface AppState {
  network: Network | null;
  edges: any[];
  nodes: any[];
  loading: boolean;
  selectedNodes: any[];
  selectedEdges: any[];
  isolatedMode: boolean;
}

// Define the initial state using that type
const initialState: AppState = {
  network: null,
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
    dispatch(setNodes(res));
    dispatch(setEdges(res));
    console.log(res)
    return res;
  },
);

export const appDatasSlice = createSlice({
  name: 'appDatas',
  // `createSlice` will infer the state type from the `initialState` argument
  initialState,
  reducers: {
    setNetwork: (state: AppState, action: PayloadAction<Network>) => {
      state.network = action.payload;
    },
    setEdges: (state: AppState, action: PayloadAction<any[]>) => {
      const edges = uniqBy(
        action.payload
          .map((r) => r.relation)
          .map((l) => {
            return createEdge(l);
          }),
        (e) => e.id,
      );
      state.edges = edges;
    },
    setNodes: (state: AppState, action: PayloadAction<any>) => {
      const nodes: INode[] = flatten(
        action.payload.map((r: any) => r.nodes),
      ).map((n: any) => {
        return createNode(n);
      });
      const uniqNodes = uniqBy(nodes, (e) => e.id);
      state.nodes = uniqNodes;
    },
    addNode: (state: AppState, action: PayloadAction<any>) => {
      state.nodes = update(state.nodes, { $push: [action.payload] });
      // state.network?.setData({ nodes: state.nodes, edges: state.edges });
    },
    setIsolatedMode: (state: AppState, action: PayloadAction<boolean>) => {
      console.log("hello")
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
      // Add user to the state array
      var options: any = getOptions();
      if (state.network) {
        // state.network.setData({ nodes: state.nodes, edges: state.edges });
      } else {
        const container = document.getElementById('mynetwork');
        if (container) {
          const network = new Network(
            container,
            { nodes: state.nodes, edges: state.edges },
            options,
          );
          state.network = network;
        }
      }

      state.loading = false;
    });
  },
});

export const {
  setNetwork,
  addNode,
  setIsolatedMode,
  setEdges,
  setNodes,
  setSelections,
} = appDatasSlice.actions;

export default appDatasSlice.reducer;
