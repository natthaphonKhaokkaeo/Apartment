/** A contract helps label and deliver a bill, but never owns the room's billing cycle.
 * Only associate a normal room invoice with a lease covering the full period;
 * otherwise leave leaseId null rather than inventing or attributing a bill to
 * someone who was not responsible for the entire period.
 */
export function billableLease<T extends {startDate:string;endDate:string|null}>(
 lease:T|undefined,start:string,endExclusive:string,partial=false
):T|null{
 if(!lease)return null;
 if(partial)return lease;
 return lease.startDate<=start&&(!lease.endDate||lease.endDate>=endExclusive)?lease:null;
}
export const noLeaseRecipientName="ไม่ระบุผู้เช่า";
