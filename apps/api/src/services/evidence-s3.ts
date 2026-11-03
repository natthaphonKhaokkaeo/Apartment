import {createHash,randomUUID} from "node:crypto";
import {
 S3Client,PutObjectCommand,GetObjectCommand,HeadObjectCommand,DeleteObjectCommand
} from "@aws-sdk/client-s3";
import {getSignedUrl} from "@aws-sdk/s3-request-presigner";
import {config} from "../config.js";
import {AppError} from "../security.js";

export const MAX_EVIDENCE_BYTES=4_000_000;
export const MAX_EVIDENCE_PIXELS=12_000_000;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const contentTypes=new Set(["image/png","image/jpeg","image/webp"]);
function requireUUID(s:string){if(!uuid.test(s))throw new AppError(400,"INVALID_STORAGE_ID");return s;}
export function quarantineObjectKey(orgId:string,uploadId:string){
 return "quarantine/v1/"+requireUUID(orgId)+"/"+requireUUID(uploadId);
}
export function privateObjectKey(evidenceId:string){
 return "private/evidence/v1/"+requireUUID(evidenceId)+".webp";
}
export function validateUploadProposal(input:{contentType:string;size:number;checksumSha256:string}){
 if(!contentTypes.has(input.contentType))throw new AppError(415,"UNSUPPORTED_EVIDENCE_MEDIA");
 if(!Number.isSafeInteger(input.size)||input.size<1||input.size>MAX_EVIDENCE_BYTES)
  throw new AppError(413,"EVIDENCE_FILE_TOO_LARGE");
 if(!/^[a-zA-Z0-9+/]{43}=$/.test(input.checksumSha256) ||
  Buffer.from(input.checksumSha256,"base64").length!==32)
  throw new AppError(400,"INVALID_UPLOAD_CHECKSUM");
 return input;
}

let cached:S3Client|undefined;
function getStorage(){
 if(config.EVIDENCE_STORAGE_DRIVER!=="s3")throw new AppError(409,"S3_EVIDENCE_NOT_ENABLED");
 if(!cached){
  cached=new S3Client({
   region:config.EVIDENCE_S3_REGION!,
   endpoint:config.EVIDENCE_S3_ENDPOINT,
   forcePathStyle:config.EVIDENCE_S3_FORCE_PATH_STYLE==="true",
   credentials:{accessKeyId:config.EVIDENCE_S3_ACCESS_KEY_ID!,secretAccessKey:config.EVIDENCE_S3_SECRET_ACCESS_KEY!},
   maxAttempts:2
  });
 }
 return {client:cached,bucket:config.EVIDENCE_S3_BUCKET!};
}

async function boundedBytes(body:AsyncIterable<Uint8Array>|undefined,limit=MAX_EVIDENCE_BYTES):Promise<Buffer>{
 if(!body)throw new AppError(422,"EVIDENCE_OBJECT_MISSING_BODY");
 const chunks:Buffer[]=[];
 let total=0;
 for await(const chunk of body){
  const buf=Buffer.from(chunk);
  total+=buf.length;
  if(total>limit)throw new AppError(413,"EVIDENCE_FILE_TOO_LARGE");
  chunks.push(buf);
 }
 if(total===0)throw new AppError(422,"EMPTY_EVIDENCE_OBJECT");
 return Buffer.concat(chunks,total);
}

export async function presignQuarantinePut(args:{orgId:string;uploadId:string;contentType:string;size:number;checksumSha256:string}){
 validateUploadProposal(args);
 const {client,bucket}=getStorage();
 const key=quarantineObjectKey(args.orgId,args.uploadId);
 const headers={"content-type":args.contentType,"x-amz-checksum-sha256":args.checksumSha256};
 const command=new PutObjectCommand({
  Bucket:bucket,Key:key,ContentType:args.contentType,
  ContentLength:args.size,ChecksumSHA256:args.checksumSha256,
  Metadata:{"upload-id":args.uploadId}
 });
 const url=await getSignedUrl(client,command,{
  expiresIn:300,
  signableHeaders:new Set(["content-type","content-length"]),
  unhoistableHeaders:new Set(["x-amz-checksum-sha256"])
 });
 return {url,method:"PUT" as const,headers,expiresInSeconds:300};
}

export async function readQuarantinedUpload(args:{
 orgId:string;uploadId:string;contentType:string;size:number;checksumSha256:string
}):Promise<Buffer>{
 validateUploadProposal(args);
 const {client,bucket}=getStorage();
 const key=quarantineObjectKey(args.orgId,args.uploadId);
 let head;
 try{head=await client.send(new HeadObjectCommand({Bucket:bucket,Key:key}));}
 catch{throw new AppError(404,"QUARANTINE_OBJECT_NOT_FOUND");}
 if(head.ContentLength!==args.size||head.ContentLength>MAX_EVIDENCE_BYTES ||
   head.ContentType!==args.contentType)
  throw new AppError(422,"QUARANTINE_METADATA_MISMATCH");
 const object=await client.send(new GetObjectCommand({Bucket:bucket,Key:key}));
 const data=await boundedBytes(object.Body as AsyncIterable<Uint8Array>|undefined);
 if(data.length!==args.size)throw new AppError(422,"QUARANTINE_SIZE_MISMATCH");
 const checksum=createHash("sha256").update(data).digest("base64");
 if(checksum!==args.checksumSha256)throw new AppError(422,"QUARANTINE_CHECKSUM_MISMATCH");
 return data;
}
export async function saveSanitizedObject(buffer:Buffer,evidenceId=randomUUID()){
 requireUUID(evidenceId);
 if(buffer.length===0||buffer.length>MAX_EVIDENCE_BYTES)throw new AppError(413,"EVIDENCE_FILE_TOO_LARGE");
 const {client,bucket}=getStorage();
 const sha256=createHash("sha256").update(buffer).digest();
 await client.send(new PutObjectCommand({
  Bucket:bucket,Key:privateObjectKey(evidenceId),Body:buffer,ContentLength:buffer.length,
  ContentType:"image/webp",ChecksumSHA256:sha256.toString("base64"),
  Metadata:{sanitized:"true"}
 }));
 return {key:evidenceId,sha256:sha256.toString("hex"),size:buffer.length};
}
export async function loadSanitizedObject(evidenceId:string):Promise<Buffer>{
 const {client,bucket}=getStorage();
 let head;
 try{head=await client.send(new HeadObjectCommand({Bucket:bucket,Key:privateObjectKey(evidenceId)}));}
 catch{throw new AppError(404,"EVIDENCE_NOT_FOUND");}
 if(!head.ContentLength||head.ContentLength>MAX_EVIDENCE_BYTES||head.ContentType!=="image/webp")
  throw new AppError(404,"EVIDENCE_NOT_FOUND");
 const obj=await client.send(new GetObjectCommand({Bucket:bucket,Key:privateObjectKey(evidenceId)}));
 return boundedBytes(obj.Body as AsyncIterable<Uint8Array>|undefined);
}
export async function deleteQuarantineObject(orgId:string,uploadId:string){
 const {client,bucket}=getStorage();
 await client.send(new DeleteObjectCommand({Bucket:bucket,Key:quarantineObjectKey(orgId,uploadId)}));
}
export async function deleteSanitizedObject(evidenceId:string){
 const {client,bucket}=getStorage();
 await client.send(new DeleteObjectCommand({Bucket:bucket,Key:privateObjectKey(evidenceId)}));
}
