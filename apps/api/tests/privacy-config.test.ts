import {spawnSync} from "node:child_process";
import {describe,it,expect} from "vitest";
function check(extra:Record<string,string>){
 return spawnSync(process.execPath,["--import","tsx","--input-type=module","-e","try{await import('./src/config.ts');console.log('PRIVACY_CONFIG_ACCEPTED')}catch(e){console.error(e.message.includes('PRIVACY_APPROVED_POLICY_CONFIGURATION_REQUIRED')?'PRIVACY_APPROVED_POLICY_CONFIGURATION_REQUIRED':'PRIVACY_CONFIG_INVALID');process.exitCode=12}"],{cwd:process.cwd(),env:{...process.env,NODE_ENV:"test",DATABASE_URL:"postgresql://unused:unused@127.0.0.1:1/unused",LINE_CHANNEL_ID:"synthetic-policy-test",WEB_ORIGIN:"http://localhost:5173",COOKIE_SECURE:"false",PRIVACY_PROFILE_ANONYMIZATION_APPROVED:"false",PRIVACY_PROFILE_RETENTION_DAYS:"",PRIVACY_POLICY_EVIDENCE_REF:"",...extra},encoding:"utf8",timeout:5000});
}
describe("profile execution configuration gate",()=>{
 it("defaults to disabled with no retention policy inferred",()=>{const r=check({});expect(r.status).toBe(0);expect(r.stdout).toContain("PRIVACY_CONFIG_ACCEPTED");});
 it("rejects approval without a retention period",()=>{const r=check({PRIVACY_PROFILE_ANONYMIZATION_APPROVED:"true",PRIVACY_POLICY_EVIDENCE_REF:"TEST_ONLY_NO_REAL_APPROVAL"});expect(r.status).toBe(12);expect(r.stderr).toContain("PRIVACY_APPROVED_POLICY_CONFIGURATION_REQUIRED");});
 it("rejects approval without actual policy reference",()=>{const r=check({PRIVACY_PROFILE_ANONYMIZATION_APPROVED:"true",PRIVACY_PROFILE_RETENTION_DAYS:"30"});expect(r.status).toBe(12);expect(r.stderr).toContain("PRIVACY_APPROVED_POLICY_CONFIGURATION_REQUIRED");});
 it("accepts complete synthetic test-only policy settings",()=>{expect(check({PRIVACY_PROFILE_ANONYMIZATION_APPROVED:"true",PRIVACY_PROFILE_RETENTION_DAYS:"30",PRIVACY_POLICY_EVIDENCE_REF:"TEST_ONLY_NO_REAL_APPROVAL"}).status).toBe(0);});
 it("rejects zero, fractional and excessive policy durations",()=>{for(const days of ["0","1.5","36501"])expect(check({PRIVACY_PROFILE_RETENTION_DAYS:days}).status).toBe(12);});
});
