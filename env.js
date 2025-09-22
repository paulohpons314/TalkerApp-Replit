// Configuração de ambiente - substitui placeholders com valores reais
console.log('🔧 Carregando configuração de ambiente...');

window.ENV = window.ENV || {};

// Injetar API key real se disponível (gerado via server-side)
(async () => {
    try {
        console.log('🔧 Iniciando busca de API key...');
        
        // Método 1: Verificar se já temos chave válida
        if (window.ENV.OPENAI_API_KEY && window.ENV.OPENAI_API_KEY !== '${OPENAI_API_KEY}') {
            console.log('🔑 API Key já carregada:', window.ENV.OPENAI_API_KEY.substring(0, 8) + '...');
            return;
        }
        
        // Método 2: Buscar via endpoint interno
        console.log('🔧 Tentando buscar via /env.txt...');
        try {
            const response = await fetch('/env.txt');
            console.log('🔧 Response status:', response.status);
            if (response.ok) {
                const key = await response.text();
                console.log('🔧 Key recebida:', key ? key.substring(0, 8) + '...' : 'null');
                if (key && key.trim().startsWith('sk-')) {
                    window.ENV.OPENAI_API_KEY = key.trim();
                    console.log('✅ API Key carregada via env.txt:', key.substring(0, 8) + '...');
                    return;
                }
            }
        } catch (e) {
            console.error('❌ Erro ao buscar env.txt:', e);
        }
        
        // Método 3: Mock para desenvolvimento se nenhuma chave disponível
        console.log('⚠️ API key não encontrada - usando modo DEMO');
        window.ENV.OPENAI_API_KEY = null;
        
    } catch (error) {
        console.error('❌ Erro ao carregar configuração:', error);
        window.ENV.OPENAI_API_KEY = null;
    }
})();

console.log('🔧 env.js carregado');