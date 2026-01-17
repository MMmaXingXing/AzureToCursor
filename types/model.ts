/**
 * Azure OpenAI 配置类型
 */
export interface AzureConfig {
  endpoint: string;
  apiKey: string;
  deploymentName: string;
  apiVersion?: string;
  modelType?: 'chat' | 'codex'; // 模型类型：chat 使用 /chat/completions，codex 使用 /completions
}

/**
 * 模型配置类型（支持多个模型）
 */
export interface ModelConfig {
  // 默认配置（如果模型没有单独配置，使用默认配置）
  default?: {
    endpoint: string;
    apiKey: string;
    apiVersion?: string;
  };
  // 模型配置映射：模型名 -> 配置
  models?: {
    [modelName: string]: {
      endpoint?: string;  // 可选，如果未指定则使用 default.endpoint
      apiKey?: string;    // 可选，如果未指定则使用 default.apiKey
      deploymentName: string;
      apiVersion?: string; // 可选，如果未指定则使用 default.apiVersion
      modelType?: 'chat' | 'codex'; // 模型类型：chat 使用 /chat/completions，codex 使用 /completions
    };
  };
  // 向后兼容：保留旧的 azure 配置格式
  azure?: AzureConfig;
}

/**
 * OpenAI 格式的聊天消息
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * OpenAI 格式的聊天请求
 */
export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string | string[];
  stream?: boolean;
}

/**
 * OpenAI 格式的聊天响应
 */
export interface ChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: ChatMessage;
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Codex 格式的请求
 */
export interface CodexRequest {
  model?: string;
  prompt: string;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string | string[];
  stream?: boolean;
}

/**
 * Codex 格式的响应
 */
export interface CodexResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    text: string;
    index: number;
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}