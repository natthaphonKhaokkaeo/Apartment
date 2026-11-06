import {describe,it,expect,vi} from "vitest";
import {interpretLineIntent} from "../src/services/line-intent.js";
describe("AI intent interpretation",()=>{
 it("normalizes informal help requests",async()=>{
  const fetcher=vi.fn(async()=>new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({kind:"HELP",canonicalQuestion:"วิธีตั้งค่าแจ้งเตือนบิลผ่าน LINE OA"})}}]}),{status:200}));
  const result=await interpretLineIntent({question:"ตั้งค่าแจ้งบิลผ่านไลน์ยังไง",apiKey:"test",provider:"openrouter",fetcher:fetcher as typeof fetch});
  expect(result.kind).toBe("HELP");expect(result.canonicalQuestion).toContain("แจ้งเตือนบิล");
 });
 it("falls back safely without AI",async()=>{expect(await interpretLineIntent({question:"ยอดค้างฉันเท่าไร"})).toEqual({kind:"UNKNOWN",canonicalQuestion:"ยอดค้างฉันเท่าไร"});});
 it("rejects malformed classification",async()=>{const fetcher=vi.fn(async()=>new Response("{}",{status:200}));expect((await interpretLineIntent({question:"test",apiKey:"x",provider:"openrouter",fetcher:fetcher as typeof fetch})).kind).toBe("UNKNOWN");});
});
