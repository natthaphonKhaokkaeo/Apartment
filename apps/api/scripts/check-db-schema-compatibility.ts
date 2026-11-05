/** Read-only fail-closed Drizzle / PostgreSQL preflight. Does not migrate. */
import {getTableColumns,getTableName,isTable} from "drizzle-orm";
import * as schema from "../src/db/schema.js";
import {sqlClient} from "../src/db/client.js";
import {missingSchemaColumns,type SchemaColumn} from "../src/services/schema-compatibility.js";
async function main(){
 const expected:SchemaColumn[]=[];
 for(const table of Object.values(schema)){
  if(!isTable(table))continue;
  for(const column of Object.values(getTableColumns(table))){
   expected.push({tableName:getTableName(table),columnName:column.name});
  }
 }
 const rows=await sqlClient<{table_name:string;column_name:string}[]>`
  SELECT table_name, column_name FROM information_schema.columns
  WHERE table_schema = 'public'
 `;
 const existing=rows.map(r=>({tableName:r.table_name,columnName:r.column_name}));
 const missing=missingSchemaColumns(expected,existing);
 if(missing.length){
  console.error(JSON.stringify({result:"SCHEMA_DRIFT",missing,
   action:"Coordinate checked-in migrations; never auto-apply from this preflight."}));
  process.exitCode=1;
 }else console.log(JSON.stringify({result:"PASS",checkedColumns:expected.length,mutations:0}));
}
try{await main();}catch(e){
 console.error("SCHEMA_PREFLIGHT_FAILED",e instanceof Error?e.message:String(e));
 process.exitCode=1;
}finally{await sqlClient.end();}
