import { AzureConfig, ChatRequest, ChatResponse, CodexRequest, CodexResponse } from '@/types/model';
import { sanitizeString } from '@/lib/utils/sanitize';

/**
 * 将 messages 转换为 prompt（用于 codex 模型）
 */
function messagesToPrompt(messages: Array<{ role: string; content: string }>): string {
  return messages
    .map(msg => {
      const role = msg.role === 'system' ? 'System' : msg.role === 'assistant' ? 'Assistant' : 'User';
      return `${role}: ${msg.content}`;
    })
    .join('\n\n') + '\n\nAssistant:';
}

/**
 * 将 OpenAI messages 转换为 Responses API 的 input 格式
 * Responses API 推荐 content 为内容块数组（type + text）
 */
function messagesToResponsesInput(messages: Array<{ role: string; content: string }>) {
  return messages.map(message => ({
    role: message.role,
    content: [
      {
        type: 'input_text',
        text: message.content,
      },
    ],
  }));
}

/**
 * 从 Responses API 的 output 中提取文本内容
 */
function extractResponsesOutputText(output: any): string {
  if (!output) {
    return '';
  }

  const outputItems = Array.isArray(output) ? output : [output];
  const texts: string[] = [];

  for (const item of outputItems) {
    if (typeof item === 'string') {
      texts.push(item);
      continue;
    }

    if (item?.type === 'message' && Array.isArray(item.content)) {
      for (const contentItem of item.content) {
        if (contentItem?.type === 'output_text' && typeof contentItem.text === 'string') {
          texts.push(contentItem.text);
        } else if (contentItem?.type === 'text' && typeof contentItem.text === 'string') {
          texts.push(contentItem.text);
        }
      }
      continue;
    }

    if (item?.type === 'output_text' && typeof item.text === 'string') {
      texts.push(item.text);
      continue;
    }

    if (typeof item?.text === 'string') {
      texts.push(item.text);
      continue;
    }

    if (typeof item?.content === 'string') {
      texts.push(item.content);
      continue;
    }
  }

  return texts.filter(Boolean).join('\n');
}

/**
 * 将 Responses API 响应转换为 Chat 响应格式
 * 根据 OpenAI Responses API 文档，响应格式与标准 Chat Completion 格式兼容
 * 优化转换逻辑，优先使用标准格式，提高处理效率
 */
function codexToChatResponse(azureResponse: any, originalRequest: ChatRequest): ChatResponse {
  // Responses API 可能使用 output 数组而不是 choices 数组
  // 优先检查 Responses API 的 output 格式
  if (azureResponse.output && Array.isArray(azureResponse.output) && azureResponse.output.length > 0) {
    // Responses API 格式：使用 output 数组
    const content = extractResponsesOutputText(azureResponse.output);
    
    // 转换 usage 字段
    let usage: any = {
      prompt_tokens: azureResponse.usage?.input_tokens ?? azureResponse.usage?.prompt_tokens ?? 0,
      completion_tokens: azureResponse.usage?.output_tokens ?? azureResponse.usage?.completion_tokens ?? 0,
      total_tokens: azureResponse.usage?.total_tokens ?? 0,
    };
    if (!usage.total_tokens) {
      usage.total_tokens = usage.prompt_tokens + usage.completion_tokens;
    }
    
    return {
      id: azureResponse.id ?? `resp_${Date.now()}`,
      object: azureResponse.object ?? 'chat.completion',
      created: azureResponse.created ?? Math.floor(Date.now() / 1000),
      model: originalRequest.model || azureResponse.model || 'unknown',
      choices: [{
        index: 0,
        message: {
          role: 'assistant' as const,
          content: content,
        },
        finish_reason: azureResponse.finish_reason ?? 'stop',
      }],
      usage,
    };
  }
  
  // 检查是否有 output_text 字段（Responses API 的另一种格式）
  if (azureResponse.output_text) {
    let usage: any = {
      prompt_tokens: azureResponse.usage?.input_tokens ?? azureResponse.usage?.prompt_tokens ?? 0,
      completion_tokens: azureResponse.usage?.output_tokens ?? azureResponse.usage?.completion_tokens ?? 0,
      total_tokens: azureResponse.usage?.total_tokens ?? 0,
    };
    if (!usage.total_tokens) {
      usage.total_tokens = usage.prompt_tokens + usage.completion_tokens;
    }
    
    return {
      id: azureResponse.id ?? `resp_${Date.now()}`,
      object: 'chat.completion',
      created: azureResponse.created ?? Math.floor(Date.now() / 1000),
      model: originalRequest.model || azureResponse.model || 'unknown',
      choices: [{
        index: 0,
        message: {
          role: 'assistant' as const,
          content: typeof azureResponse.output_text === 'string'
            ? azureResponse.output_text
            : azureResponse.output_text.text || azureResponse.output_text.content || '',
        },
        finish_reason: azureResponse.finish_reason ?? 'stop',
      }],
      usage,
    };
  }
  
  // Responses API 也可能返回标准 Chat Completion 格式（包含 choices 数组）
  // 这是向后兼容的情况
  if (azureResponse.choices && Array.isArray(azureResponse.choices) && azureResponse.choices.length > 0) {
    // 标准格式：直接转换，只需调整 model 字段使用原始请求的模型名
    const choices = azureResponse.choices.map((choice: any, idx: number) => {
      // 提取内容：检查所有可能的字段位置
      let content = '';
      
      // 检查所有可能的内容位置（按优先级）
      if (choice.message?.content) {
        content = choice.message.content;
      } else if (choice.output !== undefined) {
        // Responses API 可能将内容放在 output 字段
        if (typeof choice.output === 'string') {
          content = choice.output;
        } else if (typeof choice.output === 'object') {
          content = choice.output.text || choice.output.content || choice.output.message || '';
        }
      } else if (choice.content !== undefined) {
        // 或者直接在 content 字段
        content = typeof choice.content === 'string' ? choice.content : '';
      } else if (choice.text !== undefined) {
        // 或者从 text 字段
        content = typeof choice.text === 'string' ? choice.text : '';
      } else if (choice.delta?.content) {
        // 流式响应的 delta 字段
        content = choice.delta.content;
      } else if (choice.message && typeof choice.message === 'string') {
        // message 本身可能是字符串
        content = choice.message;
      }
      
      // 如果内容仍为空，记录警告
      if (!content && azureResponse.usage?.output_tokens > 0) {
        console.warn(`[Responses API] Warning: Empty content for choice ${idx}. Choice keys:`, Object.keys(choice));
      }
      
      return {
        index: choice.index ?? idx,
        message: {
          role: (choice.message?.role || 'assistant') as 'assistant',
          content: content,
        },
        finish_reason: choice.finish_reason ?? 'stop',
      };
    });

    // 转换 usage 字段：Responses API 使用 input_tokens/output_tokens，需要转换为标准格式
    let usage: any = {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
    };
    
    if (azureResponse.usage) {
      // Responses API 使用 input_tokens/output_tokens
      if (azureResponse.usage.input_tokens !== undefined) {
        usage.prompt_tokens = azureResponse.usage.input_tokens;
      } else if (azureResponse.usage.prompt_tokens !== undefined) {
        usage.prompt_tokens = azureResponse.usage.prompt_tokens;
      }
      
      if (azureResponse.usage.output_tokens !== undefined) {
        usage.completion_tokens = azureResponse.usage.output_tokens;
      } else if (azureResponse.usage.completion_tokens !== undefined) {
        usage.completion_tokens = azureResponse.usage.completion_tokens;
      }
      
      if (azureResponse.usage.total_tokens !== undefined) {
        usage.total_tokens = azureResponse.usage.total_tokens;
      } else {
        usage.total_tokens = usage.prompt_tokens + usage.completion_tokens;
      }
    }
    
    return {
      id: azureResponse.id ?? `resp_${Date.now()}`,
      object: azureResponse.object ?? 'chat.completion',
      created: azureResponse.created ?? Math.floor(Date.now() / 1000),
      model: originalRequest.model || azureResponse.model || 'unknown',
      choices,
      usage,
    };
  }
  
  // 处理 Responses API 可能的顶层 output 字段格式
  if (azureResponse.output !== undefined) {
    let outputContent = '';
    if (typeof azureResponse.output === 'string') {
      outputContent = azureResponse.output;
    } else if (typeof azureResponse.output === 'object') {
      // 检查 output 对象的各种可能字段
      outputContent = azureResponse.output.text || 
                     azureResponse.output.content || 
                     azureResponse.output.message ||
                     (azureResponse.output.choices?.[0]?.message?.content) ||
                     '';
    }
    
    // 转换 usage 字段
    let usage: any = {
      prompt_tokens: azureResponse.usage?.input_tokens ?? azureResponse.usage?.prompt_tokens ?? 0,
      completion_tokens: azureResponse.usage?.output_tokens ?? azureResponse.usage?.completion_tokens ?? 0,
      total_tokens: azureResponse.usage?.total_tokens ?? 0,
    };
    if (!usage.total_tokens) {
      usage.total_tokens = usage.prompt_tokens + usage.completion_tokens;
    }
    
    return {
      id: azureResponse.id ?? `resp_${Date.now()}`,
      object: 'chat.completion',
      created: azureResponse.created ?? Math.floor(Date.now() / 1000),
      model: originalRequest.model || azureResponse.model || 'unknown',
      choices: [{
        index: 0,
        message: {
          role: 'assistant' as const,
          content: outputContent,
        },
        finish_reason: azureResponse.finish_reason ?? 'stop',
      }],
      usage,
    };
  }
  
  // 兜底处理：如果响应格式不符合预期，记录警告并返回最小有效响应
  // 这种情况应该很少发生，通常表示 API 返回了意外格式
  const responseId = azureResponse.id ?? `resp_${Date.now()}`;
  console.warn(`[Responses API] Unexpected response format for ${responseId}:`, 
    JSON.stringify(azureResponse).substring(0, 300));
  
  return {
    id: responseId,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: originalRequest.model || azureResponse.model || 'unknown',
    choices: [{
      index: 0,
      message: {
        role: 'assistant' as const,
        content: '',
      },
      finish_reason: 'stop',
    }],
    usage: {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
    },
  };
}

/**
 * 将 OpenAI 格式的请求转换为 Azure OpenAI 格式
 * 支持 chat 和 codex 两种模型类型
 */
export async function adaptRequestToAzure(
  request: ChatRequest,
  config: AzureConfig
): Promise<Response> {
  const { endpoint, apiKey, deploymentName, apiVersion, modelType } = config;
  const isCodex = modelType === 'codex';

  const baseUrl = endpoint.replace(/\/$/, ''); // 移除末尾斜杠
  let azureUrl: string;
  let requestBody: any;
  let headers: Record<string, string>;

  const stripUnsupportedParams = (payload: Record<string, any>) => {
    // Azure OpenAI doesn't accept OpenAI Responses API stream_options/include
    if (payload.stream_options && typeof payload.stream_options === 'object') {
      delete payload.stream_options;
    }
    if (payload.stream_options?.include_usage !== undefined) {
      delete payload.stream_options;
    }
    if (payload.include !== undefined) {
      delete payload.include;
    }
    if (payload.reasoning !== undefined) {
      delete payload.reasoning;
    }
    if (payload.text !== undefined) {
      delete payload.text;
    }
    if (Array.isArray(payload.tools)) {
      const sanitizedTools = payload.tools.filter((tool: any) => {
        if (!tool || typeof tool !== 'object') return false;
        if (tool.type !== 'function') return false;
        return Boolean(tool.function && typeof tool.function === 'object' && tool.function.name);
      });
      if (sanitizedTools.length > 0) {
        payload.tools = sanitizedTools;
      } else {
        delete payload.tools;
      }
    }
  };

  if (isCodex) {
    // Codex 模型使用 /openai/responses 端点
    azureUrl = `${baseUrl}/openai/responses?api-version=${apiVersion || '2025-04-01-preview'}`;
    
    // Responses API 请求格式：使用 input 字段（而不是 messages），使用 max_output_tokens
    const { model, messages, max_tokens, stream, input: _input, ...otherParams } = request as any;
    
    // 构建符合 Responses API 规范的请求体
    requestBody = {
      input: messagesToResponsesInput(messages), // Responses API 使用结构化 input
      model: deploymentName,
      ...otherParams,
    };
    stripUnsupportedParams(requestBody);
    
    // 转换参数名称（Responses API 使用 max_output_tokens 而不是 max_tokens）
    if (max_tokens !== undefined) {
      requestBody.max_output_tokens = max_tokens;
    } else if (!requestBody.max_output_tokens) {
      requestBody.max_output_tokens = 16384; // 默认值
    }
    
    // 如果支持 stream，保留 stream 参数
    if (stream !== undefined) {
      requestBody.stream = stream;
    }
    
    // Codex 端点支持 Bearer token 或 api-key
    headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`, // 使用 Bearer token
    };
  } else {
    // Chat 模型使用 /chat/completions 端点
    azureUrl = `${baseUrl}/openai/deployments/${deploymentName}/chat/completions?api-version=${apiVersion || '2024-02-15-preview'}`;
    
    // Chat 模型使用 messages，移除 model 字段与 input
    const { model, input: _input, ...rest } = request as any;
    requestBody = { ...rest };
    stripUnsupportedParams(requestBody);
    
    headers = {
      'Content-Type': 'application/json',
      'api-key': apiKey,
    };
  }

  // 发送请求到 Azure OpenAI
  const response = await fetch(azureUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('11111111111 Azure OpenAI error body 11111111111', errorText);
    // 清理错误消息中的敏感信息
    const safeErrorText = sanitizeString(errorText);
    throw new Error(
      `Azure OpenAI API error: ${response.status} ${response.statusText}. ${safeErrorText}`
    );
  }

  return response;
}

/**
 * 将 Azure OpenAI 响应转换为 OpenAI 格式
 * 支持 chat 和 codex 两种模型类型
 */
export async function adaptResponseFromAzure(
  response: Response,
  originalRequest: ChatRequest,
  config: AzureConfig
): Promise<ChatResponse> {
  const azureResponse = await response.json();
  const isCodex = config.modelType === 'codex';

  // 如果是 codex 模型（Responses API），需要转换响应格式
  if (isCodex) {
    // 添加详细调试日志：打印完整响应结构以便排查问题
    const hasOutputTokens = (azureResponse.usage?.output_tokens || azureResponse.usage?.completion_tokens) > 0;
    const hasEmptyContent = !azureResponse.choices?.[0]?.message?.content && 
                           !azureResponse.choices?.[0]?.output &&
                           !azureResponse.output &&
                           !azureResponse.choices?.[0]?.text;
    
    if (hasOutputTokens && hasEmptyContent) {
      console.log('[Responses API] ⚠️  Debug: Response has output tokens but empty content.');
      console.log('[Responses API] Response ID:', azureResponse.id);
      console.log('[Responses API] Full response structure:');
      console.log(JSON.stringify(azureResponse, null, 2));
      console.log('[Responses API] Choice structure:', JSON.stringify(azureResponse.choices?.[0], null, 2));
    }
    
    return codexToChatResponse(azureResponse, originalRequest);
  }

  // Chat 模型的响应格式与 OpenAI 基本一致，但需要确保 model 字段使用请求中的模型名
  return {
    ...azureResponse,
    model: originalRequest.model || 'gpt-4',
  };
}

/**
 * 完整的适配函数：发送请求到 Azure 并返回 OpenAI 格式响应
 */
export async function proxyToAzure(
  request: ChatRequest,
  config: AzureConfig
): Promise<ChatResponse> {
  const response = await adaptRequestToAzure(request, config);
  return adaptResponseFromAzure(response, request, config);
}

/**
 * 流式响应代理：将流式请求转发到 Azure 并返回流式响应
 * 支持 chat 和 codex 两种模型类型
 */
export async function proxyToAzureStream(
  request: ChatRequest,
  config: AzureConfig,
  originalRequest: Request
): Promise<Response> {
  const { endpoint, apiKey, deploymentName, apiVersion, modelType } = config;
  const isCodex = modelType === 'codex';

  const baseUrl = endpoint.replace(/\/$/, '');
  let azureUrl: string;
  let azureRequestBody: any;
  let headers: Record<string, string>;

  const stripUnsupportedParams = (payload: Record<string, any>) => {
    if (payload.stream_options && typeof payload.stream_options === 'object') {
      delete payload.stream_options;
    }
    if (payload.stream_options?.include_usage !== undefined) {
      delete payload.stream_options;
    }
    if (payload.include !== undefined) {
      delete payload.include;
    }
    if (payload.reasoning !== undefined) {
      delete payload.reasoning;
    }
    if (payload.text !== undefined) {
      delete payload.text;
    }
    if (Array.isArray(payload.tools)) {
      const sanitizedTools = payload.tools.filter((tool: any) => {
        if (!tool || typeof tool !== 'object') return false;
        if (tool.type !== 'function') return false;
        return Boolean(tool.function && typeof tool.function === 'object' && tool.function.name);
      });
      if (sanitizedTools.length > 0) {
        payload.tools = sanitizedTools;
      } else {
        delete payload.tools;
      }
    }
  };

  if (isCodex) {
    // Codex 模型使用 /openai/responses 端点（Responses API）
    azureUrl = `${baseUrl}/openai/responses?api-version=${apiVersion || '2025-04-01-preview'}`;
    
    // Responses API 请求格式：使用 input 字段（而不是 messages），使用 max_output_tokens
    const { model, messages, max_tokens, stream, input: _input, ...otherParams } = request as any;
    azureRequestBody = {
      input: messagesToResponsesInput(messages), // Responses API 使用结构化 input
      model: deploymentName,
      stream: true, // 流式请求
      ...otherParams,
    };
    stripUnsupportedParams(azureRequestBody);
    
    // 转换参数名称（Responses API 使用 max_output_tokens 而不是 max_tokens）
    if (max_tokens !== undefined) {
      azureRequestBody.max_output_tokens = max_tokens;
    } else if (!azureRequestBody.max_output_tokens) {
      azureRequestBody.max_output_tokens = 16384; // 默认值
    }
    
    headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`, // Responses API 使用 Bearer token
    };
  } else {
    // Chat 模型使用 /chat/completions 端点
    azureUrl = `${baseUrl}/openai/deployments/${deploymentName}/chat/completions?api-version=${apiVersion || '2024-02-15-preview'}`;
    
    // Chat 模型使用 messages，移除 input
    const { model, input: _input, ...requestBody } = request as any;
    azureRequestBody = {
      ...requestBody,
      stream: true,
    };
    stripUnsupportedParams(azureRequestBody);
    
    headers = {
      'Content-Type': 'application/json',
      'api-key': apiKey,
    };
  }

  // 发送流式请求到 Azure OpenAI
  const azureResponse = await fetch(azureUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(azureRequestBody),
  });

  if (!azureResponse.ok) {
    const errorText = await azureResponse.text();
    console.error('11111111111 Azure OpenAI stream error body 11111111111', errorText);
    // 清理错误消息中的敏感信息
    const safeErrorText = sanitizeString(errorText);
    return new Response(
      JSON.stringify({
        error: {
          message: `Azure OpenAI API error: ${azureResponse.status} ${azureResponse.statusText}. ${safeErrorText}`,
          type: 'server_error',
          code: 'azure_api_error'
        }
      }),
      {
        status: azureResponse.status,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }

  // 如果 Azure 返回流式响应，直接转发
  if (azureResponse.body) {
    // 创建一个 ReadableStream 来转发数据
    const reader = azureResponse.body.getReader();
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          while (true) {
            const { done, value } = await reader.read();
            
            if (done) {
              controller.close();
              break;
            }

            // 解码 Azure 响应的数据块
            const chunk = decoder.decode(value, { stream: true });
            
            // 处理 Server-Sent Events 格式
            // Azure 返回的数据可能是 SSE 格式，需要确保格式正确
            const lines = chunk.split('\n');
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                
                // 如果数据是 [DONE]，直接转发
                if (data === '[DONE]') {
                  controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                } else {
                  // 解析 Azure 响应，确保格式兼容 OpenAI
                  try {
                    const jsonData = JSON.parse(data);
                    
                    if (jsonData && typeof jsonData === 'object') {
                      // 确保 model 字段使用请求中的模型名
                      jsonData.model = request.model || deploymentName;
                      
                      // 如果是 codex 模型，需要转换响应格式
                      if (isCodex && jsonData.choices && Array.isArray(jsonData.choices)) {
                        // Codex 流式响应格式：choices[].text -> choices[].delta.content
                        for (const choice of jsonData.choices) {
                          if (choice.text !== undefined && !choice.delta) {
                            choice.delta = {
                              content: choice.text,
                            };
                            delete choice.text;
                          }
                          if (!choice.message) {
                            choice.message = {
                              role: 'assistant',
                              content: '',
                            };
                          }
                        }
                        // 确保对象类型是 chat.completion.chunk
                        jsonData.object = 'chat.completion.chunk';
                      }
                    }
                    
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(jsonData)}\n\n`));
                  } catch (e) {
                    // 如果解析失败，直接转发原始数据
                    controller.enqueue(encoder.encode(`${line}\n`));
                  }
                }
              } else if (line.trim()) {
                // 转发其他行
                controller.enqueue(encoder.encode(`${line}\n`));
              }
            }
          }
        } catch (error) {
          controller.error(error);
        }
      },
    });

    // 返回流式响应（Server-Sent Events 格式）
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  // 如果没有流式响应体，返回错误
  return new Response(
    JSON.stringify({
      error: {
        message: 'Stream response not available',
        type: 'server_error',
        code: 'stream_not_available'
      }
    }),
    {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
}