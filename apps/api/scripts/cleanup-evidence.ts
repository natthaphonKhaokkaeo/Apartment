/** Manual operator command. Defaults to DRY_RUN; never scheduled automatically. */
import {sweepOrphanEvidence} from "../src/services/evidence-cleanup.js";
import {sqlClient} from "../src/db/client.js";
const args=process.argv.slice(2);
const apply=args.includes("--apply");
const confirmation=args.includes("--confirm-orphans-only");
if(apply&&!confirmation){
 console.error("Refusing deletion without --apply --confirm-orphans-only");
 process.exitCode=2;
}else{
 const orgArg=args.find(arg=>arg.startsWith("--organization-id="));
 const organizationId=orgArg?.split("=")[1];
 if(apply&&!organizationId){
  console.error("Refusing apply without --organization-id=<verified UUID>");
  process.exitCode=2;
 }else if(organizationId&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(organizationId)){
  console.error("INVALID_ORGANIZATION_ID");
  process.exitCode=2;
 }else{
  try{
   const report=await sweepOrphanEvidence({apply,organizationId,limit:50});
   console.log(JSON.stringify(report,null,2));
   if(report.failed>0)process.exitCode=1;
  }catch{
   console.error("EVIDENCE_CLEANUP_FAILED: inspect service logs and database");
   process.exitCode=1;
  }
 }
}
await sqlClient.end();
