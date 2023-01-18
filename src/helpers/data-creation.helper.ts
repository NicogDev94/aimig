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
    id: n.elementId || n.id,
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
    from: e.startNodeElementId || e.from,
    to: e.endNodeElementId || e.to,
    id: e.elementId || e.id,
    label: e.type || e.label,
    labels: e.labels || [e.label],
    properties: e.properties,
    title: container,
  };
}

export function stringifyLabels(labels: string[]) {
  return labels.reduce((prev: string, current: string) => {
    return prev + ':' + current;
  }, '');
}
