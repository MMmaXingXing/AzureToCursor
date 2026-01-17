import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { existsSync } from 'fs';

const CONFIG_FILE_PATH = join(process.cwd(), 'lib/config/models.json');

// 默认配置结构
const DEFAULT_CONFIG = {
  default: {
    endpoint: '',
    apiKey: '',
    apiVersion: '2024-02-15-preview',
  },
  models: {},
};

/**
 * 获取配置
 * 注意：配置管理页面需要查看真实的配置信息，因此不进行敏感信息过滤
 */
export async function GET() {
  try {
    // 如果文件不存在，返回默认配置
    if (!existsSync(CONFIG_FILE_PATH)) {
      return NextResponse.json(DEFAULT_CONFIG);
    }

    const fileContent = await readFile(CONFIG_FILE_PATH, 'utf-8');
    const config = JSON.parse(fileContent);
    
    // 确保配置结构完整
    const mergedConfig = {
      default: {
        ...DEFAULT_CONFIG.default,
        ...(config.default || {}),
      },
      models: config.models || {},
    };
    
    return NextResponse.json(mergedConfig);
  } catch (error) {
    console.error('Error reading config:', error);
    // 读取失败时返回默认配置
    return NextResponse.json(DEFAULT_CONFIG);
  }
}

/**
 * 保存配置
 */
export async function POST(request: NextRequest) {
  try {
    const config = await request.json();
    
    // 验证配置格式
    if (!config || typeof config !== 'object') {
      return NextResponse.json(
        { error: 'Invalid config format' },
        { status: 400 }
      );
    }

    // 确保目录存在
    const configDir = dirname(CONFIG_FILE_PATH);
    if (!existsSync(configDir)) {
      await mkdir(configDir, { recursive: true });
    }

    // 规范化配置结构
    // 清理模型配置中的空字符串字段（保留 undefined 以便使用默认值）
    const normalizedModels: { [key: string]: any } = {};
    if (config.models) {
      for (const [modelName, modelConfig] of Object.entries(config.models)) {
        if (modelConfig && typeof modelConfig === 'object') {
          normalizedModels[modelName] = {
            deploymentName: (modelConfig as any).deploymentName || modelName,
            ...(Object.fromEntries(
              Object.entries(modelConfig as any).filter(([key, value]) => {
                // 保留 deploymentName，其他空字符串字段移除
                if (key === 'deploymentName') return true;
                return value !== '' && value !== null && value !== undefined;
              })
            )),
          };
        }
      }
    }

    const normalizedConfig = {
      default: {
        endpoint: config.default?.endpoint || '',
        apiKey: config.default?.apiKey || '',
        apiVersion: config.default?.apiVersion || '2024-02-15-preview',
      },
      models: normalizedModels,
    };

    // 写入文件
    await writeFile(
      CONFIG_FILE_PATH,
      JSON.stringify(normalizedConfig, null, 2),
      'utf-8'
    );
    
    console.log('Config saved to file:', CONFIG_FILE_PATH);
    console.log('Saved config:', JSON.stringify(normalizedConfig, null, 2));
    
    return NextResponse.json({ 
      success: true, 
      message: 'Config saved successfully',
      config: normalizedConfig 
    });
  } catch (error) {
    console.error('Error saving config:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save config file' },
      { status: 500 }
    );
  }
}