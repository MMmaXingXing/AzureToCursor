# LangChain 核心概念说明

## 1. 记忆（Memory）- 让 AI 记住对话历史

### 作用
记忆功能让 LLM 能够记住之前的对话内容，实现多轮对话的上下文理解。

### 为什么需要？
- **没有记忆**：每次提问都是独立的，AI 不知道你之前说了什么
- **有记忆**：AI 能理解上下文，进行连贯的多轮对话

### 示例场景

```
用户: "我叫张三"
AI: "你好，张三！"
用户: "我今年25岁"
AI: "好的，张三，你25岁"
用户: "我的名字是什么？"  // 没有记忆的 AI 会不知道，有记忆的 AI 会说"张三"
```

### 代码示例

```typescript
import { ConversationChain } from 'langchain/chains';
import { BufferMemory } from 'langchain/memory';
import { createAzureLLM } from './llm-factory';

const llm = createAzureLLM();

// 创建带记忆的链
const memory = new BufferMemory(); // 短期记忆（对话中）
const chain = new ConversationChain({
  llm: llm,
  memory: memory,
});

// 第一次对话
await chain.call({ input: "我叫张三" });
// AI: "你好，张三！"

// 第二次对话，AI 记得之前的内容
await chain.call({ input: "我的名字是什么？" });
// AI: "你的名字是张三"
```

### 记忆类型
- **BufferMemory**: 保存最近的对话（短期记忆）
- **ConversationSummaryMemory**: 总结之前的对话（长期记忆）
- **VectorStoreMemory**: 使用向量数据库存储记忆（大规模记忆）

---

## 2. 链式调用（Chains）- 将多个步骤串联

### 作用
链式调用将多个 LLM 调用或其他操作串联起来，实现复杂的任务流程。

### 为什么需要？
单个 LLM 调用通常只能完成一个简单任务，链式调用可以：
- 将复杂任务拆分成多个步骤
- 每个步骤的输出作为下一步的输入
- 实现更复杂的应用逻辑

### 示例场景

**任务**: 分析一篇文章的情感，然后用该情感风格写一首诗

```
步骤1: 分析文章情感 → "积极向上"
步骤2: 使用"积极向上"的风格 → 写一首诗
```

### 代码示例

```typescript
import { LLMChain } from 'langchain/chains';
import { PromptTemplate } from 'langchain/prompts';
import { createAzureLLM } from './llm-factory';

const llm = createAzureLLM();

// 第一步：分析情感
const sentimentPrompt = PromptTemplate.fromTemplate(
  "分析以下文章的情感: {article}\n情感:"
);
const sentimentChain = new LLMChain({
  llm: llm,
  prompt: sentimentPrompt,
});

// 第二步：写诗
const poemPrompt = PromptTemplate.fromTemplate(
  "用{emotion}的风格写一首诗:"
);
const poemChain = new LLMChain({
  llm: llm,
  prompt: poemPrompt,
});

// 链式执行
const article = "今天天气真好，阳光明媚！";
const sentimentResult = await sentimentChain.call({ article });
const emotion = sentimentResult.text; // "积极、愉快"

const poemResult = await poemChain.call({ emotion });
console.log(poemResult.text); // 一首积极向上的诗
```

### 常见链类型
- **LLMChain**: 简单的 LLM 调用链
- **SequentialChain**: 顺序执行多个链
- **RouterChain**: 根据输入路由到不同的链
- **SimpleSequentialChain**: 简单的顺序链

---

## 3. RAG（检索增强生成）- 让 AI 基于知识库回答

### 作用
RAG 让 LLM 能够从外部知识库检索相关信息，然后基于这些信息生成回答，而不是仅依赖模型训练时的知识。

### 为什么需要？
- **LLM 的局限**：只能回答训练时的知识，不知道最新信息、私有文档、特定领域知识
- **RAG 的解决**：从向量数据库检索相关文档，将检索内容作为上下文，让 LLM 基于这些信息回答

### 工作流程

```
1. 用户提问: "公司的请假政策是什么？"
   ↓
2. 向量检索: 从知识库中找到相关文档（如员工手册的相关章节）
   ↓
3. 组合上下文: 将检索到的文档 + 用户问题 → 形成完整提示
   ↓
4. LLM 生成: 基于文档内容生成准确回答
```

### 示例场景

**场景**: 公司内部文档问答系统

```
知识库: 
- 员工手册 PDF
- 公司规章制度
- 产品文档

用户: "年假有多少天？"
RAG 流程:
1. 从员工手册中检索"年假"相关内容
2. 找到: "员工每年享有15天年假"
3. LLM 基于这个信息回答: "根据员工手册，每年有15天年假"
```

### 代码示例

```typescript
import { Document } from 'langchain/document';
import { MemoryVectorStore } from 'langchain/vectorstores/memory';
import { OpenAIEmbeddings } from '@langchain/openai';
import { RetrievalQAChain } from 'langchain/chains';
import { createAzureLLM } from './llm-factory';

// 1. 准备文档（通常是加载 PDF、网页等）
const documents = [
  new Document({
    pageContent: "公司年假政策：员工每年享有15天年假，入职满一年后可使用。",
    metadata: { source: "员工手册" }
  }),
  new Document({
    pageContent: "病假政策：员工每年享有10天病假，需要提供医生证明。",
    metadata: { source: "员工手册" }
  }),
];

// 2. 创建向量存储（将文档转换为向量并存储）
const vectorStore = await MemoryVectorStore.fromDocuments(
  documents,
  new OpenAIEmbeddings() // 或者使用 Azure OpenAI Embeddings
);

// 3. 创建 RAG 链
const llm = createAzureLLM();
const chain = RetrievalQAChain.fromLLM(llm, vectorStore.asRetriever());

// 4. 提问（会自动检索相关文档并回答）
const result = await chain.call({
  query: "年假有多少天？"
});

console.log(result.text);
// "根据员工手册，员工每年享有15天年假，入职满一年后可使用。"
```

### RAG 的优势
- ✅ 回答基于实际文档，更准确
- ✅ 可以处理最新信息（文档更新即可）
- ✅ 可以处理私有/特定领域知识
- ✅ 回答可追溯来源（知道引用了哪个文档）

### RAG 的组件
- **向量存储（Vector Store）**: 存储文档的向量表示（如 Pinecone、Chroma、本地内存）
- **检索器（Retriever）**: 根据问题检索相关文档
- **LLM**: 基于检索到的文档生成最终回答

---

## 实际应用场景

### 场景 1: 智能客服（需要记忆 + RAG）
```
- 记忆：记住用户的订单信息、历史问题
- RAG：从产品文档中检索答案
- 链式调用：理解问题 → 检索文档 → 生成回答 → 记录对话
```

### 场景 2: 代码助手（需要链式调用）
```
- 链式调用：分析需求 → 生成代码 → 代码审查 → 优化建议
```

### 场景 3: 文档问答系统（主要用 RAG）
```
- RAG：用户提问 → 检索相关文档 → 生成回答
```

## 总结对比

| 功能 | 解决的问题 | 典型场景 |
|------|-----------|---------|
| **记忆** | AI 不记得之前的对话 | 多轮对话、上下文理解 |
| **链式调用** | 单个 LLM 调用无法完成复杂任务 | 多步骤任务、工作流 |
| **RAG** | AI 不知道特定知识或最新信息 | 文档问答、知识库查询 |

三个功能经常组合使用：
- **记忆 + RAG**: 智能客服（记住对话 + 检索知识库）
- **链式调用 + RAG**: 复杂问答系统（多步骤分析 + 检索信息）
- **记忆 + 链式调用 + RAG**: 完整的 AI 助手（全功能）