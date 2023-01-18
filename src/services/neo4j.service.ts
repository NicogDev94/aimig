import neo4j from 'neo4j-driver';
import { Record, QueryResult, Session } from 'neo4j-driver';
import { stringifyLabels } from '../helpers/data-creation.helper';

let instance: Neo4JService | null;

// TODO refactor the service...
class Neo4JService {
  driver: any;
  constructor() {
    this.driver = neo4j.driver(
      'neo4j+s://neo4j-dev-bolt.saliez.be:443',
      neo4j.auth.basic('neo4j', 'vanilla-love-nova-world-picasso-4896'),
    );
  }
  static getInstance() {
    if (!instance) instance = new Neo4JService();
    return instance;
  }

  async getAll() {
    const res = await Promise.all([
      this.executeQuery('MATCH (m) RETURN DISTINCT  m'),
      this.executeQuery('MATCH ()-[r]-() RETURN DISTINCT  r'),
    ]);

    const nodesResult: QueryResult = res[0];
    const relationsResult: QueryResult = res[1];

    const nodes = nodesResult.records.reduce(
      (previous: any, current: Record) => {
        return [...previous, current.get('m')];
      },
      [],
    );

    const edges = relationsResult.records.reduce(
      (previous: any, current: any) => {
        return [...previous, current.get('r')];
      },
      [],
    );
    return { nodes, edges };
  }

  async getNodeAndHisRelations(id: string) {
    let cypher = `MATCH (nFocus)<-[r]->(n) WHERE nFocus.id="${id}" RETURN DISTINCT nFocus,r,n`;
    const res: QueryResult = await this.executeQuery(cypher);
    const result = res.records.reduce(
      (previous: any, current: Record) => {
        const nodes = [
          ...previous.nodes,
          current.get('nFocus'),
          current.get('n'),
        ];
        const edges = [...previous.edges, current.get('r')];
        return {
          nodes,
          edges,
        };
      },
      { nodes: [], edges: [] },
    );
    return result;
  }
  async createNode(newNode: any) {
    const stringyfiedLabels = stringifyLabels(newNode.labels);

    const cypher = `CREATE (n${stringyfiedLabels})
    SET n = $props
    RETURN n`;
    const res: QueryResult = await this.executeQuery(cypher, {
      props: newNode.properties,
    });

    return res;
  }
  async createEdge(newEdge: any) {
    const stringyfiedLabels = stringifyLabels(newEdge.labels);

    const cypher = `MATCH (m),(n)
  WHERE ID(m)=${newEdge.from} AND ID(n)=${newEdge.to}
  CREATE (m)-[r${stringyfiedLabels}]->(n)
    SET r = $props
    RETURN n`;
    console.log(cypher);
    const res: QueryResult = await this.executeQuery(cypher, {
      props: newEdge.properties,
    });

    return res;
  }
  async updateNodeProperties(id: string, dataToUpdate: any) {
    let cypher = `MATCH (p)
    WHERE p.id='${id}'
    SET p = $dataToUpdate return p`;
    await this.executeQuery(cypher, { dataToUpdate });
  }
  async updateEdgeProperties(id: string, dataToUpdate: any) {
    let cypher = `MATCH (p)-[r]-(m)
    WHERE r.id='${id}'
    SET r = $dataToUpdate RETURN r`;
    await this.executeQuery(cypher, { dataToUpdate });
  }

  // TODO we can use apoc procedure instead of this query
  // call apoc.refactor.from(rel, newStartNode)
  // relation is deleted and then another one is created so the internal id change!
  // should use parameters id on nodes/relations to avoid this?
  async updateEdgeLinks(oldEdge: any, newEdge: any) {
    // deleting old relation
    const cypherDelete = `MATCH (m)-[r]->(l)
    WHERE r.id='${oldEdge.properties.id}'
    DELETE r`;
    await this.executeQuery(cypherDelete);

    // creating new relation and copy old relation properties
    const cypherCreate = `MATCH (m),(l)
    WHERE ID(m)=${newEdge.from} AND ID(l)=${newEdge.to}
    MERGE (m)-[r:${newEdge.label}]-(l)
    SET r = $props
    RETURN r`;

    return await this.executeQuery(cypherCreate, { props: oldEdge.properties });
  }

  // FIXME this should remove old labels and add new one
  // atm only add labels
  async updateNodeLabel(id: string, labels: string[]) {
    const stringyfiedLabels = stringifyLabels(labels);

    let cypher = `MATCH (p)
    WHERE p.id='${id}'
    SET p${stringyfiedLabels}`;

    return await this.executeQuery(cypher);
  }

  clear() {
    instance = null;
    if (this.driver) this.driver.close();
  }

  async executeQuery(query: string, params: any = undefined) {
    console.log('[DEBUG - QUERY / PARAMS]', query, params);
    const session: Session = this.driver.session({
      database: 'neo4j',
      defaultAccessMode: neo4j.session.WRITE,
    });
    const res = await session.run(query, params);
    session.close();
    return res;
  }
}

export default Neo4JService.getInstance();
