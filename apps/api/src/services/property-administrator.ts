import {and,eq,inArray} from "drizzle-orm";
import {db} from "../db/client.js";
import {memberships} from "../db/schema.js";
import {AppError,requireProperty,type Actor} from "../security.js";

/** Keep financial/lease administrative reports out of STAFF even when
 * a staff grant permits reading or writing an unrelated room operation.
 */
export async function requirePropertyAdministrator(actor:Actor,propertyId:string){
 const property=await requireProperty(actor,propertyId);
 if(actor.role==="SUPER_ADMIN")return property;
 const [membership]=await db.select({id:memberships.id}).from(memberships)
  .where(and(eq(memberships.organizationId,property.organizationId),
   eq(memberships.userId,actor.id),eq(memberships.status,"ACTIVE"),
   inArray(memberships.role,["OWNER","MANAGER"]))).limit(1);
 if(!membership)throw new AppError(403,"PROPERTY_ADMINISTRATOR_REQUIRED");
 return property;
}
