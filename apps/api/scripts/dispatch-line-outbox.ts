/** Explicit one-shot LINE OA outbox dispatcher; not a scheduled/background daemon.
 * Default mode is DISABLED. Simulated results are never represented as delivered.
 */
import {config} from "../src/config.js";
import {sqlClient} from "../src/db/client.js";
import {runLineOutboxBatch} from "../src/services/line-outbox.js";

const args=process.argv.slice(2);
let mode:"disabled"|"simulate"|"live"="disabled";
if(args.includes("--simulate"))mode="simulate";
if(args.includes("--live")&&args.includes("--confirm-real-messages"))mode="live";
if(args.includes("--live")&&!args.includes("--confirm-real-messages")){
 console.error("REFUSING_LIVE_SEND_WITHOUT_EXPLICIT_CONFIRMATION");
 process.exitCode=2;
}else if(mode==="live" && (config.LINE_OUTBOUND_MODE!=="live"||
 !config.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN||!config.LINE_OA_BOT_USER_ID)){
 console.error("LINE_OUTBOUND_LIVE_ENV_REQUIRED");
 process.exitCode=2;
}else{
 try{
  const report=await runLineOutboxBatch({mode,limit:5});
  console.log(JSON.stringify(report));
  if(report.dead>0)process.exitCode=1;
 }catch{
  // Never echo LINE access tokens, recipients, private bodies or LINE response text.
  console.error("LINE_DISPATCH_FAILED: inspect redacted service logs");
  process.exitCode=1;
 }
}
await sqlClient.end();
