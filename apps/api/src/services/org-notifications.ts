import {and,eq} from "drizzle-orm";
import {db} from "../db/client.js";
import {memberships,orgNotifications} from "../db/schema.js";

type NotificationInput={eventKey:string;kind:string;title:string;body:string};
/** Persist one inbox item per active organization member. Safe to call in the source transaction. */
export async function notifyOrganizationMembersTx(
 tx:Pick<typeof db,"select"|"insert">,organizationId:string,input:NotificationInput
){
 const recipients=await tx.select({userId:memberships.userId}).from(memberships).where(and(
  eq(memberships.organizationId,organizationId),eq(memberships.status,"ACTIVE")
 ));
 if(!recipients.length)return 0;
 const inserted=await tx.insert(orgNotifications).values(recipients.map(({userId})=>({
  organizationId,recipientUserId:userId,...input
 }))).onConflictDoNothing().returning({id:orgNotifications.id});
 return inserted.length;
}
