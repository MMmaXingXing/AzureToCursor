/**
 * LangChain 使用示例
 * 
 * 注意：LangChain 的 ChatOpenAI 可能需要特殊配置才能使用自定义 baseURL
 * 如果直接使用不工作，可以：
 * 1. 直接调用 API 路由
 * 2. 或者使用 LangChain 的 fetch API 自定义实现
 */

import { createAzureLLM } from './llm-factory';

// 示例 1: 使用工厂函数创建 LLM
export async function example1() {
  const llm = createAzureLLM({
    modelName: 'gpt-4',
    temperature: 0.7,
  });

  try {
    // 避免不同版本类型不一致导致的编译错误
    const response = await (llm as any).invoke("Hello, how are you?");
    const content =
      typeof response === 'string'
        ? response
        : response?.content ?? JSON.stringify(response);
    console.log(content);
  } catch (error) {
    console.error('Error:', error);
  }
}

// 示例 2: 直接调用 API 路由（如果 LangChain 集成有问题）
export async function example2() {
  const response = await fetch('/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4',
      messages: [
        { role: 'user', content: 'Hello, how are you?' }
      ],
    }),
  });

  const data = await response.json();
  console.log(data);
}