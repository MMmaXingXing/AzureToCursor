import { NextRequest, NextResponse } from 'next/server';
import { getAllConfiguredModels } from '@/lib/config/model-config';
import { sanitizeError, sanitizeLogMessage } from '@/lib/utils/sanitize';

/**
 * 获取模型列表
 * 返回 OpenAI 格式的模型列表
 */
export async function GET(request: NextRequest) {
  try {
    // 获取所有配置的模型
    const modelNames = getAllConfiguredModels();

    // 返回模型列表（OpenAI 格式）
    const modelsResponse = {
      object: 'list',
      data: modelNames.map(modelName => ({
        id: modelName,
        object: 'model',
        created: Math.floor(Date.now() / 1000),
        owned_by: 'azure-openai',
      })),
    };

    return NextResponse.json(modelsResponse, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  } catch (error) {
    // 清理敏感信息后记录日志
    const sanitizedError = sanitizeError(error);
    console.error('Error in /v1/models:', ...sanitizeLogMessage(sanitizedError));

    if (error instanceof Error) {
      const safeMessage = sanitizeError(error);
      return NextResponse.json(
        { 
          error: {
            message: safeMessage || 'Failed to get models',
            type: 'server_error',
            code: 'configuration_error'
          }
        },
        { status: 500 }
      );
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
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}