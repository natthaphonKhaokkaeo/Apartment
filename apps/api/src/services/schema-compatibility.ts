export type SchemaColumn = {tableName:string; columnName:string};
export function missingSchemaColumns(expected:readonly SchemaColumn[],existing:readonly SchemaColumn[]):SchemaColumn[]{
 const found=new Set(existing.map(c=>c.tableName+":"+c.columnName));
 return expected.filter(c=>!found.has(c.tableName+":"+c.columnName));
}
