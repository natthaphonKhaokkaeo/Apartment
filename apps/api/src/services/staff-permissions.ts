export type StaffGrantLevel="VIEWER"|"METER_READER";
export type StaffOperation="read"|"meter.write"|"admin.write";

/** Staff may only write meter readings when the owner explicitly grants METER_READER. */
export function mayAccessPropertyAsStaff(level:StaffGrantLevel,operation:StaffOperation){
 return operation==="read" || (operation==="meter.write"&&level==="METER_READER");
}

export function staffInviteTargetIsValid(role:"MANAGER"|"STAFF",propertyId:string|null){
 return role==="STAFF" ? !!propertyId : propertyId===null;
}
