import neo4j from 'neo4j-driver';
import { Record, QueryResult, Session } from 'neo4j-driver';

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
    const session: Session = this.driver.session({
      database: 'neo4j',
      defaultAccessMode: neo4j.session.WRITE,
    });

    const res: QueryResult = await session.run(
      'MATCH (m)-[r]-(a) return m,r,a',
    );

    session.close();
    return res.records.map((r: Record) => {
      return { nodes: [r.get('m'), r.get('a')], relation: r.get('r') };
    });
  }

  async getNodeAndRelations(id: string) {
    console.log(id);
    const session: Session = this.driver.session({
      database: 'neo4j',
      defaultAccessMode: neo4j.session.WRITE,
    });

    let cypher = `MATCH (nFocus)<-[r]->(n) WHERE ID(nFocus)=${id} RETURN nFocus,r,n`;
    const res: QueryResult = await session.run(cypher);
    // load the node with the given nodeId ans also load all its connected nodes
    session.close();
    return res.records.map((r: Record) => {
      return { nodes: [r.get('nFocus'), r.get('n')], relation: r.get('r') };
    });
  }
  async updateNodeProperties(id: string, dataToUpdate: any) {
    const session: Session = this.driver.session({
      database: 'neo4j',
      defaultAccessMode: neo4j.session.WRITE,
    });
    let cypher = `MATCH (p)
    WHERE ID(p)=${id}
    SET p = $dataToUpdate return p`;
    console.log(cypher);
    await session.run(cypher, { dataToUpdate });
    session.close();
  }
  async updateEdgeProperties(id: string, dataToUpdate: any) {
    const session: Session = this.driver.session({
      database: 'neo4j',
      defaultAccessMode: neo4j.session.WRITE,
    });
    let cypher = `MATCH (p)-[r]-(m)
    WHERE ID(r)=${id}
    SET r = $dataToUpdate RETURN r`;
    await session.run(cypher, { dataToUpdate });
    session.close();
  }

  // TODO we can use apoc procedure instead of this query
  // call apoc.refactor.from(rel, newStartNode)
  // relation is deleted and then another one is created so the internal id change!
  // should use parameters id on nodes/relations to avoid this?
  async updateEdgeLinks(oldEdge: any, newEdge: any) {
    console.log(oldEdge, newEdge);
    const session: Session = this.driver.session({
      database: 'neo4j',
      defaultAccessMode: neo4j.session.WRITE,
    });
    // deleting old relation
    const cypherDelete = `MATCH (m)-[r]->(l)
    WHERE ID(r)=${Number.parseInt(newEdge.id)}
    DELETE r`;
    await session.run(cypherDelete);
    session.close();

    const session2: Session = this.driver.session({
      database: 'neo4j',
      defaultAccessMode: neo4j.session.WRITE,
    });
    let cypherCreate;
    let res: QueryResult;
    // creating new relation and copy old relation properties
    cypherCreate = `MATCH (m),(l)
    WHERE ID(m)=${Number.parseInt(newEdge.from)} AND ID(l)=${Number.parseInt(
      newEdge.to,
    )}
    MERGE (m)-[r:${newEdge.label.toUpperCase()}]-(l)
    SET r = $props
    RETURN r`;
    res = await session2.run(cypherCreate, {
      props: oldEdge.properties,
    });

    session2.close();
    console.log(res);
  }
  async updateNodeLabel(id: string, labels: string[]) {
    const session: Session = this.driver.session({
      database: 'neo4j',
      defaultAccessMode: neo4j.session.WRITE,
    });

    let query = '';
    labels.forEach((l) => {
      query += `:${l}`;
    });

    let cypher = `MATCH (p)
    WHERE ID(p)=${id}
    SET p${query}`;
    console.log(cypher);
    await session.run(cypher);
    session.close();
  }
  async updateEdgeLabel(id: string, labels: string[]) {
    const session: Session = this.driver.session({
      database: 'neo4j',
      defaultAccessMode: neo4j.session.WRITE,
    });

    let query = '';
    labels.forEach((l) => {
      query += `:${l}`;
    });

    let cypher = `MATCH (p)-[r]-(m)
    WHERE ID(r)=${id}
    SET r${query}`;
    console.log(cypher);
    await session.run(cypher);
    session.close();
  }

  clear() {
    instance = null;
    if (this.driver) this.driver.close();
  }
}

export default Neo4JService.getInstance();
