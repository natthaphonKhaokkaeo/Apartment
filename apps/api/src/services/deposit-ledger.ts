import {createHash} from "node:crypto";
import {and,eq,desc,sql} from "drizzle-orm";
import {db} from "../db/client.js";
import {organizations,users,memberships,properties,leases,depositEntries,depositReviews,auditLogs} from "../db/schema.js";
import {AppError,requireProperty,type Actor} from "../security.js";
import {depositPosition,validateDepositReceipt,validateDepositProposal,validateDepositReviewer} from "./deposit-ledger-policy.js";
type Tx=Parameters<Parameters<typeof db.transaction>[0]>[0];
export type DepositScope={propertyId:string;leaseId:string};
export type ReceiptInput={amountSatang:number;reference:string;reason:string};
export type ReviewInput={amountSatang:number;kind:"DEDUCTION"|"REFUND_REVIEW"|"DISPUTE_REVIEW";reason:string};
const digest=(payload:unknown)=>createHash("sha256").update(JSON.stringify(payload)).digest("hex");
function policy(fn:()=>void){try{fn();}catch(e){throw new AppError(422,e instanceof Error?e.message:"DEPOSIT_INVALID_AMOUNT");}}
async function state(tx:Tx,scope:DepositScope){
 const filter=and(eq(depositEntries.propertyId,scope.propertyId),eq(depositEntries.leaseId,scope.leaseId));
 const [totals]=await tx.select({
  received:sql<string>`coalesce(sum(case when ${depositEntries.kind} = 'RECEIVED' then ${depositEntries.amountSatang} else 0 end),0)`,
  deducted:sql<string>`coalesce(sum(case when ${depositEntries.kind} = 'DEDUCTION' then ${depositEntries.amountSatang} else 0 end),0)`
 }).from(depositEntries).where(filter);
 const [reservations]=await tx.select({reserved:sql<string>`coalesce(sum(case when ${depositReviews.status} = 'PENDING' or (${depositReviews.status} = 'APPROVED' and ${depositReviews.kind} <> 'DEDUCTION') then ${depositReviews.amountSatang} else 0 end),0)`}).from(depositReviews)
 .where(and(eq(depositReviews.propertyId,scope.propertyId),eq(depositReviews.leaseId,scope.leaseId)));
 const received=Number(totals.received),deducted=Number(totals.deducted),reserved=Number(reservations.reserved);
 return depositPosition([
  ...(received?[{kind:"RECEIVED" as const,amountSatang:received}]:[]),
  ...(deducted?[{kind:"DEDUCTION" as const,amountSatang:deducted}]:[])
 ],reserved?[{kind:"REFUND_REVIEW",status:"PENDING",amountSatang:reserved}]:[]);
}
async function withOwner<T>(actor:Actor,scope:DepositScope,action:(tx:Tx,organizationId:string)=>Promise<T>){
 const p=await requireProperty(actor,scope.propertyId);
 return db.transaction(async tx=>{
  // Parent row locks serialize state changes with account/org revocation.
  const [user]=await tx.select({id:users.id}).from(users).where(and(eq(users.id,actor.id),eq(users.status,"ACTIVE"))).for("share");
  const [org]=await tx.select({id:organizations.id}).from(organizations).where(and(eq(organizations.id,p.organizationId),eq(organizations.status,"ACTIVE"))).for("share");
  const [owner]=await tx.select({id:memberships.id}).from(memberships).where(and(eq(memberships.userId,actor.id),eq(memberships.organizationId,p.organizationId),eq(memberships.role,"OWNER"),eq(memberships.status,"ACTIVE"))).for("share");
  if(!user||!org||(actor.role!=="SUPER_ADMIN"&&!owner))throw new AppError(403,"DEPOSIT_ACTIVE_OWNER_REQUIRED");
  // Same property -> lease order as lease lifecycle; all receipts/reviews share this lock.
  const [property]=await tx.select({id:properties.id}).from(properties).where(and(eq(properties.id,scope.propertyId),eq(properties.organizationId,p.organizationId))).for("update");
  const [lease]=await tx.select({id:leases.id}).from(leases).where(and(eq(leases.id,scope.leaseId),eq(leases.propertyId,scope.propertyId),eq(leases.organizationId,p.organizationId))).for("update");
  if(!property||!lease)throw new AppError(404,"DEPOSIT_LEASE_NOT_FOUND");
  return action(tx,p.organizationId);
 });
}
async function audit(tx:Tx,actor:Actor,organizationId:string,action:string,targetId:string,amountSatang:number){
 await tx.insert(auditLogs).values({actorId:actor.id,organizationId,action,targetId,metadata:{amountSatang,bankVerified:false,payoutEnabled:false}});
}
export async function getDepositContext(actor:Actor,scope:DepositScope){
 return withOwner(actor,scope,async tx=>({
  position:await state(tx,scope),
  entries:await tx.select().from(depositEntries).where(and(eq(depositEntries.propertyId,scope.propertyId),eq(depositEntries.leaseId,scope.leaseId))).orderBy(desc(depositEntries.createdAt)).limit(100),
  reviews:await tx.select().from(depositReviews).where(and(eq(depositReviews.propertyId,scope.propertyId),eq(depositReviews.leaseId,scope.leaseId))).orderBy(desc(depositReviews.createdAt)).limit(100),
  historyLimit:100
 }));
}
export async function recordDepositReceipt(actor:Actor,scope:DepositScope,input:ReceiptInput,key:string){
 return withOwner(actor,scope,async(tx,organizationId)=>{
  const requestHash=digest({type:"RECEIVED",...input});
  const [prior]=await tx.select().from(depositEntries).where(and(eq(depositEntries.leaseId,scope.leaseId),eq(depositEntries.idempotencyKey,key)));
  if(prior){
   if(prior.requestHash!==requestHash)throw new AppError(409,"IDEMPOTENCY_KEY_REUSED");
   return {entry:prior,replayed:true};
  }
  const [duplicate]=await tx.select({id:depositEntries.id}).from(depositEntries).where(and(eq(depositEntries.leaseId,scope.leaseId),eq(depositEntries.reference,input.reference)));
  if(duplicate)throw new AppError(409,"DEPOSIT_REFERENCE_ALREADY_RECORDED");
  const position=await state(tx,scope);
  policy(()=>validateDepositReceipt(input.amountSatang,position));
  const [entry]=await tx.insert(depositEntries).values({...scope,organizationId,...input,kind:"RECEIVED",idempotencyKey:key,requestHash,createdBy:actor.id}).returning();
  await audit(tx,actor,organizationId,"DEPOSIT_RECEIPT_RECORDED",entry.id,input.amountSatang);
  return {entry,replayed:false};
 });
}
export async function proposeDepositReview(actor:Actor,scope:DepositScope,input:ReviewInput,key:string){
 return withOwner(actor,scope,async(tx,organizationId)=>{
  const requestHash=digest(input);
  const [prior]=await tx.select().from(depositReviews).where(and(eq(depositReviews.leaseId,scope.leaseId),eq(depositReviews.idempotencyKey,key)));
  if(prior){
   if(prior.requestHash!==requestHash)throw new AppError(409,"IDEMPOTENCY_KEY_REUSED");
   return {review:prior,replayed:true};
  }
  const position=await state(tx,scope);
  policy(()=>validateDepositProposal(input.amountSatang,position));
  const [review]=await tx.insert(depositReviews).values({...scope,organizationId,...input,idempotencyKey:key,requestHash,requestedBy:actor.id}).returning();
  await audit(tx,actor,organizationId,"DEPOSIT_REVIEW_REQUESTED",review.id,input.amountSatang);
  return {review,replayed:false};
 });
}
export async function decideDepositReview(actor:Actor,scope:DepositScope,reviewId:string,input:{action:"APPROVE"|"REJECT";reason:string}){
 return withOwner(actor,scope,async(tx,organizationId)=>{
  const [review]=await tx.select().from(depositReviews).where(and(eq(depositReviews.id,reviewId),eq(depositReviews.propertyId,scope.propertyId),eq(depositReviews.leaseId,scope.leaseId),eq(depositReviews.organizationId,organizationId))).for("update");
  if(!review)throw new AppError(404,"DEPOSIT_REVIEW_NOT_FOUND");
  if(review.status!=="PENDING")throw new AppError(409,"DEPOSIT_REVIEW_ALREADY_DECIDED");
  if(review.requestedBy===actor.id)throw new AppError(403,"SECOND_OWNER_APPROVAL_REQUIRED");
  validateDepositReviewer(review.requestedBy,actor.id);
  const [requester]=await tx.select({id:memberships.id}).from(memberships).where(and(eq(memberships.userId,review.requestedBy),eq(memberships.organizationId,organizationId),eq(memberships.role,"OWNER"),eq(memberships.status,"ACTIVE"))).for("share");
  const [requesterUser]=await tx.select({id:users.id}).from(users).where(and(eq(users.id,review.requestedBy),eq(users.status,"ACTIVE"))).for("share");
  if(!requester||!requesterUser)throw new AppError(409,"DEPOSIT_REQUESTER_NO_LONGER_OWNER");
  await state(tx,scope); // Fail closed on any inconsistency before financial mutation.
  if(input.action==="APPROVE"&&review.kind==="DEDUCTION"){
   await tx.insert(depositEntries).values({...scope,organizationId,kind:"DEDUCTION",amountSatang:review.amountSatang,reason:review.reason,reviewId:review.id,idempotencyKey:"review-"+review.id,requestHash:digest({reviewId:review.id}),createdBy:actor.id});
  }
  const [updated]=await tx.update(depositReviews).set({status:input.action==="APPROVE"?"APPROVED":"REJECTED",reviewedBy:actor.id,reviewReason:input.reason,decidedAt:new Date()}).where(eq(depositReviews.id,review.id)).returning();
  await state(tx,scope);
  await audit(tx,actor,organizationId,"DEPOSIT_REVIEW_"+updated.status,review.id,review.amountSatang);
  return {review:updated,payoutEnabled:false};
 });
}
