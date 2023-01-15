import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import { Network } from 'vis-network';
import neo4jService from '../services/neo4j.service';
import { flatten, uniqBy } from 'lodash';
import { getOptions } from '../constants/constants';
import update from 'immutability-helper';
import { renderHoverInfo } from '../helpers/title-creation.helper';
import { INode } from '../interfaces/node.interface';

// Define a type for the slice state
interface AppState {
  network: Network | null;
  edges: any[];
  nodes: any[];
  loading: boolean;
  selectedNodes: any[];
  selectedEdges: any[];
}

// Define the initial state using that type
const initialState: AppState = {
  network: null,
  edges: [],
  nodes: [],
  loading: false,
  selectedEdges: [],
  selectedNodes: [],
};

export const fetchAll = createAsyncThunk(
  'appDatas/fetchAll',
  async (_: void, { dispatch, getState }) => {
    const res = await neo4jService.getAll();
    const nodes: INode[] = flatten(res.map((r) => r.nodes)).map((n: any) => {
      const container = document.createElement('div');
      container.classList.add('node-hover-info');
      container.innerHTML = renderHoverInfo(
        n.id,
        n.labels[0],
        n.labels,
        n.properties,
      );
      return {
        id: n.elementId,
        label: n.labels[0],
        labels: n.labels,
        group: n.labels[0] ? n.labels[0].toLowerCase() : null,
        title: container,
        properties: null,
      };
    });
    const uniqNodes = uniqBy(nodes, (e) => e.id);
    const edges = uniqBy(
      res
        .map((r) => r.relation)
        .map((l) => {
          return {
            from: l.startNodeElementId,
            to: l.endNodeElementId,
            id: l.elementId,
          };
        }),
      (e) => e.id,
    );
    return { nodes: uniqNodes, edges };
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
      state.edges = action.payload;
    },
    setNodes: (
      state: AppState,
      action: PayloadAction<{ nodes: Node[]; edges: any[] }>,
    ) => {
      state.nodes = action.payload.nodes;
      state.edges = action.payload.edges;
    },
    addNode: (state: AppState, action: PayloadAction<any>) => {
      state.nodes = update(state.nodes, { $push: [action.payload] });
      state.network?.setData({ nodes: state.nodes, edges: state.edges });
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
      const { nodes, edges } = action.payload;
      var options: any = getOptions();
      const container = document.getElementById('mynetwork');
      if (container) {
        const network = new Network(
          container,
          { nodes: nodes, edges: edges },
          options,
        );
        state.nodes = nodes;
        state.edges = edges;
        state.network = network;
      }
      state.loading = false;
    });
  },
});

export const { setNetwork, addNode, setEdges, setNodes, setSelections } =
  appDatasSlice.actions;

export default appDatasSlice.reducer;
