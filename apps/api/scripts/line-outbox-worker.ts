/**
 * P4-03c LINE observer/worker.
 * Default OBSERVE periodically samples aggregate queue health and NEVER sends.
 * Actual live send requires three independent controls plus real credentials:
 * LINE_WORKER_MODE=live, LINE_WORKER_APPROVED=true, LINE_OUTBOUND_MODE=live.
 * Dokploy DEV overrides to observe/false/disabled explicitly.
 */
import {writeFileSync} from "node:fs";
import {config} from "../src/config.js";
import {db} from "../src/db/client.js";
import {lineOaBindings} from "../src/db/schema.js";
import {eq} from "drizzle-orm";
import {bangkokDate,prepareDueReminders} from "../src/services/line-due-reminders.js";
import {sqlClient} from "../src/db/client.js";
import {runLineOutboxBatch} from "../src/services/line-outbox.js";
import {decideWorkerMode,outboxGlobalCounts} from "../src/services/line-operations.js";
import {reconcileLineOpsAlerts} from "../src/services/line-alerts.js";

const heartbeat="/tmp/apartment-line-worker-heartbeat";
const args=process.argv.slice(2);
const once=args.includes("--once");
const rawInterval=Number(process.env.LINE_WORKER_INTERVAL_MS??60000);
if(!Number.isInteger(rawInterval)||rawInterval<30000||rawInterval>300000)
 throw new Error("LINE_WORKER_INTERVAL_OUT_OF_RANGE");
const mode=decideWorkerMode({
 requested:process.env.LINE_WORKER_MODE,
 outbound:config.LINE_OUTBOUND_MODE,
 approved:process.env.LINE_WORKER_APPROVED,
 hasCredentials:!!config.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN&&
 !!config.LINE_MESSAGING_CHANNEL_SECRET&&!!config.LINE_OA_BOT_USER_ID
});
let stopping=false;
process.once("SIGTERM",()=>{stopping=true;});
process.once("SIGINT",()=>{stopping=true;});
let tick=0;
let lastPreparedDate="";
async function oneTick(){
 // Daily idempotent preparation; the outbox has a unique event key per invoice.
 // Only the approved live worker prepares due reminders; observers remain read-only.
 const today=bangkokDate(new Date());
 if(mode==="live"&&process.env.LINE_AUTO_DUE_REMINDERS==="true"&&lastPreparedDate!==today){
  const bindings=await db.select({organizationId:lineOaBindings.organizationId}).from(lineOaBindings).where(eq(lineOaBindings.enabled,true));
  for(const organizationId of new Set(bindings.map(b=>b.organizationId))){
   const prepared=await prepareDueReminders({date:today,organizationId,apply:true,limit:100});
   console.log(JSON.stringify({event:"LINE_DUE_REMINDERS_PREPARED",organizationId,...prepared}));
  }
  lastPreparedDate=today;
 }
 const counts=await outboxGlobalCounts();
 const alerts=await reconcileLineOpsAlerts();
 let dispatch:Awaited<ReturnType<typeof runLineOutboxBatch>>|null=null;
 // Single DEV replica, deliberately throttled <=3 jobs / 60s. Production
 // provider quota and per-organization rate fairness are not yet accepted.
 if(mode==="live")dispatch=await runLineOutboxBatch({mode:"live",limit:3});
 const stamp=Date.now();
 writeFileSync(heartbeat,String(stamp),{encoding:"ascii",mode:0o600});
 tick++;
 if(once||tick%5===1||counts.DEAD>0||counts.RETRY>0)
  console.log(JSON.stringify({
   event:"LINE_OUTBOX_OBSERVER",mode,
   counts,alerts,dispatched:dispatch?.attempted??0,
   deadLetterAttention:counts.DEAD>0,
   observedAt:new Date(stamp).toISOString(),
   deliveryVerified:false
  }));
}
try{
 do{
  try{
   await oneTick();
  }catch{
   // Do not print the error object: may contain connection secrets.
   console.error("LINE_OBSERVER_TICK_FAILED");
   if(once){process.exitCode=1;break;}
  }
  if(once||stopping)break;
  await new Promise<void>(resolve=>{
   let elapsed=0;
   const interval=setInterval(()=>{
    elapsed+=250;
    if(stopping||elapsed>=rawInterval){clearInterval(interval);resolve();}
   },250);
  });
 }while(!stopping);
}finally{
 await sqlClient.end();
}
