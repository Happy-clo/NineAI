# 第一阶段：编译 chat 项目
FROM node:18 AS chat-builder
WORKDIR /app/chat

# 安装 pnpm
RUN npm install -g pnpm

COPY ./chat .
RUN pnpm update && pnpm install && pnpm build

# 第二阶段：编译 admin 项目
FROM node:18 AS admin-builder
WORKDIR /app/admin

# 安装 pnpm
RUN npm install -g pnpm

COPY ./admin .
RUN pnpm update && pnpm add -D less && pnpm install && pnpm build

# 第三阶段：将编译后的文件复制到新的镜像中
FROM node:18
WORKDIR /app

# 安装 pnpm
RUN npm install -g pnpm

COPY . .
COPY --from=chat-builder /app/chat ./chat
COPY --from=admin-builder /app/admin ./admin

# 暴露端口
EXPOSE 9520

# 设置容器的默认命令
CMD ["pnpm", "start"]
