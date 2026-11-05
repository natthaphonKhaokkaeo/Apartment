type OccupancyRoom={id:string;status:string};
type LeaseRoom={roomId:string};
/** Snapshot-only reconciliation of room state vs active leases, no tenant PII. */
export function summarizeOccupancy(rooms:OccupancyRoom[],activeLeases:LeaseRoom[]){
 const validStates=new Set(["AVAILABLE","OCCUPIED","MAINTENANCE"]);
 const byId=new Map<string,OccupancyRoom>();
 let occupiedRooms=0,availableRooms=0,maintenanceRooms=0;
 for(const room of rooms){
  if(!room.id||byId.has(room.id)||!validStates.has(room.status))
   throw Error("INVALID_OCCUPANCY_STATE");
  byId.set(room.id,room);
  if(room.status==="OCCUPIED")occupiedRooms++;
  if(room.status==="AVAILABLE")availableRooms++;
  if(room.status==="MAINTENANCE")maintenanceRooms++;
 }
 const activeCounts=new Map<string,number>();
 for(const lease of activeLeases){
  if(!byId.has(lease.roomId))throw Error("LEASE_ROOM_SCOPE_MISMATCH");
  activeCounts.set(lease.roomId,(activeCounts.get(lease.roomId)??0)+1);
 }
 let occupiedWithoutActiveLease=0,activeLeaseInNonOccupiedRoom=0;
 let roomsWithMultipleActiveLeases=0;
 for(const room of rooms){
  const activeCount=activeCounts.get(room.id)??0;
  if(room.status==="OCCUPIED"&&activeCount===0)occupiedWithoutActiveLease++;
  if(room.status!=="OCCUPIED"&&activeCount>0)activeLeaseInNonOccupiedRoom++;
  if(activeCount>1)roomsWithMultipleActiveLeases++;
 }
 const totalRooms=rooms.length;
 return {totalRooms,occupiedRooms,availableRooms,maintenanceRooms,
  occupancyPercent:totalRooms?Math.round(occupiedRooms/totalRooms*10000)/100:0,
  activeLeaseCount:activeLeases.length,
  occupiedWithoutActiveLease,activeLeaseInNonOccupiedRoom,
  roomsWithMultipleActiveLeases,
 };
}
