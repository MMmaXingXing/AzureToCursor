# 安全说明

## 敏感信息处理

项目已实现敏感信息过滤机制，确保在日志、错误消息中不会泄露敏感信息。

### 自动过滤的敏感字段

以下字段会自动被过滤和隐藏：

- `apiKey` / `api-key` / `apikey` / `api_key`
- `authorization` / `authorization-bearer`
- `token` / `access_token` / `access-token`
- `secret`
- `password` / `passwd` / `pwd`

### 过滤方式

1. **完全隐藏**（默认）：敏感信息会被替换为 `[REDACTED]`
2. **部分屏蔽**（可选）：保留前 4 个字符和后 4 个字符，中间用 `*` 替换

### 应用场景

敏感信息过滤会在以下场景自动应用：

1. **错误日志**：所有错误消息中的敏感信息会被自动过滤
2. **API 响应**：错误响应中的敏感信息会被清理
3. **控制台输出**：日志输出中的敏感信息会被隐藏

### 示例

**原始错误消息**：
```
Azure OpenAI API error: 401 Unauthorized. {"error": {"message": "Invalid api-key: sk-1234567890abcdef..."}}
```

**过滤后的错误消息**：
```
Azure OpenAI API error: 401 Unauthorized. {"error": {"message": "Invalid api-key: [REDACTED]"}}
```

## 配置文件安全

### 环境变量

**推荐使用环境变量**来存储敏感配置：

1. 创建 `.env.local` 文件（不会被 Git 跟踪）
2. 添加敏感配置：
   ```env
   AZURE_OPENAI_ENDPOINT=https://...
   AZURE_OPENAI_API_KEY=your-secret-key
   ```

### 配置文件

如果使用配置文件 `lib/config/models.json`：

1. **不要提交包含真实密钥的配置文件**
2. 提交时使用示例配置：
   ```json
   {
     "default": {
       "endpoint": "https://your-resource.openai.azure.com",
       "apiKey": "your-api-key",
       "apiVersion": "2024-02-15-preview"
     }
   }
   ```

### Git 配置

项目已配置 `.gitignore`，以下文件不会被提交：

- `.env.local`
- `.env*.local`
- 包含真实密钥的 `lib/config/models.json`

**注意**：确保在提交前检查是否有敏感信息被意外提交。

## 最佳实践

### 1. 使用环境变量

**推荐**：使用环境变量存储敏感信息
```bash
# .env.local（不提交到 Git）
AZURE_OPENAI_API_KEY=your-actual-key
```

### 2. 不要硬编码密钥

**不推荐**：
```typescript
const apiKey = 'sk-1234567890...'; // 危险！
```

### 3. 定期轮换密钥

定期更新 Azure OpenAI API Key，确保安全。

### 4. 限制访问权限

- 只在需要的环境（开发、测试、生产）配置密钥
- 使用最小权限原则
- 不要在不安全的环境中暴露密钥

### 5. 监控和审计

- 定期检查日志中是否有敏感信息泄露
- 监控 API 使用情况
- 及时处理异常访问

## 工具函数

项目提供了敏感信息过滤工具函数：

```typescript
import { sanitizeError, sanitizeString, sanitizeObject } from '@/lib/utils/sanitize';

// 清理错误消息
const safeError = sanitizeError(error);

// 清理字符串
const safeString = sanitizeString(unsafeString);

// 清理对象
const safeObject = sanitizeObject(unsafeObject, { mask: false });
```

### 使用示例

```typescript
try {
  // 某些操作
} catch (error) {
  // 自动过滤敏感信息
  console.error('Error:', sanitizeError(error));
}
```

## 安全检查清单

在部署前，请确认：

- [ ] `.env.local` 文件没有被提交到 Git
- [ ] `lib/config/models.json` 中不包含真实的 API Key
- [ ] 所有环境变量的密钥都使用示例值
- [ ] 生产环境的密钥存储在安全的位置
- [ ] 日志输出中不包含敏感信息
- [ ] 错误消息中不泄露密钥信息

## 如果密钥泄露了怎么办？

如果发现密钥可能已经泄露：

1. **立即轮换密钥**：在 Azure Portal 中重新生成 API Key
2. **检查使用记录**：查看 Azure 使用日志，确认是否有异常访问
3. **更新配置**：更新所有环境中的密钥配置
4. **审查代码历史**：检查 Git 历史，确认密钥是否被提交
5. **通知团队**：通知相关团队成员更新密钥

## 更多资源

- [Azure OpenAI 安全最佳实践](https://learn.microsoft.com/en-us/azure/ai-services/openai/security)
- [Next.js 环境变量安全](https://nextjs.org/docs/basic-features/environment-variables#environment-variable-loading)