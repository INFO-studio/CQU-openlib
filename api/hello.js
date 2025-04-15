export default async function handler(req, res) {
  // 处理GET请求
  if (req.method === 'GET') {
    // 设置CORS头（可选）
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');
    
    // 示例响应数据
    const data = {
      message: 'Hello from Serverless!',
      timestamp: new Date().toISOString()
    };

    return res.status(200).json(data);
  }

  // 处理其他HTTP方法
  return res.status(405).json({ error: 'Method not allowed' });
}