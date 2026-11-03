import {describe,expect,it} from "vitest";
import {validateUploadProposal,privateObjectKey,quarantineObjectKey} from "../src/services/evidence-s3.js";
describe("S3 presigned payment evidence policy",()=>{
 it("only accepts supported image types and 4 MB maximum",()=>{
  const checksum=Buffer.alloc(32,5).toString("base64");
  expect(validateUploadProposal({contentType:"image/png",size:1000,checksumSha256:checksum})).toMatchObject({contentType:"image/png",size:1000,checksumSha256:checksum});
  expect(()=>validateUploadProposal({contentType:"application/pdf",size:1000,checksumSha256:checksum})).toThrow();
  expect(()=>validateUploadProposal({contentType:"image/png",size:4_000_001,checksumSha256:checksum})).toThrow();
  expect(()=>validateUploadProposal({contentType:"image/png",size:1000,checksumSha256:"bad"})).toThrow();
 });
 it("quarantine and final keys never depend on tenant input other than UUID",()=>{
  const org="77a56d80-157c-4ca1-bd4a-9767cff756bd";
  const ticket="018a2f92-6484-43d0-a4ab-18b57f192d40";
  expect(quarantineObjectKey(org,ticket)).toBe("quarantine/v1/"+org+"/"+ticket);
  expect(privateObjectKey(ticket)).toBe("private/evidence/v1/"+ticket+".webp");
  expect(()=>privateObjectKey("../secrets")).toThrow();
 });
});