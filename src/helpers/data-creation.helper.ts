import { INode } from '../interfaces/node.interface';
import { renderHoverInfo } from './title-creation.helper';

export function createNode(n: any): INode {
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
    properties: n.properties,
  };
}
export function createEdge(e: any): any {
  const container = document.createElement('div');
  container.classList.add('node-hover-info');
  container.innerHTML = renderHoverInfo(e.id, e.type, [e.type], e.properties);
  return {
    from: e.startNodeElementId,
    to: e.endNodeElementId,
    id: e.elementId,
    label: e.type,
    properties: e.properties,
    title: container,
  };
}
