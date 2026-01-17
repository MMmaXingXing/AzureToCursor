import { NextRequest, NextResponse } from 'next/server';
import { getAllConfiguredModels, getAzureConfig } from '@/lib/config/model-config';

/**
 * 获取模型信息（包括类型）
 */
export async function GET(request: NextRequest) {
  try {
    const modelNames = getAllConfiguredModels();
    
    // 获取每个模型的详细信息
    const modelsInfo = modelNames.map(modelName => {
      try {
        const config = getAzureConfig(modelName);
        return {
          id: modelName,
          name: modelName,
          type: config.modelType || (modelName.toLowerCase().includes('codex') ? 'codex' : 'chat'),
        };
      } catch {
        return {
          id: modelName,
          name: modelName,
          type: 'chat' as const,
        };
      }
    });

    return NextResponse.json({ models: modelsInfo });
  } catch (error) {
    console.error('Error in /api/models/info:', error);
    return NextResponse.json(
      { error: 'Failed to get models info' },
      { status: 500 }
    );
  }
}
