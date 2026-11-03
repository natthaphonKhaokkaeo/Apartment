import {randomBytes} from "node:crypto";
import {tokenHash} from "../security.js";

export function hashLeaseInvite(raw:string):string{
 if(!/^[A-Za-z0-9_-]{43}$/.test(raw)) throw new Error("INVALID_INVITE_FORMAT");
 // Domain-separated from login session tokens.
 return tokenHash("lease-invite-v1:"+raw);
}
export function generateLeaseInvite():{token:string;hash:string}{
 const token=randomBytes(32).toString("base64url");
 return {token,hash:hashLeaseInvite(token)};
}
export function inviteExpiry(now:Date=new Date()):Date{
 return new Date(now.getTime()+24*60*60*1000);
}
