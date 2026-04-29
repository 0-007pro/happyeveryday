import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";

import { qqbotPlugin } from "./src/channel.js";
import { setQQBotRuntime } from "./src/runtime.js";
import { registerChannelTool } from "./src/tools/channel.js";
import { registerRemindTool } from "./src/tools/remind.js";

const plugin = {
  id: "openclaw-qqbot",
  name: "QQ Bot",
  description: "QQ Bot channel plugin",
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenClawPluginApi) {
    setQQBotRuntime(api.runtime);
    api.registerChannel({ plugin: qqbotPlugin as any });
    registerChannelTool(api);
    registerRemindTool(api);
  },
};

export default plugin;
export { qqbotPlugin } from "./src/channel.js";
export { setQQBotRuntime, getQQBotRuntime } from "./src/runtime.js";
