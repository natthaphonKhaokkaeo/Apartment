import {defineConfig} from "vite";
export default defineConfig({server:{host:"127.0.0.1",port:5173,strictPort:true,proxy:{"/v1":"http://127.0.0.1:8088","/healthz":"http://127.0.0.1:8088"}}});
