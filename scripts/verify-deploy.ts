/**
 * Script de verificação pós-deploy.
 * 
 * Este script testa os endpoints da API para garantir que eles estão retornando JSON
 * e não páginas HTML (o que indicaria um erro de roteamento ou fallback do SPA).
 * 
 * Uso:
 * npx tsx scripts/verify-deploy.ts <URL_DA_API>
 * 
 * Exemplo:
 * npx tsx scripts/verify-deploy.ts https://meu-app.vercel.app
 * npx tsx scripts/verify-deploy.ts http://localhost:3000
 */

const rawBaseUrl = process.argv[2];

if (!rawBaseUrl) {
  console.error('❌ Erro: URL base não fornecida.');
  console.log('Uso: npx tsx scripts/verify-deploy.ts <URL_DA_API>');
  process.exit(1);
}

// Remove trailing slash if present
const baseUrl = rawBaseUrl.replace(/\/$/, '');

console.log(`\n🔍 Iniciando verificação pós-deploy na URL: ${baseUrl}\n`);

async function checkEndpoint(name: string, path: string, method: string = 'GET') {
  console.log(`▶ Teste: ${name}`);
  console.log(`  Requisitando: ${method} ${path}`);
  
  try {
    const response = await fetch(`${baseUrl}${path}`, { method });
    const contentType = response.headers.get('content-type') || '';
    
    console.log(`  Status: ${response.status}`);
    console.log(`  Content-Type: ${contentType}`);

    if (contentType.includes('text/html')) {
      console.error(`\n❌ FALHA CRÍTICA: O endpoint retornou HTML em vez de JSON.`);
      console.error(`  Isso geralmente indica que a rota da API não foi encontrada e o servidor retornou o index.html (fallback do SPA).`);
      process.exit(1);
    }

    if (!contentType.includes('application/json')) {
      console.warn(`  ⚠️ Aviso: O Content-Type não é application/json (recebido: ${contentType})`);
    } else {
      console.log(`  ✅ Sucesso: Resposta é JSON.`);
    }
    
    const data = await response.text();
    const snippet = data.substring(0, 100).replace(/\n/g, '');
    console.log(`  Corpo (trecho): ${snippet}...\n`);
    
  } catch (error: any) {
    console.error(`\n❌ Erro de rede ao acessar ${path}:`, error.message);
    process.exit(1);
  }
}

async function run() {
  // 1) GET /api/health
  await checkEndpoint('Health Check', '/api/health', 'GET');
  
  // 2) GET /api/admin/data sem token (esperado: JSON com 401/500 dependendo da auth, mas NÃO html)
  await checkEndpoint('Admin Data (Sem Token)', '/api/admin/data', 'GET');
  
  // 3) POST /api/admin/toggle-premium sem token
  await checkEndpoint('Admin Toggle Premium (Sem Token)', '/api/admin/toggle-premium', 'POST');
  
  console.log('🎉 Verificação concluída com sucesso! Nenhuma rota da API retornou HTML.');
}

run();
