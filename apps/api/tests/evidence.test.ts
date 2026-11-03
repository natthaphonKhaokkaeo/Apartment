import {describe,it,expect} from "vitest";
import sharp from "sharp";
import {loadPrivateEvidence,savePrivateEvidence,deletePrivateEvidence} from "../src/services/evidence.js";
describe("private evidence storage",()=>{
 it("accepts a real image, strips metadata, stores as sanitized webp",async()=>{
  const png=await sharp({create:{width:8,height:8,channels:3,background:{r:50,g:100,b:150}}}).png().toBuffer();
  const result=await savePrivateEvidence(png,"image/png");
  try{
   expect(result.sha256).toMatch(/^[a-f0-9]{64}$/);
   expect(result.key).toMatch(/^[0-9a-f-]{36}$/);
   const restored=await loadPrivateEvidence(result.key);
   const metadata=await sharp(restored).metadata();
   expect(metadata.format).toBe("webp");
   expect(metadata.exif).toBeUndefined();
   expect(metadata.width).toBe(8);
   expect(metadata.height).toBe(8);
  }finally{await deletePrivateEvidence(result.key);}
  await expect(loadPrivateEvidence(result.key)).rejects.toMatchObject({code:"EVIDENCE_NOT_FOUND"});
 });
 it("rejects mime mismatches and malformed images",async()=>{
  const bytes=Buffer.from("<script>alert(1)</script>");
  await expect(savePrivateEvidence(bytes,"image/png")).rejects.toMatchObject({code:"INVALID_EVIDENCE_IMAGE"});
  const jpeg=await sharp({create:{width:8,height:8,channels:3,background:{r:2,g:3,b:4}}}).jpeg().toBuffer();
  await expect(savePrivateEvidence(jpeg,"image/png")).rejects.toMatchObject({code:"INVALID_EVIDENCE_IMAGE"});
  await expect(savePrivateEvidence(bytes,"text/html")).rejects.toMatchObject({code:"UNSUPPORTED_EVIDENCE_MEDIA"});
  await expect(savePrivateEvidence(Buffer.alloc(4_000_001),"image/png")).rejects.toMatchObject({code:"EVIDENCE_FILE_TOO_LARGE"});
 });
 it("rejects path traversal on retrieval",async()=>{
  await expect(loadPrivateEvidence("../../secrets")).rejects.toMatchObject({code:"EVIDENCE_NOT_FOUND"});
 });
});
