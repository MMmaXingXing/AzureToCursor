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

    const extractText = (content: any): string => {
      if (typeof content === 'string') return content;
      if (Array.isArray(content)) {
        return content
          .map((item) => {
            if (typeof item === 'string') return item;
            if (item?.text) return item.text;
            if (item?.content) return item.content;
            return '';
          })
          .filter(Boolean)
          .join('\n');
      }
      if (content?.text) return content.text;
      if (content?.content) return content.content;
      return '';
    };

    const buildMessages = (candidate: any): ChatRequest['messages'] | undefined => {
      if (!candidate) return undefined;
      if (Array.isArray(candidate)) {
        if (candidate.length === 0) return undefined;
        if (candidate.every(item => item?.role !== undefined && item?.content !== undefined)) {
          return candidate.map((item) => ({
            role: item.role,
            content: extractText(item.content),
          }));
        }
        if (candidate.every(item => typeof item === 'string')) {
          return [{ role: 'user', content: candidate.join('\n') }];
        }
      }
      if (typeof candidate === 'object' && candidate?.role !== undefined) {
        return [{
          role: candidate.role,
          content: extractText(candidate.content),
        }];
      }
      if (typeof candidate === 'string' && candidate.trim()) {
        return [{ role: 'user', content: candidate }];
      }
      return undefined;
    };

    // 兼容部分客户端仅提供 input/prompt 的情况
    if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
      const candidates = [
        rawBody?.messages,
        rawBody?.input,
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
        const normalized = buildMessages(candidate);
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