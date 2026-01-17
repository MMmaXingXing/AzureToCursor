# Azure to Cursor

用于 **Dify** 和 **Cursor** 的 Azure OpenAI 中转服务，兼容 OpenAI API。

## 功能
- OpenAI 标准端点：`/api/v1/chat/completions`、`/api/v1/models`
- 多模型配置（环境变量或 `models.json`）
- 流式响应（SSE）
- 敏感信息脱敏

## 快速开始

```bash
npm install
cp .env.local.example .env.local
npm run dev
```

### 配置（推荐：多模型）

```env
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
AZURE_OPENAI_API_KEY=your-api-key
AZURE_OPENAI_API_VERSION=2024-02-15-preview

AZURE_MODEL_gpt4_DEPLOYMENT_NAME=gpt-4-deployment
AZURE_MODEL_gpt4o_DEPLOYMENT_NAME=gpt-4o-deployment
```

或使用 `lib/config/models.json`（示例见 `lib/config/models.json.example`）。

## 端点
- `POST /api/v1/chat/completions`
- `GET /api/v1/models`

## 使用示例

```bash
curl -X POST http://localhost:3000/api/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

```bash
curl http://localhost:3000/api/v1/models
```

## Dify / Cursor 配置

- **Base URL / API 端点**: `http://localhost:3000/api/v1`
- **API Key**: 可选（如启用校验）
- **Model**: `gpt-4` / `gpt-4o` / `gpt-5.2` / `gpt-5.2-codex`

> Cursor 可能阻止访问本地地址（SSRF）。可用公网域名或内网穿透。

## 安全
详见 `SECURITY.md`。请勿提交包含真实密钥的 `models.json` 或 `.env.local`。

## 许可证
MIT