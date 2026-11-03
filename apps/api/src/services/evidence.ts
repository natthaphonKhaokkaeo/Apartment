import {createHash,randomUUID} from "node:crypto";
import {mkdir,open,readFile,rm,stat,lstat} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {resolve,isAbsolute} from "node:path";
import sharp from "sharp";
import {config} from "../config.js";
import {AppError} from "../security.js";

const defaultPrivateDir=fileURLToPath(new URL("../../../../.private-payment-evidence/",import.meta.url));
const directory=resolve(config.PAYMENT_EVIDENCE_DIR?.trim()||defaultPrivateDir);
const maxBytes=4_000_000;
const maxPixels=12_000_000;
function validateKey(key:string):void{
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(key))
  throw new AppError(400,"INVALID_EVIDENCE_KEY");
}
function storagePath(key:string){validateKey(key);return resolve(directory,key+".webp");}
async function ensurePrivateDirectory(){
 await mkdir(directory,{recursive:true,mode:0o700});
 const folder=await lstat(directory);
 if(!folder.isDirectory()||folder.isSymbolicLink()||(folder.mode&0o077)!==0)
  throw new AppError(500,"PAYMENT_EVIDENCE_DIR_NOT_PRIVATE");
}
export type SavedEvidence={key:string;sha256:string;size:number};
export async function savePrivateEvidence(content:Buffer,mime:string):Promise<SavedEvidence>{
 if(content.length===0||content.length>maxBytes)throw new AppError(413,"EVIDENCE_FILE_TOO_LARGE");
 if(!["image/jpeg","image/png","image/webp"].includes(mime))throw new AppError(415,"UNSUPPORTED_EVIDENCE_MEDIA");
 let metadata;
 try{
  metadata=await sharp(content,{limitInputPixels:maxPixels,failOn:"error",animated:false}).metadata();
 }catch{throw new AppError(422,"INVALID_EVIDENCE_IMAGE");}
 if(!["jpeg","png","webp"].includes(metadata.format??"")||!metadata.width||!metadata.height||
     metadata.width*metadata.height>maxPixels||(metadata.pages??1)>1)throw new AppError(422,"INVALID_EVIDENCE_IMAGE");
 let safeContent:Buffer;
 try{
  // Fresh image contains only decoded pixels; EXIF, GPS and embedded metadata are stripped.
  safeContent=await sharp(content,{limitInputPixels:maxPixels,failOn:"error",animated:false}).rotate().webp({quality:85}).toBuffer();
 }catch{throw new AppError(422,"INVALID_EVIDENCE_IMAGE");}
 if(safeContent.length>maxBytes)throw new AppError(413,"EVIDENCE_FILE_TOO_LARGE");
 await ensurePrivateDirectory();
 const key=randomUUID();
 const file=await open(storagePath(key),"wx",0o600);
 try{await file.writeFile(safeContent);}finally{await file.close();}
 return {key,sha256:createHash("sha256").update(safeContent).digest("hex"),size:safeContent.length};
}
export async function loadPrivateEvidence(key:string):Promise<Buffer>{
 try{
  const file=storagePath(key);
  const s=await stat(file);
  if(!s.isFile()||s.size>maxBytes)throw new Error("UNEXPECTED_EVIDENCE_SIZE");
  return await readFile(file);
 }catch{throw new AppError(404,"EVIDENCE_NOT_FOUND");}
}
export async function deletePrivateEvidence(key:string){
 await rm(storagePath(key),{force:true});
}
