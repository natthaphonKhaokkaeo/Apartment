import {AppError} from "../security.js";

export type PlatformRole="USER"|"SUPER_ADMIN";
export type PlatformAdminChangeContext={
 actorId:string;actorRole:string;targetId:string;
 targetRole:string;nextRole:PlatformRole;targetStatus:string;
 targetLineSubject:string|null;bootstrapLineSubject:string|undefined;
 activeSuperAdminCount:number;
};

/** Central policy for changes that grant or remove platform-wide authorization. */
export function assertPlatformAdminChangeAllowed(context:PlatformAdminChangeContext):void{
 if(context.actorRole!=="SUPER_ADMIN")throw new AppError(403,"SUPER_ADMIN_REQUIRED");
 if(context.targetStatus!=="ACTIVE")throw new AppError(409,"PLATFORM_ACCOUNT_NOT_ACTIVE");
 if(!context.targetLineSubject)throw new AppError(409,"PLATFORM_ACCOUNT_NOT_LINE_VERIFIED");
 if(context.targetRole===context.nextRole)return;
 if(context.nextRole==="USER"&&context.targetLineSubject===context.bootstrapLineSubject)
  throw new AppError(409,"BOOTSTRAP_ADMIN_PROTECTED");
 if(context.nextRole==="USER"&&context.actorId===context.targetId)
  throw new AppError(409,"SELF_DEMOTION_FORBIDDEN");
 if(context.nextRole==="USER"&&context.targetRole==="SUPER_ADMIN"&&context.activeSuperAdminCount<=1)
  throw new AppError(409,"LAST_SUPER_ADMIN_REQUIRED");
}
