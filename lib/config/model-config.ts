import { AzureConfig, ModelConfig } from '@/types/model';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * 从环境变量加载单个模型配置（向后兼容）
 */
function loadConfigFromEnv(): AzureConfig | null {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME;
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION;

  if (!endpoint || !apiKey || !deploymentName) {
    return null;
  }

  return {
    endpoint: endpoint.trim(),
    apiKey: apiKey.trim(),
    deploymentName: deploymentName.trim(),
    apiVersion: (apiVersion || '2024-02-15-preview').trim(),
  };
}

/**
 * 从环境变量加载多模型配置
 * 支持格式：AZURE_MODEL_{MODEL_NAME}_DEPLOYMENT_NAME
 * 例如：AZURE_MODEL_gpt4_DEPLOYMENT_NAME=gpt-4-deployment
 */
function loadMultiModelConfigFromEnv(): ModelConfig | null {
  const defaultEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const defaultApiKey = process.env.AZURE_OPENAI_API_KEY;
  const defaultApiVersion = process.env.AZURE_OPENAI_API_VERSION || '2024-02-15-preview';

  if (!defaultEndpoint || !defaultApiKey) {
    return null;
  }

  // 查找所有模型特定的环境变量
  const modelConfigs: { [key: string]: any } = {};
  const modelNames = new Set<string>();

  // 扫描环境变量，查找所有 AZURE_MODEL_*_* 格式的变量
  for (const key in process.env) {
    const match = key.match(/^AZURE_MODEL_(.+?)_(DEPLOYMENT_NAME|ENDPOINT|API_KEY|API_VERSION)$/i);
    if (match) {
      const envModelName = match[1].toLowerCase();
      const fieldType = match[2].toUpperCase();
      const value = process.env[key];
      
      if (value) {
        const standardModelName = envModelName.replace(/_/g, '-');
        modelNames.add(standardModelName);
        
        if (!modelConfigs[standardModelName]) {
          modelConfigs[standardModelName] = {};
        }
        
        // 根据字段类型存储配置
        switch (fieldType) {
          case 'DEPLOYMENT_NAME':
            modelConfigs[standardModelName].deploymentName = value.trim();
            break;
          case 'ENDPOINT':
            modelConfigs[standardModelName].endpoint = value.trim();
            break;
          case 'API_KEY':
            modelConfigs[standardModelName].apiKey = value.trim();
            break;
          case 'API_VERSION':
            modelConfigs[standardModelName].apiVersion = value.trim();
            break;
        }
      }
    }
  }

  // 如果没有找到任何模型配置，但找到了默认配置，返回 null（使用旧的单模型逻辑）
  if (Object.keys(modelConfigs).length === 0) {
    return null;
  }

  return {
    default: {
      endpoint: defaultEndpoint.trim(),
      apiKey: defaultApiKey.trim(),
      apiVersion: defaultApiVersion.trim(),
    },
    models: modelConfigs,
  };
}

/**
 * 从配置文件加载模型配置
 * 动态读取文件，支持运行时修改
 */
function loadConfigFromFile(): ModelConfig {
  const configFilePath = join(process.cwd(), 'lib/config/models.json');
  
  try {
    // 如果文件不存在，返回空配置
    if (!existsSync(configFilePath)) {
      return {
        default: undefined,
        models: {},
      };
    }

    // 每次都从文件系统读取，确保获取最新配置
    const fileContent = readFileSync(configFilePath, 'utf-8');
    const config = JSON.parse(fileContent) as ModelConfig;
    
    return config;
  } catch (error) {
    console.error('Error loading config file:', error);
    // 读取失败时返回空配置
    return {
      default: undefined,
      models: {},
    };
  }
}

/**
 * 获取指定模型的 Azure 配置
 * 优先级：环境变量（多模型） > 环境变量（单模型） > 配置文件
 * 
 * @param modelName 模型名称（例如 "gpt-4"）
 * @returns Azure 配置
 */
export function getAzureConfig(modelName?: string): AzureConfig {
  // 1. 尝试从环境变量加载多模型配置
  const multiModelEnvConfig = loadMultiModelConfigFromEnv();
  if (multiModelEnvConfig && modelName && multiModelEnvConfig.models?.[modelName]) {
    const modelConfig = multiModelEnvConfig.models[modelName];
    const defaultConfig = multiModelEnvConfig.default;
    
    if (defaultConfig && modelConfig.deploymentName) {
      // 确定模型类型：优先使用配置中的 modelType，如果没有配置则根据模型名自动判断
      let modelType: 'chat' | 'codex' = 'chat';
      if (modelConfig.modelType === 'codex') {
        modelType = 'codex';
      } else if (modelConfig.modelType === 'chat') {
        modelType = 'chat';
      } else if (modelName.toLowerCase().includes('codex')) {
        // 如果模型名包含 'codex' 且未明确配置类型，默认尝试 codex
        // 但实际使用中如果报错，需要手动改为 chat
        modelType = 'codex';
      }
      
      return {
        endpoint: modelConfig.endpoint || defaultConfig.endpoint,
        apiKey: modelConfig.apiKey || defaultConfig.apiKey,
        deploymentName: modelConfig.deploymentName,
        apiVersion: modelConfig.apiVersion || defaultConfig.apiVersion || '2024-02-15-preview',
        modelType,
      };
    }
  }

  // 2. 尝试从环境变量加载单模型配置（向后兼容）
  const envConfig = loadConfigFromEnv();
  if (envConfig) {
    return envConfig;
  }

  // 3. 从配置文件加载
  const fileConfig = loadConfigFromFile();

  // 如果指定了模型名，尝试从配置文件的 models 中获取
  if (modelName && fileConfig.models?.[modelName]) {
    const modelConfig = fileConfig.models[modelName];
    const defaultConfig = fileConfig.default;
    
    if (defaultConfig && modelConfig.deploymentName) {
      // 确定模型类型：优先使用配置中的 modelType，如果没有配置则根据模型名自动判断
      let modelType: 'chat' | 'codex' = 'chat';
      if (modelConfig.modelType === 'codex') {
        modelType = 'codex';
      } else if (modelConfig.modelType === 'chat') {
        modelType = 'chat';
      } else if (modelName.toLowerCase().includes('codex')) {
        // 如果模型名包含 'codex' 且未明确配置类型，默认尝试 codex
        // 但实际使用中如果报错，需要手动改为 chat
        modelType = 'codex';
      }
      
      return {
        endpoint: modelConfig.endpoint || defaultConfig.endpoint,
        apiKey: modelConfig.apiKey || defaultConfig.apiKey,
        deploymentName: modelConfig.deploymentName,
        apiVersion: modelConfig.apiVersion || defaultConfig.apiVersion || '2024-02-15-preview',
        modelType,
      };
    }
  }

  // 向后兼容：尝试使用旧的 azure 配置
  if (fileConfig.azure) {
    return fileConfig.azure;
  }

  throw new Error(
    `Azure OpenAI configuration not found${modelName ? ` for model "${modelName}"` : ''}. ` +
    'Please set environment variables or configure lib/config/models.json'
  );
}

/**
 * 获取所有配置的模型列表
 */
export function getAllConfiguredModels(): string[] {
  const models: string[] = [];

  // 从环境变量获取
  const multiModelEnvConfig = loadMultiModelConfigFromEnv();
  if (multiModelEnvConfig && multiModelEnvConfig.models) {
    models.push(...Object.keys(multiModelEnvConfig.models));
  }

  // 从配置文件获取
  const fileConfig = loadConfigFromFile();
  if (fileConfig.models) {
    const fileModels = Object.keys(fileConfig.models);
    // 合并，去重
    fileModels.forEach(model => {
      if (!models.includes(model)) {
        models.push(model);
      }
    });
  }

  // 如果都没有，但有默认配置，返回空数组（兼容旧配置）
  if (models.length === 0) {
    const envConfig = loadConfigFromEnv();
    if (envConfig) {
      models.push(envConfig.deploymentName);
    } else if (fileConfig.azure) {
      models.push(fileConfig.azure.deploymentName);
    }
  }

  return models;
}

/**
 * 验证配置是否有效
 */
export function validateConfig(config: AzureConfig): void {
  if (!config.endpoint) {
    throw new Error('Azure OpenAI endpoint is required');
  }
  if (!config.apiKey) {
    throw new Error('Azure OpenAI API key is required');
  }
  if (!config.deploymentName) {
    throw new Error('Azure OpenAI deployment name is required');
  }

  // 验证 endpoint 格式
  try {
    new URL(config.endpoint);
  } catch {
    throw new Error('Azure OpenAI endpoint must be a valid URL');
  }
}