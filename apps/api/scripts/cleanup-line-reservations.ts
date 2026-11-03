/** Manual retention tool. Never deletes invoices, LINE Outbox jobs or audit logs. */
import {sqlClient} from "../src/db/client.js";
import {cleanupLineReservations} from "../src/services/line-retention.js";
const args=process.argv.slice(2);
const apply=args.includes("--apply");
const confirm=args.includes("--confirm-retention-cleanup");
const organizationId=args.find(v=>v.startsWith("--organization-id="))?.split("=",2)[1];
if(!organizationId||apply&&!confirm){
 console.error("ORGANIZATION_ID_REQUIRED; APPLY also needs --confirm-retention-cleanup");
 process.exitCode=2;
}else{
 try{
  const report=await cleanupLineReservations({
   organizationId,apply,retentionDays:30,limit:100
  });
  console.log(JSON.stringify(report));
 }catch{
  console.error("LINE_RESERVATION_RETENTION_FAILED");
  process.exitCode=1;
 }
}
await sqlClient.end();
