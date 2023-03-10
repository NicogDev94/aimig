import { configureStore, getDefaultMiddleware } from '@reduxjs/toolkit';
import appReducer from './slices/app.slice';
import networkReducer from './slices/network.slice';
// ...
const customizedMiddleware = getDefaultMiddleware({
  serializableCheck: false,
});
export const store = configureStore({
  reducer: {
    appDatas: appReducer,
    networkData: networkReducer,
  },
  middleware: customizedMiddleware,
});

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>;
// Inferred type: {posts: PostsState, comments: CommentsState, users: UsersState}
export type AppDispatch = typeof store.dispatch;
