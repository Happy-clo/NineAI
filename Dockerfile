# 使用 Node.js 官方镜像作为基础镜像
FROM node:16

# 设置工作目录
WORKDIR /app

# 安装 pnpm
RUN npm install -g pnpm

# 复制 chat 项目文件
COPY chat/package.json chat/pnpm-lock.yaml ./chat/
COPY chat ./chat

# 安装 chat 依赖并构建
RUN cd chat && pnpm update && pnpm install && pnpm build

# 复制 admin 项目文件
COPY admin/package.json admin/pnpm-lock.yaml ./admin/
COPY admin ./admin

# 安装 admin 依赖并构建
RUN cd admin && pnpm update &&& pnpm add -D less && pnpm install && pnpm build

# 您可以选择暴露端口，尽管在这种配置中可能不是必需的
EXPOSE 3000 3001

# 设置容器的默认命令
CMD ["echo", "Builds complete. Please use the /app/chat/dist and /app/admin/dist directories for deployment."]
