import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';

export function database() {
  const sql = new DatabaseSync(':memory:');
  sql.exec(readFileSync(new URL('../migrations/0001_member_portal.sql',import.meta.url),'utf8'));
  return {
    sql,
    prepare(query) {
      const statement=sql.prepare(query);let args=[];
      const obj={bind(...values){args=values.map(v=>v instanceof ArrayBuffer?new Uint8Array(v):v);return obj},
        async first(){return statement.get(...args)||null},
        async all(){return {results:statement.all(...args)}},
        async run(){return {success:true,meta:{changes:Number(statement.run(...args).changes)}}}};
      return obj;
    },
    async batch(statements){sql.exec('BEGIN');try{const r=[];for(const s of statements)r.push(await s.run());sql.exec('COMMIT');return r}catch(e){sql.exec('ROLLBACK');throw e}},
  };
}
