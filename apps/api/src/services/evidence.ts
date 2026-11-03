import {createHash,randomUUID} from "node:crypto";
import {mkdir,open,readFile,rm,stat,lstat} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {resolve} from "node:path";
import sharp from "sharp";
import {config} from "../config.js";
import {verifyEvidenceMalware} from "./malware-scanner.js";
import {AppError} from "../security.js";
import {
 MAX_EVIDENCE_BYTES,MAX_EVIDENCE_PIXELS,
 saveSanitizedObject,loadSanitizedObject,deleteSanitizedObject
} from "./evidence-s3.js";

const defaultPrivateDir=fileURLToPath(new URL("../../../../.private-payment-evidence/",import.meta.url));
const directory=resolve(config.PAYMENT_EVIDENCE_DIR?.trim()||defaultPrivateDir);
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
function storagePath(key:string){
 if(!uuid.test(key))throw new AppError(400,"INVALID_EVIDENCE_KEY");
 return resolve(directory,key+".webp");
}
async function ensurePrivateDirectory(){
 await mkdir(directory,{recursive:true,mode:0o700});
 const folder=await lstat(directory);
 if(!folder.isDirectory()||folder.isSymbolicLink()||(folder.mode&0o077)!==0)
  throw new AppError(500,"PAYMENT_EVIDENCE_DIR_NOT_PRIVATE");
}
export type SavedEvidence={key:string;sha256:string;size:number};
export async function sanitizeEvidence(content:Buffer,mime:string):Promise<Buffer>{
 if(content.length===0||content.length>MAX_EVIDENCE_BYTES)
  throw new AppError(413,"EVIDENCE_FILE_TOO_LARGE");
 if(!["image/jpeg","image/png","image/webp"].includes(mime))
  throw new AppError(415,"UNSUPPORTED_EVIDENCE_MEDIA");
 // Scan untrusted source bytes before decode, then scan sanitized pixels before storage.
 await verifyEvidenceMalware(content);
 let metadata;
 try{metadata=await sharp(content,{limitInputPixels:MAX_EVIDENCE_PIXELS,failOn:"error",animated:false}).metadata();}
 catch{throw new AppError(422,"INVALID_EVIDENCE_IMAGE");}
 const expectedFormat={"image/jpeg":"jpeg","image/png":"png","image/webp":"webp"}[mime];
 if(metadata.format!==expectedFormat||
   !metadata.width||!metadata.height||metadata.width*metadata.height>MAX_EVIDENCE_PIXELS||
   (metadata.pages??1)>1)throw new AppError(422,"INVALID_EVIDENCE_IMAGE");
 let safe:Buffer;
 try{
  // Decoded pixel-only WebP strips EXIF, GPS, ICC and other embedded input metadata.
  safe=await sharp(content,{limitInputPixels:MAX_EVIDENCE_PIXELS,failOn:"error",animated:false})
   .rotate().webp({quality:85}).toBuffer();
 }catch{throw new AppError(422,"INVALID_EVIDENCE_IMAGE");}
 if(safe.length>MAX_EVIDENCE_BYTES)throw new AppError(413,"EVIDENCE_FILE_TOO_LARGE");
 return safe;
}
export async function storeSanitizedEvidence(safe:Buffer):Promise<SavedEvidence>{
 await verifyEvidenceMalware(safe);
 if(config.EVIDENCE_STORAGE_DRIVER==="s3")return saveSanitizedObject(safe);
 if(safe.length===0||safe.length>MAX_EVIDENCE_BYTES)throw new AppError(413,"EVIDENCE_FILE_TOO_LARGE");
 await ensurePrivateDirectory();
 const key=randomUUID();
 const f=await open(storagePath(key),"wx",0o600);
 try{await f.writeFile(safe);}finally{await f.close();}
 return {key,sha256:createHash("sha256").update(safe).digest("hex"),size:safe.length};
}
export async function savePrivateEvidence(content:Buffer,mime:string):Promise<SavedEvidence>{
 return storeSanitizedEvidence(await sanitizeEvidence(content,mime));
}
export async function loadPrivateEvidence(key:string):Promise<Buffer>{
 if(config.EVIDENCE_STORAGE_DRIVER==="s3")return loadSanitizedObject(key);
 try{
  const path=storagePath(key);
  const s=await stat(path);
  if(!s.isFile()||s.size>MAX_EVIDENCE_BYTES)throw new Error("UNEXPECTED_EVIDENCE_SIZE");
  return await readFile(path);
 }catch{throw new AppError(404,"EVIDENCE_NOT_FOUND");}
}
export async function deletePrivateEvidence(key:string){
 if(config.EVIDENCE_STORAGE_DRIVER==="s3")return deleteSanitizedObject(key);
 await rm(storagePath(key),{force:true});
}
