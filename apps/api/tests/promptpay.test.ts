import {describe,it,expect} from "vitest";
import {buildPromptPayPayload,isValidPromptPayId,maskPromptPayId} from "../src/services/promptpay.js";

describe("P3-01b BOT merchant-presented PromptPay",()=>{
 it("uses the published mobile/100-baht EMV TLV golden vector including CRC",()=>{
  const x=buildPromptPayPayload("0812345678",10000);
  expect(x).toBe("00020101021229370016A000000677010111011300668123456785802TH53037645406100.006304BB8A");
 });
 it("normalizes 10 digit mobile numbers; 13 digit tax IDs use sub-tag 02 not phone",()=>{
  const phone=buildPromptPayPayload("0891234567",413000);
  expect(phone).toContain("01130066891234567");
  expect(phone).toContain("54074,130.00".replace(",","")); // amount 4130.00, 7 bytes
  const tax=buildPromptPayPayload("0123456789012",105);
  expect(tax).toContain("02130123456789012");
  expect(tax).toContain("54041.05");
  expect(tax).not.toContain("0113");
 });
 it("rejects unknown proxies, foreign phone and malformed account IDs",()=>{
  for(const id of ["","123","081234567","08123456789","001234567890","ABCD123456","001-234-5678","0712345678"])
    expect(isValidPromptPayId(id)).toBe(false);
  expect(isValidPromptPayId("0812345678")).toBe(true);
  expect(isValidPromptPayId("0123456789012")).toBe(true);
  expect(()=>buildPromptPayPayload("12345678901",100)).toThrow();
 });
 it("integer satang only; refuses zero, negative, excessive amount",()=>{
  for(const amount of [0,-1,NaN,Infinity,1.25,2147483648])
   expect(()=>buildPromptPayPayload("0812345678",amount)).toThrow();
  expect(buildPromptPayPayload("0812345678",1)).toContain("54040.01");
  expect(buildPromptPayPayload("0812345678",2147483647)).toContain("541121474836.47");
 });
 it("masks destination in UI while payload contains the full identifier",()=>{
  expect(maskPromptPayId("0812345678")).toBe("******5678");
  expect(maskPromptPayId("0123456789012")).toBe("*********9012");
 });
});
