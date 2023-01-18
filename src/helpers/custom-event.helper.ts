export enum EventType {
  ADD_EDGE,
  EDIT_EDGE,
  ADD_NODE,
  EDIT_NODE,
}

function subscribeToEvent(eventType: any, listener: any) {
  document.addEventListener(eventType, listener);
}

function unSubscribeToEvent(eventType: any, listener: any) {
  document.removeEventListener(eventType, listener);
}

function trigger(eventType: any, data: any) {
  const event = new CustomEvent(eventType, { detail: data });
  document.dispatchEvent(event);
}

export { subscribeToEvent, unSubscribeToEvent, trigger };
