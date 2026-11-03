/** One-shot, scoped due reminder PREPARATION (not a LINE sending daemon). */
import {sqlClient} from "../src/db/client.js";
import {bangkokDate,prepareDueReminders} from "../src/services/line-due-reminders.js";
const args=process.argv.slice(2);
const apply=args.includes("--apply");
const confirm=args.includes("--confirm-queue-only");
const org=args.find(s=>s.startsWith("--organization-id="))?.split("=",2)[1]??"";
const date=args.find(s=>s.startsWith("--date="))?.split("=",2)[1]??bangkokDate(new Date());
if(apply&&(!confirm||!org)){
 console.error("REFUSING_APPLY: --confirm-queue-only and --organization-id=<UUID> required");
 process.exitCode=2;
}else if(!org){
 console.error("ORGANIZATION_ID_REQUIRED (no unscoped business query)");
 process.exitCode=2;
}else{
 try{
  const report=await prepareDueReminders({date,organizationId:org,apply,limit:50});
  console.log(JSON.stringify(report));
 }catch{
  console.error("LINE_DUE_PREPARATION_FAILED: check date, permissions and DB");
  process.exitCode=1;
 }
}
await sqlClient.end();
