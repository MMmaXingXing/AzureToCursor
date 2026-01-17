import { NextRequest, NextResponse } from 'next/server';
import { ChatRequest, ChatResponse } from '@/types/model';
import { getAzureConfig, validateConfig } from '@/lib/config/model-config';
import { proxyToAzure } from '@/lib/adapters/azure-adapter';

export async function POST(request: NextRequest) {
  try {
    // 解析请求体
    const body = await request.json() as ChatRequest;

    // 验证请求格式
    if (!body.messages || !Array.isArray(body.messages)) {
      return NextResponse.json(
        { error: 'Invalid request: messages array is required' },
        { status: 400 }
      );
    }

    if (!body.model) {
      return NextResponse.json(
        { error: 'Invalid request: model is required' },
        { status: 400 }
      );
    }

    // 获取 Azure 配置
    const azureConfig = getAzureConfig();
    validateConfig(azureConfig);

    // 代理请求到 Azure OpenAI
    const response: ChatResponse = await proxyToAzure(body, azureConfig);

    // 返回 OpenAI 格式的响应
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in /api/chat:', error);

    if (error instanceof Error) {
      // 如果是配置错误，返回 500
      if (error.message.includes('configuration') || error.message.includes('required')) {
        return NextResponse.json(
          { error: error.message },
          { status: 500 }
        );
      }

      // 如果是 Azure API 错误，返回原始状态码（如果可能）
      if (error.message.includes('Azure OpenAI API error')) {
        // 尝试从错误消息中提取状态码
        const statusMatch = error.message.match(/(\d{3})/);
        const status = statusMatch ? parseInt(statusMatch[1]) : 500;
        return NextResponse.json(
          { error: error.message },
          { status }
        );
      }
    }

    return NextResponse.json(
      { error: 'Internal server error' },
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