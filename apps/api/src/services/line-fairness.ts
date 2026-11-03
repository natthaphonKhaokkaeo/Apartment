/** Deterministic fairness and alert classification rules.
 * No LINE network requests, recipient identifiers or message bodies.
 */
export type QueueOrganization={organizationId:string;oldest:Date|null};
export function rankOrgQueues(
 groups:QueueOrganization[],used:Record<string,number>,perOrgLimit:number
):string[]{
 if(!Number.isInteger(perOrgLimit)||perOrgLimit<1)throw Error("INVALID_ORG_QUOTA");
 return groups.filter(g=>(used[g.organizationId]??0)<perOrgLimit)
  .sort((a,b)=>(used[a.organizationId]??0)-(used[b.organizationId]??0)||
   (a.oldest?.getTime()??0)-(b.oldest?.getTime()??0)||
   a.organizationId.localeCompare(b.organizationId))
  .map(g=>g.organizationId);
}
export const alertKinds=[
 "DEAD_UNREVIEWED","EXPIRED_SENDING_LEASE","QUEUE_BACKLOG"
] as const;
export type LineOpsAlertKind=typeof alertKinds[number];
export function assessLineOpsAlerts(state:{
 unreviewedDeadCount:number;expiredSendingLeaseCount:number;
 oldestActiveAgeSeconds:number|null
},queueBacklogSeconds=900):LineOpsAlertKind[]{
 const kinds:LineOpsAlertKind[]=[];
 if(state.unreviewedDeadCount>0)kinds.push("DEAD_UNREVIEWED");
 if(state.expiredSendingLeaseCount>0)kinds.push("EXPIRED_SENDING_LEASE");
 if(state.oldestActiveAgeSeconds!==null&&
  state.oldestActiveAgeSeconds>=queueBacklogSeconds)kinds.push("QUEUE_BACKLOG");
 return kinds;
}
