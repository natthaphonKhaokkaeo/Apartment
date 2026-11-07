/** A monthly reading is the meter closing value for the *selected* month.
 * Internally it is stored on the exclusive end boundary (first day next month).
 * The user never needs to choose a calendar day for regular monthly billing.
 */
export function monthCloseBoundary(month:string):string{
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw new Error("INVALID_METER_MONTH");
 const [year,monthNumber]=month.split("-").map(Number);
 if(year<1970||year>9998)throw new Error("INVALID_METER_MONTH");
 const date=new Date(Date.UTC(year,monthNumber,1));
 return date.toISOString().slice(0,10);
}
export function monthFromBoundary(date:string):string{
 if(!/^\d{4}-\d{2}-01$/.test(date))throw new Error("NOT_MONTH_BOUNDARY");
 return new Date(Date.parse(date+"T00:00:00Z")-86400000).toISOString().slice(0,7);
}
type Reading={id:string;readAt:string;value:string};
export function latestBoundaryReading<T extends Reading>(boundary:string,readings:readonly T[]):T|undefined{
 const exact=readings.find(r=>r.readAt===boundary);
 if(exact)return exact;
 // For partial/15-day intervals, never silently substitute a different day.
 if(!/^\d{4}-\d{2}-01$/.test(boundary))return undefined;
 const previousMonth=monthFromBoundary(boundary);
 return readings.filter(row=>row.readAt.slice(0,7)===previousMonth&&row.readAt<boundary)
  .sort((a,b)=>b.readAt.localeCompare(a.readAt))[0];
}
