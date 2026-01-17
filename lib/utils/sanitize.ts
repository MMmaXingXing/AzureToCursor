/**
 * 敏感信息过滤工具
 * 用于在日志、错误消息中隐藏敏感信息
 */

/**
 * 需要过滤的敏感字段名称（不区分大小写）
 */
const SENSITIVE_FIELDS = [
  'apiKey',
  'api-key',
  'apikey',
  'api_key',
  'authorization',
  'authorization-bearer',
  'token',
  'access_token',
  'access-token',
  'secret',
  'password',
  'passwd',
  'pwd',
];

/**
 * 敏感信息替换标记
 */
const REDACTED_MARKER = '[REDACTED]';

/**
 * 检查字符串是否包含敏感字段名
 */
function isSensitiveField(fieldName: string): boolean {
  const lowerFieldName = fieldName.toLowerCase();
  return SENSITIVE_FIELDS.some(sensitive => lowerFieldName.includes(sensitive));
}

/**
 * 屏蔽敏感字符串（保留前 4 个字符和后 4 个字符，中间用 * 替换）
 */
function maskSensitiveValue(value: string): string {
  if (!value || value.length <= 8) {
    return REDACTED_MARKER;
  }
  
  const start = value.substring(0, 4);
  const end = value.substring(value.length - 4);
  const middle = '*'.repeat(Math.max(0, value.length - 8));
  
  return `${start}${middle}${end}`;
}

/**
 * 完全隐藏敏感字符串
 */
function hideSensitiveValue(value: string): string {
  return REDACTED_MARKER;
}

/**
 * 清理对象中的敏感信息
 * @param obj 要清理的对象
 * @param options 选项
 * @returns 清理后的对象
 */
export function sanitizeObject<T extends Record<string, any>>(
  obj: T,
  options: {
    mask?: boolean; // 是否屏蔽（保留部分字符），默认 false（完全隐藏）
    fields?: string[]; // 额外的敏感字段列表
  } = {}
): T {
  const { mask = false, fields = [] } = options;
  const allSensitiveFields = [...SENSITIVE_FIELDS, ...fields.map(f => f.toLowerCase())];
  
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  const sanitized: any = Array.isArray(obj) ? [...obj] : { ...obj };

  for (const key in sanitized) {
    if (Object.prototype.hasOwnProperty.call(sanitized, key)) {
      const lowerKey = key.toLowerCase();
      const isSensitive = allSensitiveFields.some(field => lowerKey.includes(field));

      const value = sanitized[key];
      if (isSensitive && typeof value === 'string') {
        sanitized[key] = mask ? maskSensitiveValue(value) : hideSensitiveValue(value);
      } else if (isSensitive && value != null) {
        sanitized[key] = REDACTED_MARKER;
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = sanitizeObject(value, options);
      }
    }
  }

  return sanitized as T;
}

/**
 * 清理字符串中的敏感信息
 * @param str 要清理的字符串
 * @param mask 是否屏蔽（保留部分字符），默认 false（完全隐藏）
 * @returns 清理后的字符串
 */
export function sanitizeString(str: string, mask: boolean = false): string {
  if (!str || typeof str !== 'string') {
    return str;
  }

  let sanitized = str;

  // 替换常见的敏感信息格式
  // API Key 格式：sk-... 或类似格式
  sanitized = sanitized.replace(/(['"]?api[-_]?key['"]?\s*[:=]\s*['"]?)([^'",}\s]+)/gi, (match, prefix, value) => {
    return prefix + (mask ? maskSensitiveValue(value) : hideSensitiveValue(value));
  });

  // Authorization 头格式：Bearer ... 或 api-key: ...
  sanitized = sanitized.replace(/(authorization|api[-_]?key)\s*[:=]\s*['"]?([^'",}\s]+)/gi, (match, header, value) => {
    return `${header}: ${mask ? maskSensitiveValue(value) : hideSensitiveValue(value)}`;
  });

  // Token 格式
  sanitized = sanitized.replace(/(['"]?token['"]?\s*[:=]\s*['"]?)([^'",}\s]+)/gi, (match, prefix, value) => {
    return prefix + (mask ? maskSensitiveValue(value) : hideSensitiveValue(value));
  });

  // 通用密钥格式（sk-...、ek-... 等）
  sanitized = sanitized.replace(/\b([a-z]{2}-[a-zA-Z0-9]{20,})\b/gi, (match) => {
    if (match.length > 20) { // 可能是密钥
      return mask ? maskSensitiveValue(match) : hideSensitiveValue(match);
    }
    return match;
  });

  return sanitized;
}

/**
 * 清理错误消息中的敏感信息
 */
export function sanitizeError(error: unknown): string {
  if (!error) {
    return 'Unknown error';
  }

  if (error instanceof Error) {
    return sanitizeString(error.message);
  }

  if (typeof error === 'string') {
    return sanitizeString(error);
  }

  if (typeof error === 'object') {
    try {
      const errorStr = JSON.stringify(error);
      return sanitizeString(errorStr);
    } catch {
      return REDACTED_MARKER;
    }
  }

  return String(error);
}

/**
 * 清理日志消息
 */
export function sanitizeLogMessage(message: string, ...args: any[]): [string, ...any[]] {
  const sanitizedMessage = sanitizeString(message);
  const sanitizedArgs = args.map(arg => {
    if (typeof arg === 'string') {
      return sanitizeString(arg);
    }
    if (typeof arg === 'object' && arg !== null) {
      return sanitizeObject(arg);
    }
    return arg;
  });

  return [sanitizedMessage, ...sanitizedArgs];
}