import {describe,it,expect} from "vitest";
import {missingSchemaColumns} from "../src/services/schema-compatibility.js";
describe("P0 schema preflight",()=>{
 it("allows matching columns",()=>expect(missingSchemaColumns([{tableName:"invoices",columnName:"id"}],[{tableName:"invoices",columnName:"id"}])).toEqual([]));
 it("detects pending migration column",()=>expect(missingSchemaColumns([{tableName:"invoices",columnName:"billing_batch_run_id"}],[])).toHaveLength(1));
 it("separates same-named columns in different tables",()=>expect(missingSchemaColumns([{tableName:"leases",columnName:"id"}],[{tableName:"invoices",columnName:"id"}])).toHaveLength(1));
 it("accepts extra database columns",()=>expect(missingSchemaColumns([{tableName:"invoices",columnName:"id"}],[{tableName:"invoices",columnName:"id"},{tableName:"invoices",columnName:"legacy"}])).toEqual([]));
});
