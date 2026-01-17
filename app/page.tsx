import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">Azure to Cursor</h1>
        <p className="text-xl text-gray-600 mb-8">
          Azure OpenAI proxy service for Dify and Cursor
        </p>
        <div className="space-y-4 max-w-2xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
            <Link
              href="/chat"
              className="block p-6 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition shadow-lg"
            >
              <h2 className="text-xl font-semibold mb-2">💬 聊天测试</h2>
              <p className="text-blue-100">测试 API 聊天功能</p>
            </Link>
            <Link
              href="/config"
              className="block p-6 bg-green-500 text-white rounded-lg hover:bg-green-600 transition shadow-lg"
            >
              <h2 className="text-xl font-semibold mb-2">⚙️ 模型配置</h2>
              <p className="text-green-100">查看和管理模型配置</p>
            </Link>
          </div>
          <div className="mt-8 text-left space-y-2 bg-gray-50 p-6 rounded-lg">
            <p className="text-gray-700">
              <strong>API 端点:</strong> <code className="bg-gray-200 px-2 py-1 rounded">/api/v1/chat/completions</code>
            </p>
            <p className="text-gray-700">
              <strong>模型列表:</strong> <code className="bg-gray-200 px-2 py-1 rounded">/api/v1/models</code>
            </p>
            <p className="text-sm text-gray-500 mt-4">
              配置位置: <code className="bg-gray-200 px-2 py-1 rounded">.env.local</code> 或 <code className="bg-gray-200 px-2 py-1 rounded">lib/config/models.json</code>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}