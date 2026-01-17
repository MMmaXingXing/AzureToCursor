import { ChatOpenAI } from '@langchain/openai';
import { getAzureConfig } from '@/lib/config/model-config';

/**
 * 创建配置好的 Azure OpenAI LLM 实例
 * 这个实例会通过本地 API 路由 (/api/chat) 调用 Azure OpenAI
 */
export function createAzureLLM(options?: {
  modelName?: string;
  temperature?: number;
  maxTokens?: number;
  baseURL?: string;
}): ChatOpenAI {
  const {
    modelName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-4',
    temperature = 0.7,
    maxTokens,
    baseURL = typeof window !== 'undefined' 
      ? `${window.location.origin}/api/chat`
      : process.env.NEXT_PUBLIC_API_URL 
        ? `${process.env.NEXT_PUBLIC_API_URL}/api/chat`
        : 'http://localhost:3000/api/chat',
  } = options || {};

  // 创建 ChatOpenAI 实例，指向本地 API 路由
  // 注意：Azure 认证在 API 路由中处理，这里使用占位符 API key
  const llm = new ChatOpenAI({
    modelName,
    temperature,
    maxTokens,
    openAIApiKey: 'dummy-key', // Azure 认证在 API 路由中处理，这里只需要一个占位符
    configuration: {
      baseURL, // 指向本地 API 路由
    },
  });

  return llm;
}

/**
 * 获取默认的 Azure LLM 实例
 */
export function getDefaultAzureLLM(): ChatOpenAI {
  return createAzureLLM();
}