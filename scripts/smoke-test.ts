/**
 * Smoke Test Script
 * 
 * Valida os endpoints da API garantindo que retornam os status corretos
 * e sempre no formato JSON. Falha imediatamente em caso de 404 ou 
 * se o Content-Type não for application/json.
 * 
 * Uso:
 * npx tsx scripts/smoke-test.ts <URL_DA_API>
 * ou
 * npm run smoke-test -- <URL_DA_API>
 * 
 * Exemplo:
 * npm run smoke-test -- http://localhost:3000
 * npm run smoke-test -- https://meu-app.vercel.app
 */

const rawBaseUrl = process.argv[2];

if (!rawBaseUrl) {
  console.error('❌ Erro: URL base não fornecida.');
  console.log('Uso: npm run smoke-test -- <URL_DA_API>');
  process.exit(1);
}

const baseUrl = rawBaseUrl.replace(/\/$/, '');
console.log(`\n💨 Iniciando Smoke Test na URL: ${baseUrl}\n`);

async function testEndpoint(name: string, path: string, method: string, expectedStatus: number) {
  console.log(`▶ Testando: ${name} (${method} ${path})`);
  
  try {
    const response = await fetch(`${baseUrl}${path}`, { method });
    const contentType = response.headers.get('content-type') || '';
    
    console.log(`  Status recebido: ${response.status} (Esperado: ${expectedStatus})`);
    console.log(`  Content-Type: ${contentType}`);

    // 1. Falhar se for 404
    if (response.status === 404) {
      console.error(`\n❌ FALHA: Endpoint não encontrado (404). O roteamento pode estar incorreto.`);
      process.exit(1);
    }

    // 2. Falhar se o status não for o esperado
    if (response.status !== expectedStatus) {
      console.error(`\n❌ FALHA: Status HTTP incorreto. Esperado ${expectedStatus}, recebido ${response.status}.`);
      process.exit(1);
    }

    // 3. Falhar se não for application/json
    if (!contentType.includes('application/json')) {
      console.error(`\n❌ FALHA: Content-Type inválido. Esperado application/json, recebido ${contentType}.`);
      process.exit(1);
    }

    console.log(`  ✅ Passou!\n`);
  } catch (error: any) {
    console.error(`\n❌ Erro de rede ao acessar ${path}:`, error.message);
    process.exit(1);
  }
}

async function run() {
  // 1) GET /api/health -> 200 JSON
  await testEndpoint('Health Check', '/api/health', 'GET', 200);
  
  // 2) GET /api/admin/data sem token -> 401 JSON
  await testEndpoint('Admin Data (Sem Token)', '/api/admin/data', 'GET', 401);
  
  // 3) POST /api/admin/toggle-premium sem token -> 401 JSON
  await testEndpoint('Admin Toggle Premium (Sem Token)', '/api/admin/toggle-premium', 'POST', 401);
  
  console.log('🎉 Smoke test concluído com sucesso! Todos os endpoints estão respondendo conforme o esperado.');
}

run();
