# Dify 和 Cursor 中转服务功能需求

## 核心目标
这个项目用于承接 **Dify** 和 **Cursor** 的中转请求，将 OpenAI 格式的请求转发到 Azure OpenAI，并返回标准格式响应。

---

## 必须实现的功能

### 1. OpenAI 兼容的 API 端点

#### ✅ `/api/v1/chat/completions` - 聊天补全接口
- **为什么需要**：Dify 和 Cursor 期望标准的 OpenAI API 路径
- **当前状态**：已实现 `/api/v1/chat/completions`
- **要求**：
  - 完全兼容 OpenAI API 格式
  - 支持 POST 请求
  - 接收 `messages`、`model`、`temperature` 等参数
  - 返回 OpenAI 标准格式响应

#### ✅ `/api/v1/models` - 模型列表接口
- **为什么需要**：Dify 和 Cursor 需要知道有哪些可用模型
- **当前状态**：未实现
- **要求**：
  - 返回可用模型列表（JSON 格式）
  - 格式兼容 OpenAI API 的 `/api/v1/models` 响应

### 2. 流式响应支持（Streaming）

- **为什么需要**：Dify 和 Cursor 可能需要实时流式响应
- **当前状态**：未实现
- **要求**：
  - 支持 `stream: true` 参数
  - 返回 Server-Sent Events (SSE) 格式的流式响应
  - 如果 Azure 支持流式，则转发流式响应

### 3. 请求转发与格式转换

- **为什么需要**：OpenAI 格式 → Azure OpenAI 格式
- **当前状态**：✅ 已实现基础转换
- **需要优化**：
  - 确保所有参数正确映射
  - 处理 Azure 特有的参数（deployment name）
  - 确保响应格式完全兼容

### 4. 身份验证（可选但推荐）

- **为什么需要**：保护中转服务不被滥用
- **当前状态**：未实现
- **要求**：
  - 支持 API Key 验证（Bearer Token）
  - 可以在配置中设置允许的 API Key
  - 如果不设置，则不验证（便于开发）

### 5. 配置管理

- **为什么需要**：在 Cursor 中配置 URL 和授权码
- **当前状态**：✅ 已实现环境变量和配置文件
- **要求**：
  - 支持 `.env.local` 配置
  - 支持配置文件配置
  - 配置项：
    - `AZURE_OPENAI_ENDPOINT`: Azure 端点 URL
    - `AZURE_OPENAI_API_KEY`: API 密钥
    - `AZURE_OPENAI_DEPLOYMENT_NAME`: 部署名称
    - `AZURE_OPENAI_API_VERSION`: API 版本

---

## 可选但有用的功能

### 6. 日志记录
- 记录请求和响应（脱敏处理）
- 记录错误和性能指标
- 便于调试和监控

### 7. 错误处理增强
- 统一的错误格式
- 友好的错误消息
- 错误码映射（Azure 错误码 → OpenAI 错误码）

### 8. 健康检查端点
- `/health` 或 `/api/v1/health` 端点
- 检查配置和连接状态

### 9. CORS 支持
- 允许浏览器跨域请求
- 配置允许的来源

---

## Dify 和 Cursor 的集成方式

### Cursor 配置
在 Cursor 中配置：
```
Base URL: http://localhost:3000/api/v1
API Key: (可选，如果实现了验证)
Model: (使用配置中的部署名称)
```

### Dify 配置
在 Dify 中添加自定义模型：
```
API 端点: http://localhost:3000/api/v1
API Key: (可选)
模型名称: (使用配置中的部署名称)
```

---

## 当前项目需要调整的地方

1. **API 路由路径**：
   - 当前：`/api/chat`
   - 需要：`/api/v1/chat/completions`

2. **添加模型列表端点**：
   - 新增：`/api/v1/models`

3. **流式响应支持**：
   - 在 `/api/v1/chat/completions` 中支持 `stream: true`

4. **可选：移除 LangChain 依赖**：
   - 如果只做中转，可以不依赖 LangChain
   - 但保留也无妨，不影响中转功能

---

## 实现优先级

### 高优先级（必须）
1. ✅ 修改 API 路径为 `/api/v1/chat/completions`
2. ✅ 实现 `/api/v1/models` 端点
3. ✅ 确保 OpenAI 格式完全兼容

### 中优先级（推荐）
4. ⚠️ 添加流式响应支持
5. ⚠️ 添加身份验证（可选）

### 低优先级（可选）
6. 日志记录增强
7. 健康检查端点
8. 性能优化

---

## 测试建议

使用 curl 或 Postman 测试：

```bash
# 测试聊天接口
curl -X POST http://localhost:3000/api/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'

# 测试模型列表
curl http://localhost:3000/api/v1/models
```

然后在 Cursor 和 Dify 中配置使用。