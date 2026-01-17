import { NextRequest, NextResponse } from 'next/server';
import { ChatRequest, ChatResponse } from '@/types/model';
import { getAzureConfig, validateConfig } from '@/lib/config/model-config';
import { proxyToAzure, proxyToAzureStream } from '@/lib/adapters/azure-adapter';
import { sanitizeError, sanitizeLogMessage } from '@/lib/utils/sanitize';

export async function POST(request: NextRequest) {
  try {
    // 解析请求体
    const rawBody = await request.json();
    const body = { ...rawBody } as ChatRequest;
    console.log(...sanitizeLogMessage('Incoming /v1/chat/completions body:', rawBody));

    const extractText = (content: any): string => {
      const normalizeContentItem = (item: any): string => {
        if (typeof item === 'string') return item;
        if (!item || typeof item !== 'object') return '';
        if (typeof item.text === 'string') return item.text;
        if (typeof item.content === 'string') return item.content;
        if (typeof item.input_text === 'string') return item.input_text;
        if (typeof item.value === 'string') return item.value;
        if (item?.text && typeof item.text?.value === 'string') return item.text.value;
        if (item?.content && typeof item.content?.value === 'string') return item.content.value;
        return '';
      };

      if (typeof content === 'string') return content;
      if (Array.isArray(content)) {
        return content
          .map((item) => normalizeContentItem(item))
          .filter(Boolean)
          .join('\n');
      }
      if (content && typeof content === 'object') {
        if (typeof content.text === 'string') return content.text;
        if (typeof content.content === 'string') return content.content;
        if (Array.isArray(content.content)) {
          return content.content
            .map((item: any) => normalizeContentItem(item))
            .filter(Boolean)
            .join('\n');
        }
        if (typeof content.input_text === 'string') return content.input_text;
        if (typeof content.value === 'string') return content.value;
        if (content?.text && typeof content.text?.value === 'string') return content.text.value;
        if (content?.content && typeof content.content?.value === 'string') return content.content.value;
      }
      return '';
    };

    const buildMessages = (candidate: any): ChatRequest['messages'] | undefined => {
      if (!candidate) return undefined;

      // 显式处理 Cursor 风格的 input 数组
      if (Array.isArray(candidate)) {
        const toMessage = (item: any) => {
          const role = item?.role ?? item?.message?.role;
          const contentSource = item?.content ?? item?.text ?? item?.message?.content ?? item?.input ?? item?.parts;
          const content = extractText(contentSource);
          if (!role || !content) return undefined;
          return { role, content };
        };

        const normalizedMessages = candidate
          .map((item) => toMessage(item))
          .filter(Boolean) as ChatRequest['messages'];

        if (normalizedMessages.length > 0) {
          console.log(
            ...sanitizeLogMessage('[DEBUG] Build messages from input array:', {
              length: candidate.length,
              validCount: normalizedMessages.length,
              roles: normalizedMessages.map(item => item.role).slice(0, 5),
            })
          );
          return normalizedMessages;
        }
        if (candidate.every(item => typeof item === 'string')) {
          return [{ role: 'user', content: candidate.join('\n') }];
        }
        return undefined;
      }

      if (typeof candidate === 'object') {
        if (Array.isArray(candidate.messages)) {
          return buildMessages(candidate.messages);
        }
        if (Array.isArray(candidate.input)) {
          return buildMessages(candidate.input);
        }
        if (candidate?.role !== undefined) {
        return [{
          role: candidate.role,
            content: extractText(candidate.content ?? candidate.text ?? candidate.input ?? candidate.parts),
        }];
        }
      }
      if (typeof candidate === 'string' && candidate.trim()) {
        return [{ role: 'user', content: candidate }];
      }
      return undefined;
    };

    // 兼容部分客户端仅提供 input/prompt 的情况
    if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
      const candidates = [
        rawBody?.input,
        rawBody?.messages,
        rawBody?.prompt,
        rawBody?.text,
        rawBody?.data?.messages,
        rawBody?.data?.input,
        rawBody?.payload?.messages,
        rawBody?.payload?.input,
        rawBody?.request?.messages,
        rawBody?.request?.input,
        rawBody?.inputs?.messages,
        rawBody?.inputs?.input,
        rawBody?.params?.messages,
      ];

      for (const candidate of candidates) {
        console.log(
          ...sanitizeLogMessage('[DEBUG] Candidate summary:', {
            type: Array.isArray(candidate) ? 'array' : typeof candidate,
            isNull: candidate === null,
            isUndefined: candidate === undefined,
            length: Array.isArray(candidate) ? candidate.length : undefined,
            keys: candidate && typeof candidate === 'object' && !Array.isArray(candidate)
              ? Object.keys(candidate).slice(0, 10)
              : undefined,
          })
        );
        const normalized = buildMessages(candidate);
        console.log(
          ...sanitizeLogMessage('[DEBUG] Normalized messages summary:', {
            count: normalized?.length ?? 0,
            roles: normalized?.map(item => item.role).slice(0, 5) ?? [],
            hasContent: normalized?.map(item => Boolean(item.content)).slice(0, 5) ?? [],
          })
        );
        if (normalized && normalized.length > 0) {
          body.messages = normalized;
          break;
        }
      }
    }

    // 验证请求格式
    if (!body.messages || !Array.isArray(body.messages)) {
      return NextResponse.json(
        { 
          error: {
            message: 'Invalid request: messages array is required',
            type: 'invalid_request_error',
            param: 'messages',
            code: 'missing_messages'
          }
        },
        { status: 400 }
      );
    }

    if (!body.model) {
      return NextResponse.json(
        { 
          error: {
            message: 'Invalid request: model is required',
            type: 'invalid_request_error',
            param: 'model',
            code: 'missing_model'
          }
        },
        { status: 400 }
      );
    }

    // 获取 Azure 配置（根据请求中的模型名）
    const azureConfig = getAzureConfig(body.model);
    validateConfig(azureConfig);

    // 如果请求流式响应
    if (body.stream) {
      return await proxyToAzureStream(body, azureConfig, request);
    }

    // 代理请求到 Azure OpenAI（非流式）
    const response: ChatResponse = await proxyToAzure(body, azureConfig);

    // 返回 OpenAI 格式的响应
    return NextResponse.json(response, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  } catch (error) {
    // 清理敏感信息后记录日志
    const sanitizedError = sanitizeError(error);
    console.error('Error in /v1/chat/completions:', ...sanitizeLogMessage(sanitizedError));

    if (error instanceof Error) {
      // 清理错误消息中的敏感信息
      const safeMessage = sanitizeError(error);

      // 如果是配置错误，返回 500
      if (safeMessage.includes('configuration') || safeMessage.includes('required')) {
        return NextResponse.json(
          { 
            error: {
              message: safeMessage,
              type: 'server_error',
              code: 'configuration_error'
            }
          },
          { status: 500 }
        );
      }

      // 如果是 Azure API 错误，返回原始状态码（如果可能）
      if (safeMessage.includes('Azure OpenAI API error')) {
        // 尝试从错误消息中提取状态码
        const statusMatch = safeMessage.match(/(\d{3})/);
        const status = statusMatch ? parseInt(statusMatch[1]) : 500;
        return NextResponse.json(
          { 
            error: {
              message: safeMessage,
              type: 'server_error',
              code: 'azure_api_error'
            }
          },
          { status }
        );
      }
    }

    return NextResponse.json(
      { 
        error: {
          message: 'Internal server error',
          type: 'server_error',
          code: 'internal_error'
        }
      },
      { status: 500 }
    );
  }
}

// 处理 OPTIONS 请求（CORS）
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}