import {config} from "../config.js";
import {provisionLineRichMenus} from "../services/line-rich-menus.js";

const menus=await provisionLineRichMenus({
 channelAccessToken:config.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN,
 liffId:config.VITE_LIFF_ID
});
console.log(`LINE_RICH_MENU_PROVISION_PASS roles=${Object.keys(menus).join(",")}`);
