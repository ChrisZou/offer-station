import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 仅允许当前本地安装的求职工作台扩展访问开发服务器。
  // vinext 会在路由处理前校验 Origin，因此仅配置 API CORS 不够。
  allowedDevOrigins: ["pgdcfbchemjfllcgnhppnmhmbifhbmac"],
};

export default nextConfig;
