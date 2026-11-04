import {describe,it,expect} from "vitest";
import {parseSatang} from "../../web/src/money.js";
describe("browser decimal input to integer satang",()=>{
 it.each([["0",0],["0.01",1],["12.34",1234],["1.1",110],["21474836.47",2147483647]])("parses %s exactly",(value,want)=>expect(parseSatang(value)).toBe(want));
 it.each(["1.005","-1","1e3","NaN","Infinity","","21474836.48","9007199254740993","1.2.3"])("rejects invalid or overflowing %s",value=>expect(()=>parseSatang(value)).toThrow());
});
