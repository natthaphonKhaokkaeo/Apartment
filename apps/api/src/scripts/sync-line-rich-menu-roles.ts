import {and,eq,inArray} from "drizzle-orm";
import {config} from "../config.js";
import {db,sqlClient} from "../db/client.js";
import {leases,memberships,organizations,users} from "../db/schema.js";
import {chooseMembershipRole,classifyRichMenuRole,linkRichMenuToUser,
 type RichMenuRole} from "../services/line-rich-menus.js";

/** Explicit one-off relinking after changing immutable LINE rich-menu image versions.
 *  Does not send messages, log LINE IDs, change user data, or grant app permissions.
 */
const apply=process.argv.includes("--apply");
const usersList=await db.select({id:users.id,lineSubject:users.lineSubject,platformRole:users.platformRole})
 .from(users).where(eq(users.status,"ACTIVE")).limit(1001);
if(usersList.length>1000)throw new Error("LINE_MENU_SYNC_TOO_MANY_USERS_RUN_IN_CONTROLLED_BATCHES");
const userIds=usersList.map(x=>x.id),subjects=usersList.map(x=>x.lineSubject);
const [activeMembers,activeLeases]=userIds.length?await Promise.all([
 db.select({userId:memberships.userId,role:memberships.role}).from(memberships)
  .innerJoin(organizations,eq(memberships.organizationId,organizations.id))
  .where(and(inArray(memberships.userId,userIds),eq(memberships.status,"ACTIVE"),eq(organizations.status,"ACTIVE"))),
 db.select({lineSubject:leases.tenantLineSubject}).from(leases)
  .innerJoin(organizations,eq(leases.organizationId,organizations.id))
  .where(and(inArray(leases.tenantLineSubject,subjects),eq(leases.status,"ACTIVE"),eq(organizations.status,"ACTIVE")))
]):[[],[]];
const rolesByUser=new Map<string,string[]>();
for(const item of activeMembers)rolesByUser.set(item.userId,[...(rolesByUser.get(item.userId)??[]),item.role]);
const tenantSubjects=new Set(activeLeases.map(x=>x.lineSubject));
const counters:Record<RichMenuRole,number>={public:0,owner:0,tenant:0,account:0,staff:0,superadmin:0};
let linked=0,unavailable=0,failed=0,skipped=0;
try{
 for(const user of usersList){
  // Only previously verified LINE OAuth subject IDs are eligible.
  if(!/^U[0-9a-f]{32}$/i.test(user.lineSubject)){skipped++;continue;}
  const role=classifyRichMenuRole(user.platformRole,chooseMembershipRole(rolesByUser.get(user.id)??[]),
   tenantSubjects.has(user.lineSubject));
  counters[role]++;
  if(!apply)continue;
  try{
   const assigned=await linkRichMenuToUser({channelAccessToken:config.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN,
    lineUserId:user.lineSubject,role});
   if(assigned)linked++;else failed++;
  }catch(error){
   // Account might no longer follow the Official Account; do not fail others.
   if(error instanceof Error&&error.message==="LINE_RICH_MENU_LINK_HTTP_404")unavailable++;
   else failed++;
  }
  // Keep within LINE API budget and avoid disrupting unrelated OA operations.
  await new Promise(resolve=>setTimeout(resolve,150));
 }
}finally{await sqlClient.end();}
console.log(JSON.stringify({mode:apply?"apply":"dry-run",eligible:usersList.length-skipped,
 assignedByRole:counters,linked,unavailable,failed,skipped}));
if(failed)process.exitCode=1;
