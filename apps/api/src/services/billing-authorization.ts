/** Called only after authenticated active user + active organization are verified.
 *  Platform SUPER_ADMIN is allowed to perform owner billing functions without org membership.
 *  This does not relax payment approval separation of duties. */
export function mayPerformOwnerBillingAction(platformRole:string|undefined,membershipRole:string|undefined){
 return platformRole==="SUPER_ADMIN"||(platformRole==="USER"&&membershipRole==="OWNER");
}
