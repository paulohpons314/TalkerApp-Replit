const talkerApp = document.getElementById('talkerApp');
const commandTower = document.getElementById('commandTower');
const contentWindow = document.getElementById('contentWindow');
const startRecordingBtn = document.getElementById('startRecordingBtn');
const assistantBtn = document.getElementById('assistantBtn');
const recordingTimer = document.getElementById('recordingTimer');
const recordingBorder = document.getElementById('recordingBorder');
const towerVolumeGlow = document.getElementById('towerVolumeGlow');
const newTransformationBtn = document.getElementById('newTransformationBtn');
const tabsNav = document.getElementById('tabs-nav');
const tabsContent = document.getElementById('tabs-content');
const promptStatus = document.getElementById('promptStatus');
const statusText = document.getElementById('statusText');

// Elementos para controles de áudio
const audioControls = document.getElementById('audioControls');
const playPauseBtn = document.getElementById('playPauseBtn');
const playIcon = document.getElementById('playIcon');
const pauseIcon = document.getElementById('pauseIcon');
const progressBar = document.getElementById('progressBar');
const currentTime = document.getElementById('currentTime');
const totalTime = document.getElementById('totalTime');
const downloadBtn = document.getElementById('downloadBtn');
const saveBtn = document.getElementById('saveBtn');

// Elementos para visualização de forma de onda
const waveformCanvas = document.getElementById('waveformCanvas');
const waveformProgress = document.getElementById('waveformProgress');
const waveformCtx = waveformCanvas.getContext('2d');

// Elementos para persistência (interface)
const historyBtn = document.getElementById('historyBtn');
const recordingsPane = document.getElementById('recordingsPane');
const recordingsList = document.getElementById('recordingsList');
const recordingsEmptyState = document.getElementById('recordingsEmptyState');
const recordingsCount = document.getElementById('recordingsCount');
const recordingsSize = document.getElementById('recordingsSize');

// Elementos para sistema de pastas
const folderSelector = document.getElementById('folderSelector');
const createFolderBtn = document.getElementById('createFolderBtn');
const manageFoldersBtn = document.getElementById('manageFoldersBtn');

let isMainRecording = false;
let isPromptRecording = false;

// Variáveis globais para controle de gravação de áudio
let mediaStream;
let mediaRecorder;

// FASE 2: Variáveis para captura e armazenamento de dados de áudio
let audioChunks = [];
let recordedAudioBlob = null;

// Variáveis para reprodução de áudio
let audioElement = null;
let isAudioPlaying = false;
let audioUpdateInterval = null;

// Variáveis para visualização de forma de onda
let waveformAudioContext = null;
let waveformData = null;
let canvasWidth = 400;
let canvasHeight = 48;

// Variáveis para persistência local
let dbConnection = null;
const DB_NAME = 'TalkerAppDB';
const DB_VERSION = 2; // Incrementado para adicionar pastas
const STORE_NAME = 'recordings';
const FOLDERS_STORE = 'folders';

// Variáveis para sistema de pastas
let currentFolder = 'all'; // 'all', 'uncategorized', ou ID da pasta
let availableFolders = [];

// Variáveis para timer de gravação
let recordingStartTime;
let recordingInterval;

// Variáveis para análise de volume e animação
let volumeAudioContext;
let analyser;
let dataArray;
let animationFrame;

// FASE 2: Funções para captura e armazenamento de áudio

// Função para configurar event listeners do MediaRecorder
function setupMediaRecorderEvents(recorder) {
    // Capturar dados durante a gravação
    recorder.ondataavailable = function(event) {
        if (event.data.size > 0) {
            audioChunks.push(event.data);
            console.log('Chunk de áudio capturado:', event.data.size, 'bytes');
        }
    };
    
    // Quando a gravação parar, criar o blob final
    recorder.onstop = function() {
        if (audioChunks.length > 0) {
            recordedAudioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            console.log('Gravação finalizada. Blob criado:', recordedAudioBlob.size, 'bytes');
            
            // Criar URL temporária para o áudio gravado
            const audioURL = URL.createObjectURL(recordedAudioBlob);
            console.log('URL do áudio:', audioURL);
            
            // Aqui poderíamos adicionar o áudio à interface (ex: botão de reprodução)
            handleRecordingComplete(audioURL, recordedAudioBlob);
        }
    };
    
    recorder.onerror = function(event) {
        console.error('Erro no MediaRecorder:', event.error);
    };
}

// Função chamada quando a gravação é finalizada
async function handleRecordingComplete(audioURL, audioBlob) {
    console.log('=== GRAVAÇÃO COMPLETA ===');
    console.log('Tamanho do arquivo:', audioBlob.size, 'bytes');
    console.log('Tipo MIME:', audioBlob.type);
    console.log('URL para reprodução:', audioURL);
    
    // Criar elemento de áudio e mostrar controles
    createAudioElement(audioURL, audioBlob);
    showAudioControls();
    
    // Não salvar automaticamente aqui - será feito quando os metadados carregarem
}

// Função para criar elemento de áudio
function createAudioElement(audioURL, audioBlob) {
    // Limpar áudio anterior se existir e revogar URL anterior
    if (audioElement) {
        audioElement.pause();
        if (audioElement.src) {
            URL.revokeObjectURL(audioElement.src);
        }
        audioElement.src = '';
    }
    
    // Criar novo elemento de áudio
    audioElement = new Audio(audioURL);
    audioElement.preload = 'metadata';
    
    // Event listeners para o áudio
    audioElement.addEventListener('loadedmetadata', () => {
        const duration = formatAudioTime(audioElement.duration);
        totalTime.textContent = duration;
        console.log('Duração do áudio:', duration);
        
        // Gerar visualização de forma de onda quando os metadados estão carregados
        generateWaveform(audioBlob);
    });
    
    audioElement.addEventListener('timeupdate', updateAudioProgress);
    audioElement.addEventListener('ended', handleAudioEnded);
    audioElement.addEventListener('error', handleAudioError);
    
    // Armazenar referência do blob e URL para download
    audioElement._audioBlob = audioBlob;
    audioElement._audioURL = audioURL;
    
    // Salvar automaticamente quando metadados estiverem carregados
    audioElement.addEventListener('loadedmetadata', async () => {
        try {
            const duration = audioElement.duration || 0;
            const recordingId = await saveRecording(audioBlob, duration);
            console.log('Gravação salva automaticamente com ID:', recordingId);
            
            // Marcar elemento como já salvo para evitar duplicação
            audioElement._savedRecordingId = recordingId;
            
            // Atualizar lista de gravações se estiver visível
            updateRecordingsList();
        } catch (error) {
            console.error('Erro ao salvar gravação automaticamente:', error);
            // Não bloquear o fluxo normal se houver erro na persistência
        }
    });
}

// Função para mostrar controles de áudio
function showAudioControls() {
    audioControls.classList.remove('hidden');
    // Ajustar posição do conteúdo das tabs
    tabsContent.style.top = audioControls.offsetHeight + 'px';
}

// Função para esconder controles de áudio
function hideAudioControls() {
    audioControls.classList.add('hidden');
    tabsContent.style.top = '0';
    
    // Parar reprodução se estiver tocando
    if (audioElement && isAudioPlaying) {
        stopAudioPlayback();
    }
    
    // Resetar progresso e tempo
    progressBar.style.width = '0%';
    waveformProgress.style.width = '0%';
    currentTime.textContent = '00:00';
    totalTime.textContent = '00:00';
    
    // Limpar forma de onda
    if (waveformCtx) {
        waveformCtx.clearRect(0, 0, canvasWidth, canvasHeight);
    }
    waveformData = null;
    
    // Fechar contexto de áudio da forma de onda
    if (waveformAudioContext) {
        waveformAudioContext.close();
        waveformAudioContext = null;
    }
    
    // Revogar URL se existir
    if (audioElement && audioElement._audioURL) {
        URL.revokeObjectURL(audioElement._audioURL);
    }
}

// Função para alternar play/pause
function toggleAudioPlayback() {
    if (!audioElement) return;
    
    if (isAudioPlaying) {
        stopAudioPlayback();
    } else {
        startAudioPlayback();
    }
}

// Função para iniciar reprodução
function startAudioPlayback() {
    if (!audioElement) return;
    
    audioElement.play()
        .then(() => {
            isAudioPlaying = true;
            playIcon.classList.add('hidden');
            pauseIcon.classList.remove('hidden');
            console.log('Reprodução iniciada');
        })
        .catch(error => {
            console.error('Erro ao reproduzir áudio:', error);
            handleAudioError(error);
        });
}

// Função para parar reprodução
function stopAudioPlayback() {
    if (!audioElement) return;
    
    audioElement.pause();
    isAudioPlaying = false;
    playIcon.classList.remove('hidden');
    pauseIcon.classList.add('hidden');
    console.log('Reprodução pausada');
}

// Função para atualizar progresso do áudio
function updateAudioProgress() {
    if (!audioElement || isNaN(audioElement.duration)) return;
    
    const progress = (audioElement.currentTime / audioElement.duration) * 100;
    progressBar.style.width = progress + '%';
    waveformProgress.style.width = progress + '%';
    currentTime.textContent = formatAudioTime(audioElement.currentTime);
}

// Função para quando o áudio termina
function handleAudioEnded() {
    isAudioPlaying = false;
    playIcon.classList.remove('hidden');
    pauseIcon.classList.add('hidden');
    progressBar.style.width = '0%';
    waveformProgress.style.width = '0%';
    currentTime.textContent = '00:00';
    audioElement.currentTime = 0;
    console.log('Reprodução finalizada');
}

// Função para tratar erros de áudio
function handleAudioError(error) {
    console.error('Erro no áudio:', error);
    isAudioPlaying = false;
    playIcon.classList.remove('hidden');
    pauseIcon.classList.add('hidden');
}

// Função para formatar tempo do áudio
function formatAudioTime(seconds) {
    if (isNaN(seconds)) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Função para download do áudio
function downloadAudio() {
    if (!audioElement || !audioElement._audioBlob) {
        console.error('Nenhum áudio disponível para download');
        return;
    }
    
    const blob = audioElement._audioBlob;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
    
    a.href = url;
    a.download = `talker_recording_${timestamp}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    // Revogar URL imediatamente após o download
    setTimeout(() => URL.revokeObjectURL(url), 100);
    
    console.log('Download do áudio iniciado');
}

// FUNÇÕES PARA VISUALIZAÇÃO DE FORMA DE ONDA

// Função para gerar forma de onda do áudio
async function generateWaveform(audioBlob) {
    try {
        console.log('Gerando forma de onda...');
        
        // Ajustar canvas para resolução correta
        adjustCanvasSize();
        
        // Criar contexto de áudio para análise
        if (!waveformAudioContext) {
            waveformAudioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        
        // Converter blob para ArrayBuffer
        const arrayBuffer = await audioBlob.arrayBuffer();
        
        // Decodificar dados de áudio
        const audioBuffer = await waveformAudioContext.decodeAudioData(arrayBuffer);
        
        // Extrair dados do canal de áudio (usar apenas o primeiro canal)
        const channelData = audioBuffer.getChannelData(0);
        
        // Reduzir resolução para ajustar ao canvas
        const samples = Math.min(canvasWidth, channelData.length);
        const blockSize = Math.floor(channelData.length / samples);
        
        waveformData = [];
        
        // Processar dados em blocos para criar forma de onda
        for (let i = 0; i < samples; i++) {
            let blockSum = 0;
            const startIndex = blockSize * i;
            
            // Calcular RMS (Root Mean Square) para cada bloco
            for (let j = 0; j < blockSize; j++) {
                if (startIndex + j < channelData.length) {
                    blockSum += channelData[startIndex + j] * channelData[startIndex + j];
                }
            }
            
            const rms = Math.sqrt(blockSum / blockSize);
            waveformData.push(rms);
        }
        
        // Desenhar forma de onda no canvas
        drawWaveform();
        console.log('Forma de onda gerada com sucesso');
        
    } catch (error) {
        console.error('Erro ao gerar forma de onda:', error);
        // Desenhar forma de onda padrão em caso de erro
        drawPlaceholderWaveform();
    }
}

// Função para desenhar a forma de onda no canvas
function drawWaveform() {
    if (!waveformData || waveformData.length === 0) {
        drawPlaceholderWaveform();
        return;
    }
    
    // Limpar canvas
    waveformCtx.clearRect(0, 0, canvasWidth, canvasHeight);
    
    // Configurações de desenho
    waveformCtx.fillStyle = '#10b981'; // Verde (cor do tema)
    waveformCtx.strokeStyle = '#10b981';
    waveformCtx.lineWidth = 1;
    
    // Desenhar em CSS pixels (transformação já aplicada)
    const cssWidth = waveformCanvas.getBoundingClientRect().width;
    const cssHeight = waveformCanvas.getBoundingClientRect().height;
    const barWidth = cssWidth / waveformData.length;
    const centerY = cssHeight / 2;
    
    // Desenhar cada barra da forma de onda
    waveformData.forEach((amplitude, index) => {
        const barHeight = amplitude * centerY * 0.8; // 80% da altura máxima
        const x = index * barWidth;
        const y = centerY - barHeight / 2;
        
        // Desenhar barra vertical
        waveformCtx.fillRect(x, y, Math.max(1, barWidth - 1), barHeight);
    });
}

// Função para desenhar forma de onda placeholder (quando há erro)
function drawPlaceholderWaveform() {
    adjustCanvasSize(); // Garantir que canvas tem tamanho correto
    
    const cssWidth = waveformCanvas.getBoundingClientRect().width;
    const cssHeight = waveformCanvas.getBoundingClientRect().height;
    
    waveformCtx.clearRect(0, 0, cssWidth, cssHeight);
    
    waveformCtx.fillStyle = '#374151'; // Cinza escuro
    const barWidth = cssWidth / 50; // 50 barras
    const centerY = cssHeight / 2;
    
    // Desenhar barras aleatórias simulando forma de onda
    for (let i = 0; i < 50; i++) {
        const amplitude = Math.random() * 0.8 + 0.1; // Entre 0.1 e 0.9
        const barHeight = amplitude * centerY;
        const x = i * barWidth;
        const y = centerY - barHeight / 2;
        
        waveformCtx.fillRect(x, y, Math.max(1, barWidth - 1), barHeight);
    }
}

// Função para handle de clique na forma de onda (seeking)
function handleWaveformClick(event) {
    if (!audioElement || isNaN(audioElement.duration)) return;
    
    const rect = waveformCanvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const clickPosition = x / rect.width;
    
    // Calcular nova posição no áudio
    const newTime = clickPosition * audioElement.duration;
    audioElement.currentTime = newTime;
    
    // Atualizar UI imediatamente (mesmo se pausado)
    updateAudioProgress();
    
    console.log(`Seeking para: ${formatAudioTime(newTime)}`);
}

// Função para ajustar tamanho do canvas
function adjustCanvasSize() {
    const rect = waveformCanvas.getBoundingClientRect();
    const devicePixelRatio = window.devicePixelRatio || 1;
    
    // Definir tamanho em CSS pixels
    const cssWidth = Math.floor(rect.width);
    const cssHeight = Math.floor(rect.height);
    
    // Ajustar resolução do canvas para device pixels
    canvasWidth = cssWidth * devicePixelRatio;
    canvasHeight = cssHeight * devicePixelRatio;
    
    waveformCanvas.width = canvasWidth;
    waveformCanvas.height = canvasHeight;
    
    // Definir tamanho CSS
    waveformCanvas.style.width = cssWidth + 'px';
    waveformCanvas.style.height = cssHeight + 'px';
    
    // Escalar contexto para device pixel ratio
    waveformCtx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    
    console.log(`Canvas ajustado: ${canvasWidth}x${canvasHeight} (CSS: ${cssWidth}x${cssHeight})`);
}

// FUNÇÕES PARA PERSISTÊNCIA LOCAL (IndexedDB)

// Função para inicializar IndexedDB
async function initializeDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onerror = () => {
            console.error('Erro ao abrir IndexedDB:', request.error);
            reject(request.error);
        };
        
        request.onsuccess = () => {
            dbConnection = request.result;
            console.log('IndexedDB inicializado com sucesso');
            resolve(dbConnection);
        };
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            const transaction = event.target.transaction;
            console.log('Atualizando estrutura do banco de dados...');
            
            // Criar object store para gravações
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { 
                    keyPath: 'id', 
                    autoIncrement: true 
                });
                
                // Índices para busca
                store.createIndex('timestamp', 'timestamp', { unique: false });
                store.createIndex('title', 'title', { unique: false });
                store.createIndex('duration', 'duration', { unique: false });
                store.createIndex('folder', 'folder', { unique: false });
                
                console.log('Object store "recordings" criado');
            } else if (event.oldVersion < 2) {
                // Migração para versão 2 - adicionar índice de pasta
                const store = transaction.objectStore(STORE_NAME);
                if (!store.indexNames.contains('folder')) {
                    store.createIndex('folder', 'folder', { unique: false });
                }
                
                // Atualizar gravações existentes para ter pasta padrão
                const getAllRequest = store.getAll();
                getAllRequest.onsuccess = () => {
                    const recordings = getAllRequest.result;
                    recordings.forEach(recording => {
                        if (!recording.folder) {
                            recording.folder = 'uncategorized';
                            store.put(recording);
                        }
                    });
                };
                
                // Aguardar migração completar antes de resolver
                transaction.oncomplete = () => {
                    console.log('Migração de gravações completa');
                };
            }
            
            // Criar object store para pastas
            if (!db.objectStoreNames.contains(FOLDERS_STORE)) {
                const foldersStore = db.createObjectStore(FOLDERS_STORE, {
                    keyPath: 'id' // Sem autoIncrement - usaremos IDs string
                });
                
                foldersStore.createIndex('name', 'name', { unique: true });
                foldersStore.createIndex('created', 'created', { unique: false });
                
                console.log('Object store "folders" criado');
                
                // Criar pasta padrão "Sem Categoria"
                foldersStore.add({
                    id: 'uncategorized',
                    name: 'Sem Categoria',
                    created: Date.now(),
                    color: '#6b7280'
                });
            }
        };
    });
}

// Função para salvar gravação no IndexedDB
async function saveRecording(audioBlob, duration, title = null) {
    if (!dbConnection) {
        await initializeDB();
    }
    
    return new Promise((resolve, reject) => {
        const transaction = dbConnection.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        
        // Determinar pasta para nova gravação
        let targetFolder = 'uncategorized'; // Padrão
        if (currentFolder && currentFolder !== 'all') {
            targetFolder = currentFolder;
        }
        
        // Criar objeto de gravação
        const recording = {
            title: title || `Gravação ${new Date().toLocaleString('pt-BR')}`,
            timestamp: Date.now(),
            duration: duration,
            audioBlob: audioBlob,
            size: audioBlob.size,
            type: audioBlob.type,
            folder: targetFolder,
            transformations: [] // Array para múltiplas versões/transformações
        };
        
        const request = store.add(recording);
        
        request.onerror = () => {
            console.error('Erro ao salvar gravação:', request.error);
            reject(request.error);
        };
        
        request.onsuccess = () => {
            console.log('Gravação salva com ID:', request.result);
            resolve(request.result);
        };
        
        transaction.oncomplete = () => {
            console.log('Transação de salvamento concluída');
        };
        
        transaction.onerror = () => {
            console.error('Erro na transação de salvamento:', transaction.error);
            reject(transaction.error);
        };
    });
}

// Função para carregar todas as gravações
async function loadAllRecordings() {
    if (!dbConnection) {
        await initializeDB();
    }
    
    return new Promise((resolve, reject) => {
        const transaction = dbConnection.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();
        
        request.onerror = () => {
            console.error('Erro ao carregar gravações:', request.error);
            reject(request.error);
        };
        
        request.onsuccess = () => {
            const recordings = request.result.sort((a, b) => b.timestamp - a.timestamp);
            console.log('Gravações carregadas:', recordings.length);
            resolve(recordings);
        };
    });
}

// Função para carregar gravação específica por ID
async function loadRecording(id) {
    if (!dbConnection) {
        await initializeDB();
    }
    
    return new Promise((resolve, reject) => {
        const transaction = dbConnection.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(id);
        
        request.onerror = () => {
            console.error('Erro ao carregar gravação:', request.error);
            reject(request.error);
        };
        
        request.onsuccess = () => {
            resolve(request.result);
        };
    });
}

// Função para excluir gravação
async function deleteRecording(id) {
    if (!dbConnection) {
        await initializeDB();
    }
    
    return new Promise((resolve, reject) => {
        const transaction = dbConnection.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);
        
        request.onerror = () => {
            console.error('Erro ao excluir gravação:', request.error);
            reject(request.error);
        };
        
        request.onsuccess = () => {
            console.log('Gravação excluída com sucesso');
            resolve();
        };
    });
}

// Função para obter estatísticas das gravações
async function getRecordingsStats() {
    const recordings = await loadAllRecordings();
    const totalSize = recordings.reduce((acc, rec) => acc + rec.size, 0);
    const totalDuration = recordings.reduce((acc, rec) => acc + rec.duration, 0);
    
    return {
        count: recordings.length,
        totalSize: totalSize,
        totalDuration: totalDuration,
        averageDuration: recordings.length > 0 ? totalDuration / recordings.length : 0
    };
}

// FUNÇÕES PARA GERENCIAMENTO DE PASTAS

// Função para carregar todas as pastas
async function loadAllFolders() {
    if (!dbConnection) {
        await initializeDB();
    }
    
    return new Promise((resolve, reject) => {
        const transaction = dbConnection.transaction([FOLDERS_STORE], 'readonly');
        const store = transaction.objectStore(FOLDERS_STORE);
        const request = store.getAll();
        
        request.onerror = () => {
            console.error('Erro ao carregar pastas:', request.error);
            reject(request.error);
        };
        
        request.onsuccess = () => {
            const folders = request.result.sort((a, b) => a.name.localeCompare(b.name));
            console.log('Pastas carregadas:', folders.length);
            resolve(folders);
        };
    });
}

// Função para criar nova pasta
async function createFolder(name, color = '#6b7280') {
    if (!dbConnection) {
        await initializeDB();
    }
    
    return new Promise((resolve, reject) => {
        const transaction = dbConnection.transaction([FOLDERS_STORE], 'readwrite');
        const store = transaction.objectStore(FOLDERS_STORE);
        
        // Gerar ID único baseado em timestamp e random
        const folderId = `folder_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        
        const folder = {
            id: folderId,
            name: name.trim(),
            created: Date.now(),
            color: color
        };
        
        const request = store.add(folder);
        
        request.onerror = () => {
            console.error('Erro ao criar pasta:', request.error);
            if (request.error.name === 'ConstraintError') {
                reject(new Error('Já existe uma pasta com este nome. Escolha outro nome.'));
            } else {
                reject(request.error);
            }
        };
        
        request.onsuccess = () => {
            console.log('Pasta criada com ID:', folderId);
            resolve(folderId);
        };
    });
}

// Função para excluir pasta
async function deleteFolder(folderId) {
    if (!dbConnection) {
        await initializeDB();
    }
    
    // Não permitir excluir pasta "uncategorized"
    if (folderId === 'uncategorized') {
        throw new Error('Não é possível excluir a pasta padrão');
    }
    
    return new Promise(async (resolve, reject) => {
        try {
            // Primeiro, mover todas as gravações desta pasta para "uncategorized"
            const recordings = await loadRecordingsByFolder(folderId);
            
            for (const recording of recordings) {
                await moveRecordingToFolder(recording.id, 'uncategorized');
            }
            
            // Depois excluir a pasta
            const transaction = dbConnection.transaction([FOLDERS_STORE], 'readwrite');
            const store = transaction.objectStore(FOLDERS_STORE);
            const request = store.delete(folderId);
            
            request.onerror = () => {
                console.error('Erro ao excluir pasta:', request.error);
                reject(request.error);
            };
            
            request.onsuccess = () => {
                console.log('Pasta excluída com sucesso');
                resolve();
            };
        } catch (error) {
            reject(error);
        }
    });
}

// Função para carregar gravações por pasta
async function loadRecordingsByFolder(folderId) {
    if (!dbConnection) {
        await initializeDB();
    }
    
    return new Promise((resolve, reject) => {
        const transaction = dbConnection.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const index = store.index('folder');
        const request = index.getAll(folderId);
        
        request.onerror = () => {
            console.error('Erro ao carregar gravações da pasta:', request.error);
            reject(request.error);
        };
        
        request.onsuccess = () => {
            const recordings = request.result.sort((a, b) => b.timestamp - a.timestamp);
            resolve(recordings);
        };
    });
}

// Função para mover gravação para pasta
async function moveRecordingToFolder(recordingId, folderId) {
    if (!dbConnection) {
        await initializeDB();
    }
    
    return new Promise((resolve, reject) => {
        const transaction = dbConnection.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        
        // Primeiro carregar a gravação
        const getRequest = store.get(recordingId);
        getRequest.onsuccess = () => {
            const recording = getRequest.result;
            if (!recording) {
                reject(new Error('Gravação não encontrada'));
                return;
            }
            
            // Atualizar a pasta
            recording.folder = folderId;
            
            // Salvar de volta
            const putRequest = store.put(recording);
            putRequest.onerror = () => {
                console.error('Erro ao mover gravação:', putRequest.error);
                reject(putRequest.error);
            };
            
            putRequest.onsuccess = () => {
                console.log('Gravação movida para pasta:', folderId);
                resolve();
            };
        };
        
        getRequest.onerror = () => {
            console.error('Erro ao carregar gravação:', getRequest.error);
            reject(getRequest.error);
        };
    });
}

// FUNÇÕES PARA INTERFACE DE GRAVAÇÕES

// Função para atualizar lista de gravações na interface
async function updateRecordingsList() {
    // Garantir que DB está inicializado
    if (!dbConnection) {
        await initializeDB();
    }
    
    try {
        // Carregar gravações conforme pasta selecionada
        let recordings;
        if (currentFolder === 'all') {
            recordings = await loadAllRecordings();
        } else {
            recordings = await loadRecordingsByFolder(currentFolder);
        }
        
        const stats = await getRecordingsStats();
        
        // Atualizar estatísticas no cabeçalho
        recordingsCount.textContent = stats.count;
        recordingsSize.textContent = formatFileSize(stats.totalSize);
        
        // Limpar lista atual
        recordingsList.innerHTML = '';
        
        // Mostrar/esconder estado vazio
        if (recordings.length === 0) {
            recordingsEmptyState.classList.remove('hidden');
            return;
        } else {
            recordingsEmptyState.classList.add('hidden');
        }
        
        // Renderizar cada gravação
        recordings.forEach(recording => {
            const recordingElement = createRecordingElement(recording);
            recordingsList.appendChild(recordingElement);
        });
        
        console.log('Lista de gravações atualizada');
    } catch (error) {
        console.error('Erro ao atualizar lista de gravações:', error);
    }
}

// Função para criar elemento HTML de uma gravação
function createRecordingElement(recording) {
    const div = document.createElement('div');
    div.className = 'bg-gray-800 rounded-lg p-3 border border-gray-700 hover:bg-gray-750 transition-colors';
    div.dataset.recordingId = recording.id;
    
    div.innerHTML = `
        <div class="flex items-center justify-between">
            <div class="flex-grow">
                <div class="flex items-center space-x-2">
                    <h3 class="text-sm font-medium text-white truncate max-w-[200px]">${recording.title}</h3>
                    <span class="text-xs text-gray-500">${formatFileSize(recording.size)}</span>
                </div>
                <div class="flex items-center space-x-2 text-xs text-gray-400 mt-1">
                    <span>${formatAudioTime(recording.duration)}</span>
                    <span>•</span>
                    <span>${new Date(recording.timestamp).toLocaleDateString('pt-BR')}</span>
                    <span>${new Date(recording.timestamp).toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})}</span>
                </div>
            </div>
            <div class="flex items-center space-x-1 ml-2">
                <button class="move-recording-btn w-8 h-8 rounded-full border border-blue-600 flex items-center justify-center text-blue-400 hover:text-blue-300 hover:border-blue-500 transition-colors" title="Mover para Pasta">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-5l-2-2H5a2 2 0 00-2 2z"></path>
                    </svg>
                </button>
                <button class="play-recording-btn w-8 h-8 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center text-white transition-colors" title="Reproduzir">
                    <svg class="w-3 h-3 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z"/>
                    </svg>
                </button>
                <button class="download-recording-btn w-8 h-8 rounded-full border border-gray-600 flex items-center justify-center text-gray-400 hover:text-white hover:border-gray-400 transition-colors" title="Baixar">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                    </svg>
                </button>
                <button class="transcribe-recording-btn w-8 h-8 rounded-full border border-purple-600 flex items-center justify-center text-purple-400 hover:text-purple-300 hover:border-purple-500 transition-colors" title="Transcrever e Analisar">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                    </svg>
                </button>
                ${recording.transformations && recording.transformations.length > 0 ? 
                    `<button class="view-transformations-btn w-8 h-8 rounded-full border border-green-600 flex items-center justify-center text-green-400 hover:text-green-300 hover:border-green-500 transition-colors" title="Ver Transformações (${recording.transformations.length})">
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2v0a2 2 0 01-2-2v-5H8.5a.5.5 0 01-.5-.5z"></path>
                        </svg>
                    </button>` : ''
                }
                <button class="delete-recording-btn w-8 h-8 rounded-full border border-red-600 flex items-center justify-center text-red-400 hover:text-red-300 hover:border-red-500 transition-colors" title="Excluir">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                    </svg>
                </button>
            </div>
        </div>
    `;
    
    // Event listeners para os botões
    const moveBtn = div.querySelector('.move-recording-btn');
    const playBtn = div.querySelector('.play-recording-btn');
    const downloadRecordingBtn = div.querySelector('.download-recording-btn');
    const transcribeBtn = div.querySelector('.transcribe-recording-btn');
    const viewTransformationsBtn = div.querySelector('.view-transformations-btn');
    const deleteBtn = div.querySelector('.delete-recording-btn');
    
    moveBtn.addEventListener('click', () => showMoveRecordingDialog(recording.id));
    playBtn.addEventListener('click', () => playRecording(recording.id));
    downloadRecordingBtn.addEventListener('click', () => downloadRecording(recording));
    transcribeBtn.addEventListener('click', () => transcribeRecording(recording.id));
    if (viewTransformationsBtn) {
        viewTransformationsBtn.addEventListener('click', () => showTransformationHistory(recording.id));
    }
    deleteBtn.addEventListener('click', () => deleteRecordingWithConfirmation(recording.id));
    
    return div;
}

// Função para reproduzir gravação salva
async function playRecording(recordingId) {
    try {
        const recording = await loadRecording(recordingId);
        if (!recording) {
            console.error('Gravação não encontrada');
            return;
        }
        
        // Criar URL temporária para reprodução
        const audioURL = URL.createObjectURL(recording.audioBlob);
        
        // Limpar reprodução atual e criar nova
        hideAudioControls();
        createAudioElement(audioURL, recording.audioBlob);
        showAudioControls();
        
        console.log('Reproduzindo gravação salva:', recording.title);
    } catch (error) {
        console.error('Erro ao reproduzir gravação salva:', error);
    }
}

// Função para baixar gravação salva
function downloadRecording(recording) {
    const url = URL.createObjectURL(recording.audioBlob);
    const a = document.createElement('a');
    const filename = recording.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    
    a.href = url;
    a.download = `${filename}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    // Revogar URL após download
    setTimeout(() => URL.revokeObjectURL(url), 100);
    
    console.log('Download da gravação salva iniciado:', recording.title);
}

// Função para excluir gravação com confirmação
async function deleteRecordingWithConfirmation(recordingId) {
    const recording = await loadRecording(recordingId);
    if (!recording) return;
    
    if (confirm(`Tem certeza que deseja excluir "${recording.title}"?`)) {
        try {
            await deleteRecording(recordingId);
            await updateRecordingsList();
            console.log('Gravação excluída:', recording.title);
        } catch (error) {
            console.error('Erro ao excluir gravação:', error);
            alert('Erro ao excluir gravação. Tente novamente.');
        }
    }
}

// Função para mostrar painel de gravações
async function showRecordingsPane() {
    // Ocultar todas as tabs
    document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.add('hidden'));
    
    // Mostrar painel de gravações
    recordingsPane.classList.remove('hidden');
    
    // Atualizar seletor de pastas
    await updateFolderSelector();
    
    // Atualizar lista
    updateRecordingsList();
}

// Função para atualizar seletor de pastas
async function updateFolderSelector() {
    try {
        const folders = await loadAllFolders();
        availableFolders = folders;
        
        // Limpar opções exceto as padrões
        folderSelector.innerHTML = `
            <option value="all">📁 Todas as Gravações</option>
            <option value="uncategorized">📂 Sem Categoria</option>
        `;
        
        // Adicionar pastas personalizadas
        folders.forEach(folder => {
            if (folder.id !== 'uncategorized') {
                const option = document.createElement('option');
                option.value = folder.id;
                option.textContent = `📁 ${folder.name}`;
                folderSelector.appendChild(option);
            }
        });
        
        // Restaurar seleção atual
        folderSelector.value = currentFolder;
        
    } catch (error) {
        console.error('Erro ao atualizar seletor de pastas:', error);
    }
}

// Função para criar nova pasta
async function showCreateFolderDialog() {
    const folderName = prompt('Nome da nova pasta:');
    if (!folderName || !folderName.trim()) return;
    
    try {
        const folderId = await createFolder(folderName.trim());
        await updateFolderSelector();
        
        // Selecionar a nova pasta automaticamente
        currentFolder = folderId;
        folderSelector.value = folderId;
        await updateRecordingsList();
        
        console.log('Pasta criada com sucesso:', folderName);
    } catch (error) {
        console.error('Erro ao criar pasta:', error);
        if (error.message.includes('Já existe uma pasta')) {
            alert(error.message);
        } else {
            alert('Erro ao criar pasta. Tente novamente.');
        }
    }
}

// Função para mostrar dialog de mover gravação
async function showMoveRecordingDialog(recordingId) {
    try {
        const folders = await loadAllFolders();
        
        // Criar lista de opções
        let options = 'Escolha a pasta de destino:\n\n';
        options += '0 - Sem Categoria\n';
        
        let optionIndex = 1;
        folders.forEach(folder => {
            if (folder.id !== 'uncategorized') {
                options += `${optionIndex} - ${folder.name}\n`;
                optionIndex++;
            }
        });
        
        const choice = prompt(options);
        if (choice === null) return; // Cancelado
        
        const choiceIndex = parseInt(choice);
        let targetFolderId;
        
        if (choiceIndex === 0) {
            targetFolderId = 'uncategorized';
        } else {
            // Encontrar a pasta correspondente à escolha (excluindo uncategorized)
            const nonUncategorizedFolders = folders.filter(f => f.id !== 'uncategorized');
            if (choiceIndex > 0 && choiceIndex <= nonUncategorizedFolders.length) {
                targetFolderId = nonUncategorizedFolders[choiceIndex - 1].id;
            } else {
                alert('Opção inválida');
                return;
            }
        }
        
        await moveRecordingToFolder(recordingId, targetFolderId);
        await updateRecordingsList();
        
        console.log('Gravação movida com sucesso');
    } catch (error) {
        console.error('Erro ao mover gravação:', error);
        alert('Erro ao mover gravação. Tente novamente.');
    }
}

// Função para formatar tamanho de arquivo
function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Função para limpar dados de gravação anterior
function clearPreviousRecording() {
    audioChunks = [];
    recordedAudioBlob = null;
    
    // Esconder controles de áudio da gravação anterior
    hideAudioControls();
    
    console.log('Dados de gravação anteriores limpos');
}

// Função para formatar tempo em MM:SS
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Função para iniciar o timer de gravação
function startRecordingTimer() {
    recordingStartTime = Date.now();
    recordingTimer.classList.remove('hidden');
    recordingInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
        recordingTimer.textContent = formatTime(elapsed);
    }, 1000);
}

// Função para parar o timer de gravação
function stopRecordingTimer() {
    if (recordingInterval) {
        clearInterval(recordingInterval);
        recordingInterval = null;
    }
    recordingTimer.classList.add('hidden');
    recordingTimer.textContent = '00:00';
}

// Função para configurar análise de volume
function setupVolumeAnalysis() {
    volumeAudioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = volumeAudioContext.createAnalyser();
    analyser.fftSize = 256;
    
    const source = volumeAudioContext.createMediaStreamSource(mediaStream);
    source.connect(analyser);
    
    dataArray = new Uint8Array(analyser.frequencyBinCount);
    startVolumeAnimation();
}

// Função para animação baseada no volume - Estilo medidor de áudio profissional
function startVolumeAnimation() {
    function animate() {
        if (!isMainRecording) return;
        
        analyser.getByteFrequencyData(dataArray);
        
        // Calcular volume médio
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        const normalizedVolume = Math.min(average / 40, 1); // Normalizar mais sensível
        
        // Simular ruído ambiente constante (oscilação base) como em medidores reais
        const noiseFloor = 0.15 + (Math.random() * 0.1); // Base 15-25% sempre ativa
        
        // Combinar ruído ambiente com volume real
        const finalVolume = Math.max(noiseFloor, normalizedVolume);
        
        // Intensidade muito mais destacada para efeito realista
        const glowIntensity = finalVolume * 0.8; // Intensidade alta como medidor real
        const heightPercentage = Math.min(finalVolume * 70 + 10, 80); // 10% a 80% de altura
        
        // Efeito luminoso verde reativo mais intenso
        towerVolumeGlow.style.background = `
            linear-gradient(45deg, 
                rgba(110, 231, 183, ${glowIntensity}) 0%, 
                rgba(34, 197, 94, ${glowIntensity * 0.8}) 50%, 
                rgba(22, 163, 74, ${glowIntensity * 0.6}) 100%)
        `;
        
        // Simular altura do medidor de decibéis na torre
        commandTower.style.setProperty('--decibel-height', `${heightPercentage}%`);
        
        animationFrame = requestAnimationFrame(animate);
    }
    animate();
}

// Função para parar análise de volume
function stopVolumeAnalysis() {
    if (animationFrame) {
        cancelAnimationFrame(animationFrame);
        animationFrame = null;
    }
    if (volumeAudioContext) {
        volumeAudioContext.close();
        volumeAudioContext = null;
    }
    
    // Resetar estilos dos elementos visuais
    towerVolumeGlow.style.background = '';
    towerVolumeGlow.classList.add('hidden');
    recordingBorder.classList.add('hidden');
    
    // Resetar altura do medidor de decibéis
    commandTower.style.removeProperty('--decibel-height');
}

// Event listeners para controles de áudio
playPauseBtn.addEventListener('click', toggleAudioPlayback);
downloadBtn.addEventListener('click', downloadAudio);
saveBtn.addEventListener('click', saveCurrentRecording);

// Event listener para seeking na forma de onda (já adicionado, mas verificando se está funcionando)
waveformCanvas.addEventListener('click', handleWaveformClick);

// Event listeners para sistema de pastas
historyBtn.addEventListener('click', showRecordingsPane);
createFolderBtn.addEventListener('click', showCreateFolderDialog);
folderSelector.addEventListener('change', (e) => {
    currentFolder = e.target.value;
    updateRecordingsList();
});

// Função para salvar gravação atual manualmente
async function saveCurrentRecording() {
    if (!audioElement || !audioElement._audioBlob) {
        console.log('Nenhuma gravação atual para salvar');
        return;
    }
    
    // Verificar se já foi salva automaticamente
    if (audioElement._savedRecordingId) {
        console.log('Gravação já foi salva automaticamente com ID:', audioElement._savedRecordingId);
        // Ainda permitir renomear se usuário quiser
        const renameResult = confirm('Esta gravação já foi salva automaticamente. Deseja salvar uma cópia com nome personalizado?');
        if (!renameResult) return;
    }
    
    try {
        const duration = audioElement.duration || 0;
        const title = prompt('Nome da gravação:') || `Gravação ${new Date().toLocaleString('pt-BR')}`;
        
        const recordingId = await saveRecording(audioElement._audioBlob, duration, title);
        console.log('Gravação salva manualmente com ID:', recordingId);
        
        // Feedback visual
        saveBtn.style.color = '#10b981';
        saveBtn.style.borderColor = '#10b981';
        setTimeout(() => {
            saveBtn.style.color = '';
            saveBtn.style.borderColor = '';
        }, 1000);
        
        // Atualizar lista se estiver visível
        if (!recordingsPane.classList.contains('hidden')) {
            updateRecordingsList();
        }
    } catch (error) {
        console.error('Erro ao salvar gravação manualmente:', error);
        alert('Erro ao salvar gravação. Tente novamente.');
    }
}

// Event listener para o botão do assistente
assistantBtn.addEventListener('click', () => {
    console.log('Botão assistente clicado - funcionalidade a implementar');
    // Aqui será implementada a funcionalidade de falar com o assistente
    alert('Funcionalidade "Falar com Assistente" será implementada em breve!');
});

startRecordingBtn.addEventListener('click', async () => {
    isMainRecording = !isMainRecording;
    commandTower.classList.toggle('is-recording', isMainRecording);

    if (isMainRecording) {
        // Lógica de iniciar a gravação (primeiro clique)
        try {
            // FASE 2: Limpar dados de gravação anterior
            clearPreviousRecording();
            
            mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(mediaStream);
            
            // FASE 2: Configurar event listeners para capturar dados de áudio
            setupMediaRecorderEvents(mediaRecorder);
            
            // Iniciar gravação
            mediaRecorder.start();
            
            // Ativar efeitos visuais da gravação
            recordingBorder.classList.remove('hidden'); // Mostrar borda girando
            towerVolumeGlow.classList.remove('hidden'); // Mostrar efeito luminoso na torre
            
            // Iniciar o timer
            startRecordingTimer();
            
            // Iniciar análise de volume e animação
            setupVolumeAnalysis();
            
            console.log('Gravação iniciada - FASE 2: Captura de dados ativada');
        } catch (error) {
            console.error('Erro ao aceder ao microfone:', error);
            alert('Erro ao aceder ao microfone. Verifique as permissões do navegador.');
            // Reverter o estado se houver erro
            isMainRecording = false;
            commandTower.classList.remove('is-recording');
            recordingBorder.classList.add('hidden');
            towerVolumeGlow.classList.add('hidden');
        }
        
        // Colapsar a interface para modo de gravação
        talkerApp.style.width = '160px';
        contentWindow.classList.add('hidden');
        contentWindow.classList.remove('flex');
    } else {
        // Lógica de parar a gravação (segundo clique)
        if (mediaRecorder) {
            mediaRecorder.stop();
        }
        if (mediaStream) {
            mediaStream.getTracks().forEach(track => track.stop());
        }
        
        // Parar o timer
        stopRecordingTimer();
        
        // Parar análise de volume e animação
        stopVolumeAnalysis();
        
        console.log('Gravação parada');
        
        // Expandir a interface para mostrar o conteúdo
        talkerApp.style.width = '700px';
        contentWindow.classList.remove('hidden');
        contentWindow.classList.add('flex');
    }
});

const uploadBtn = document.getElementById('uploadBtn');
const uploadModal = document.getElementById('uploadModal');
const closeModalBtn = document.getElementById('closeModalBtn');

uploadBtn.addEventListener('click', () => uploadModal.classList.remove('hidden'));
closeModalBtn.addEventListener('click', () => uploadModal.classList.add('hidden'));
uploadModal.addEventListener('click', (e) => {
    if (e.target === uploadModal) {
        uploadModal.classList.add('hidden');
    }
});

function updateTabEventListeners() {
    document.querySelectorAll('.tab-item').forEach((tab) => {
         const newTab = tab.cloneNode(true);
         tab.parentNode.replaceChild(newTab, tab);
    });
    document.querySelectorAll('.tab-item').forEach((tab, index) => {
         tab.addEventListener('click', (e) => {
            e.preventDefault();
            if(isPromptRecording) return;

            document.querySelectorAll('.tab-item').forEach(item => {
                item.classList.remove('text-green-400', 'border-green-400');
                item.classList.add('text-gray-400', 'border-transparent');
            });
            tab.classList.add('text-green-400', 'border-green-400');

            document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.add('hidden'));
            document.querySelectorAll('.tab-pane')[index].classList.remove('hidden');
        });
    });
}

updateTabEventListeners();

// Inicializar sistema quando DOM estiver carregado
document.addEventListener('DOMContentLoaded', async function() {
    console.log('TalkerApp carregado');
    updateTabEventListeners();
    
    // Inicializar IndexedDB
    try {
        await initializeDB();
        console.log('Sistema de persistência inicializado');
        
        // Carregar pastas se já estiver no painel de gravações
        if (!recordingsPane.classList.contains('hidden')) {
            await updateFolderSelector();
        }
    } catch (error) {
        console.error('Erro ao inicializar sistema de persistência:', error);
    }
});

function createNewTab() {
    promptStatus.classList.add('hidden');
    tabsContent.classList.remove('hidden');

    const taskName = prompt("Qual o nome da nova tarefa? (ex: Resumo)", "Nova Tarefa");
    if (taskName) {
        const newTab = document.createElement('a');
        newTab.href = '#';
        newTab.className = 'tab-item text-gray-400 border-transparent py-2 px-1 border-b-2 font-medium text-sm';
        newTab.textContent = taskName;
        tabsNav.appendChild(newTab);

        const newPane = document.createElement('div');
        newPane.className = 'tab-pane hidden';
        newPane.innerHTML = `
                <h1 class="text-xl font-bold mb-4">${taskName}</h1>
                <p class="text-sm leading-relaxed">Este é o resultado simulado para a tarefa "${taskName}".</p>
            `;
        tabsContent.appendChild(newPane);

        updateTabEventListeners();
        newTab.click();
    }
}

newTransformationBtn.addEventListener('click', () => {
    isPromptRecording = !isPromptRecording;
    commandTower.classList.toggle('is-recording', isPromptRecording);

    const icon = document.getElementById('newTransformationIcon');
    const text = document.getElementById('newTransformationText');

    if (isPromptRecording) {
        text.textContent = "Parar Gravação do Prompt";
        icon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 10h6"></path>`;
        icon.classList.add('animate-pulse');

        tabsContent.classList.add('hidden');
        promptStatus.classList.remove('hidden');
        statusText.textContent = "Aguardando instruções...";
        statusText.classList.add('animate-pulse');
    } else {
        text.textContent = "+ Nova Transformação";
        icon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />`;
        icon.classList.remove('animate-pulse');
        statusText.classList.remove('animate-pulse');

        let statusMessages = ["Processando novas Instruções...", "Executando tarefa...", "Finalizando..."];
        let i = 0;
        statusText.textContent = statusMessages[i];

        const processingInterval = setInterval(() => {
            i++;
            if (i < statusMessages.length) {
                statusText.textContent = statusMessages[i];
            } else {
                 clearInterval(processingInterval);
                 createNewTab();
            }
        }, 1000);
    }
});

// ===========================================
// SISTEMA DE TRANSCRIÇÃO E ANÁLISE OPENAI
// ===========================================

// Função para obter chave OpenAI de forma segura
async function getOpenAIKey() {
    // Tentar diferentes métodos para obter a chave
    let apiKey = null;
    
    // Método 1: Variável global injetada
    if (window.ENV?.OPENAI_API_KEY && window.ENV.OPENAI_API_KEY !== 'PLACEHOLDER_OPENAI_KEY') {
        apiKey = window.ENV.OPENAI_API_KEY;
    }
    
    // Método 2: Tentar via fetch para endpoint local (se disponível)
    if (!apiKey) {
        try {
            const response = await fetch('/api/env');
            if (response.ok) {
                const data = await response.json();
                apiKey = data.OPENAI_API_KEY;
            }
        } catch (e) {
            // Endpoint não disponível, continuar
        }
    }
    
    // Método 3: Prompt do usuário como fallback
    if (!apiKey) {
        apiKey = prompt('Para usar transcrição, insira sua chave OpenAI:\n(Será usada apenas nesta sessão)');
        if (apiKey) {
            // Armazenar temporariamente na sessão
            window.ENV = window.ENV || {};
            window.ENV.OPENAI_API_KEY = apiKey;
        }
    }
    
    return apiKey;
}

// Função para transcrever áudio usando Whisper API
async function transcribeAudio(audioBlob) {
    const OPENAI_API_KEY = await getOpenAIKey();
    
    if (!OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY não configurada');
    }
    
    try {
        // Criar FormData para envio do áudio
        const formData = new FormData();
        formData.append('file', audioBlob, 'audio.webm');
        formData.append('model', 'whisper-1');
        formData.append('language', 'pt'); // Português brasileiro
        formData.append('response_format', 'json');
        
        // Chamada para API Whisper
        const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: formData
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Erro API Whisper: ${errorData.error?.message || response.statusText}`);
        }
        
        const result = await response.json();
        
        return {
            text: result.text,
            duration: result.duration || 0,
            language: result.language || 'pt'
        };
        
    } catch (error) {
        console.error('Erro na transcrição:', error);
        throw error;
    }
}

// Função para análise de sentimentos usando GPT-4o
// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
async function analyzeSentiment(text) {
    const OPENAI_API_KEY = await getOpenAIKey();
    
    if (!OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY não configurada');
    }
    
    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: 'gpt-4o', // Usando GPT-4o para melhor interpretação abstrata como solicitado
                messages: [
                    {
                        role: 'system',
                        content: 'Você é um especialista em análise de sentimentos e padrões emocionais. Analise o texto e forneça insights detalhados sobre o estado emocional, temas principais e padrões de pensamento. Responda em JSON com: {"sentimento": "positivo/neutro/negativo", "confianca": 0.95, "emocoes": ["alegria", "confiança"], "temas": ["trabalho", "relacionamentos"], "insights": "Análise detalhada..."}'
                    },
                    {
                        role: 'user',
                        content: text
                    }
                ],
                response_format: { type: "json_object" }
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Erro API GPT: ${errorData.error?.message || response.statusText}`);
        }
        
        const result = await response.json();
        const analysis = JSON.parse(result.choices[0].message.content);
        
        return analysis;
        
    } catch (error) {
        console.error('Erro na análise:', error);
        throw error;
    }
}

// Função para processar gravação: transcrever + analisar (com Mock + Real)
async function processRecording(audioBlob, useRealAPI = false) {
    try {
        // Mostrar loading
        showProcessingStatus('Transcrevendo áudio...');
        
        let transcription, analysis;
        
        if (useRealAPI) {
            // 1. Usar APIs reais da OpenAI
            transcription = await transcribeAudio(audioBlob);
            showProcessingStatus('Analisando sentimentos...');
            analysis = await analyzeSentiment(transcription.text);
        } else {
            // 1. Mock inteligente - simular processamento real
            await sleep(2000); // Simular tempo de transcrição
            
            transcription = {
                text: generateMockTranscription(),
                duration: Math.round(audioBlob.size / 8000), // Estimativa baseada no tamanho
                language: 'pt'
            };
            
            showProcessingStatus('Analisando sentimentos...');
            await sleep(1500); // Simular tempo de análise
            
            analysis = generateMockAnalysis(transcription.text);
        }
        
        // Limpar status
        hideProcessingStatus();
        
        // 3. Retornar resultado completo
        return {
            transcription: transcription,
            analysis: analysis,
            timestamp: Date.now(),
            type: useRealAPI ? 'real' : 'mock'
        };
        
    } catch (error) {
        hideProcessingStatus();
        throw error;
    }
}

// Função auxiliar para sleep
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Mock inteligente de transcrição - simula pensamento cru
function generateMockTranscription() {
    const mockTexts = [
        "Estou pensando sobre o projeto que estamos desenvolvendo e acho que está tomando uma forma muito interessante. A ideia de transformar a fala em algo maleável, como um processador de pensamento, realmente faz sentido. Às vezes quando falo, organizo melhor as ideias do que quando escrevo.",
        
        "Hoje foi um dia intenso no trabalho. Muitas reuniões, mas sinto que estamos progredindo. Há uma sensação de que estamos construindo algo importante. Preciso lembrar de focar mais no que realmente importa e menos nas pequenas distrações do dia a dia.",
        
        "Tive uma conversa interessante com um amigo sobre tecnologia e futuro. Ele mencionou como a inteligência artificial está mudando tudo. Fiquei pensando sobre como podemos usar essas ferramentas de forma mais humana, mais próxima do nosso jeito natural de pensar e processar informações.",
        
        "Estou refletindo sobre meus objetivos para os próximos meses. Quero me dedicar mais a projetos que tenham significado real. Cansei de trabalhar em coisas que não agregam valor genuíno. A vida é muito curta para desperdiçar tempo com projetos vazios.",
        
        "Observando o comportamento das pessoas hoje, notei como estamos todos sempre conectados mas nem sempre presentes. Será que a tecnologia está nos aproximando ou nos afastando uns dos outros? É uma questão complexa que merece mais reflexão."
    ];
    
    return mockTexts[Math.floor(Math.random() * mockTexts.length)];
}

// Mock inteligente de análise - demonstra insights profundos
function generateMockAnalysis(text) {
    // Analisar o texto mock para gerar análise coerente
    const sentimentWords = {
        positivo: ['interessante', 'progredindo', 'importante', 'significado', 'valor'],
        negativo: ['intenso', 'distrações', 'cansei', 'desperdiçar', 'vazios'],
        neutro: ['pensando', 'reuniões', 'observando', 'reflexão', 'questão']
    };
    
    let sentiment = 'neutro';
    let confidence = 0.7 + Math.random() * 0.25; // 70-95%
    
    // Análise simples baseada em palavras-chave
    const lowerText = text.toLowerCase();
    let positiveCount = 0, negativeCount = 0;
    
    sentimentWords.positivo.forEach(word => {
        if (lowerText.includes(word)) positiveCount++;
    });
    
    sentimentWords.negativo.forEach(word => {
        if (lowerText.includes(word)) negativeCount++;
    });
    
    if (positiveCount > negativeCount) {
        sentiment = 'positivo';
    } else if (negativeCount > positiveCount) {
        sentiment = 'negativo';
    }
    
    // Emoções baseadas no sentimento
    const emotionsBysentiment = {
        positivo: ['otimismo', 'curiosidade', 'satisfação', 'esperança', 'confiança'],
        negativo: ['preocupação', 'frustração', 'cansaço', 'melancolia', 'ansiedade'],
        neutro: ['reflexão', 'contemplação', 'análise', 'observação', 'ponderação']
    };
    
    const emotions = emotionsBysentiment[sentiment].slice(0, 2 + Math.floor(Math.random() * 2));
    
    // Temas baseados no conteúdo
    const themes = [];
    if (lowerText.includes('trabalho') || lowerText.includes('projeto') || lowerText.includes('reuniões')) {
        themes.push('trabalho');
    }
    if (lowerText.includes('tecnologia') || lowerText.includes('inteligência artificial') || lowerText.includes('ferramentas')) {
        themes.push('tecnologia');
    }
    if (lowerText.includes('pessoas') || lowerText.includes('amigo') || lowerText.includes('conversa')) {
        themes.push('relacionamentos');
    }
    if (lowerText.includes('futuro') || lowerText.includes('objetivos') || lowerText.includes('próximos')) {
        themes.push('planejamento');
    }
    if (lowerText.includes('reflexão') || lowerText.includes('pensando') || lowerText.includes('observando')) {
        themes.push('autoconhecimento');
    }
    
    // Insights personalizados baseados no conteúdo
    let insights = "Esta reflexão demonstra um processo de pensamento estruturado e introspectivo. ";
    
    if (sentiment === 'positivo') {
        insights += "Há sinais de otimismo e direcionamento positivo, com foco em crescimento e construção de valor. ";
    } else if (sentiment === 'negativo') {
        insights += "Percebe-se alguns desafios e frustrações, mas também uma busca por soluções e melhorias. ";
    } else {
        insights += "O tom é equilibrado e reflexivo, mostrando uma análise ponderada da situação. ";
    }
    
    if (themes.includes('trabalho')) {
        insights += "O contexto profissional está presente e parece ser uma área de atenção importante. ";
    }
    
    if (themes.includes('autoconhecimento')) {
        insights += "Há evidências de um processo de autoconhecimento e reflexão pessoal em curso.";
    }
    
    return {
        sentimento: sentiment,
        confianca: Math.round(confidence * 100) / 100,
        emocoes: emotions,
        temas: themes.length > 0 ? themes : ['reflexão pessoal'],
        insights: insights.trim()
    };
}

// Função para mostrar status de processamento
function showProcessingStatus(message) {
    // Criar ou atualizar elemento de status
    let statusElement = document.getElementById('processing-status');
    if (!statusElement) {
        statusElement = document.createElement('div');
        statusElement.id = 'processing-status';
        statusElement.className = 'fixed top-4 right-4 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
        document.body.appendChild(statusElement);
    }
    
    statusElement.innerHTML = `
        <div class="flex items-center space-x-2">
            <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            <span>${message}</span>
        </div>
    `;
    statusElement.style.display = 'block';
}

function hideProcessingStatus() {
    const statusElement = document.getElementById('processing-status');
    if (statusElement) {
        statusElement.style.display = 'none';
    }
}

// Função para transcrever gravação específica e mostrar resultados
async function transcribeRecording(recordingId) {
    try {
        // Carregar gravação do IndexedDB
        const recording = await loadRecording(recordingId);
        if (!recording) {
            alert('Gravação não encontrada');
            return;
        }
        
        // Opção para usuário escolher entre Mock ou API Real
        const useReal = confirm('Usar API OpenAI real?\n\nSim = Processar com sua chave API (consome créditos)\nNão = Demonstração com dados simulados (gratuito)');
        
        // Processar gravação
        const result = await processRecording(recording.audioBlob, useReal);
        
        // Salvar transformação na gravação
        await saveTransformation(recordingId, result);
        
        // Mostrar resultados na interface
        showTranscriptionResults(recording, result);
        
    } catch (error) {
        console.error('Erro ao transcrever gravação:', error);
        alert(`Erro ao transcrever: ${error.message}`);
    }
}

// Função para salvar transformação no IndexedDB
async function saveTransformation(recordingId, result) {
    if (!dbConnection) {
        await initializeDB();
    }
    
    return new Promise((resolve, reject) => {
        const transaction = dbConnection.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        
        // Carregar gravação existente
        const getRequest = store.get(recordingId);
        
        getRequest.onsuccess = () => {
            const recording = getRequest.result;
            if (!recording) {
                reject(new Error('Gravação não encontrada'));
                return;
            }
            
            // Adicionar nova transformação
            if (!recording.transformations) {
                recording.transformations = [];
            }
            
            const transformation = {
                id: `transform_${Date.now()}`,
                type: result.type, // 'real' ou 'mock'
                created: Date.now(),
                transcription: result.transcription,
                analysis: result.analysis,
                prompt: 'sistema_padrao' // Preparado para seu prompt customizado
            };
            
            recording.transformations.push(transformation);
            
            // Salvar gravação atualizada
            const putRequest = store.put(recording);
            
            putRequest.onsuccess = () => {
                console.log('Transformação salva:', transformation.id);
                resolve(transformation.id);
            };
            
            putRequest.onerror = () => {
                reject(putRequest.error);
            };
        };
        
        getRequest.onerror = () => {
            reject(getRequest.error);
        };
    });
}

// Função para mostrar resultados da transcrição em modal
function showTranscriptionResults(recording, result) {
    // Criar modal com resultados
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    
    modal.innerHTML = `
        <div class="bg-gray-800 rounded-lg p-6 max-w-4xl max-h-[90vh] overflow-y-auto">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-xl font-bold text-white">Processamento: ${recording.title}</h2>
                <button onclick="this.closest('.fixed').remove()" class="text-gray-400 hover:text-white">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
            </div>
            
            <!-- Abas -->
            <div class="border-b border-gray-700 mb-4">
                <nav class="-mb-px flex space-x-8">
                    <button class="transcription-tab border-b-2 border-green-500 py-2 px-1 text-green-400 font-medium text-sm" onclick="showTranscriptionTab(0)">
                        📝 Transcrição
                    </button>
                    <button class="transcription-tab border-b-2 border-transparent py-2 px-1 text-gray-400 font-medium text-sm hover:text-gray-300" onclick="showTranscriptionTab(1)">
                        🧠 Análise de Sentimentos
                    </button>
                </nav>
            </div>
            
            <!-- Conteúdo das Abas -->
            <div class="transcription-panes">
                <!-- Aba 1: Transcrição -->
                <div class="transcription-pane">
                    <div class="bg-gray-900 rounded p-4 mb-4">
                        <h3 class="text-sm font-medium text-gray-400 mb-2">Texto Transcrito</h3>
                        <p class="text-white leading-relaxed">${result.transcription.text}</p>
                    </div>
                    <div class="grid grid-cols-3 gap-4 text-sm">
                        <div class="bg-gray-900 rounded p-3">
                            <div class="text-gray-400">Duração</div>
                            <div class="text-white font-medium">${Math.round(result.transcription.duration || 0)}s</div>
                        </div>
                        <div class="bg-gray-900 rounded p-3">
                            <div class="text-gray-400">Idioma</div>
                            <div class="text-white font-medium">${result.transcription.language || 'pt'}</div>
                        </div>
                        <div class="bg-gray-900 rounded p-3">
                            <div class="text-gray-400">Palavras</div>
                            <div class="text-white font-medium">${result.transcription.text.split(' ').length}</div>
                        </div>
                    </div>
                </div>
                
                <!-- Aba 2: Análise -->
                <div class="transcription-pane hidden">
                    <div class="grid grid-cols-2 gap-4 mb-4">
                        <div class="bg-gray-900 rounded p-4">
                            <h3 class="text-sm font-medium text-gray-400 mb-2">Sentimento Geral</h3>
                            <div class="flex items-center space-x-2">
                                <span class="text-2xl">${getSentimentEmoji(result.analysis.sentimento)}</span>
                                <span class="text-white font-medium capitalize">${result.analysis.sentimento}</span>
                                <span class="text-gray-400">(${Math.round(result.analysis.confianca * 100)}%)</span>
                            </div>
                        </div>
                        <div class="bg-gray-900 rounded p-4">
                            <h3 class="text-sm font-medium text-gray-400 mb-2">Emoções Detectadas</h3>
                            <div class="flex flex-wrap gap-2">
                                ${result.analysis.emocoes?.map(emocao => 
                                    `<span class="bg-blue-600 text-blue-100 px-2 py-1 rounded text-xs">${emocao}</span>`
                                ).join('') || '<span class="text-gray-500">Nenhuma detectada</span>'}
                            </div>
                        </div>
                    </div>
                    
                    <div class="bg-gray-900 rounded p-4 mb-4">
                        <h3 class="text-sm font-medium text-gray-400 mb-2">Temas Principais</h3>
                        <div class="flex flex-wrap gap-2">
                            ${result.analysis.temas?.map(tema => 
                                `<span class="bg-purple-600 text-purple-100 px-2 py-1 rounded text-xs">${tema}</span>`
                            ).join('') || '<span class="text-gray-500">Nenhum identificado</span>'}
                        </div>
                    </div>
                    
                    <div class="bg-gray-900 rounded p-4">
                        <h3 class="text-sm font-medium text-gray-400 mb-2">Insights Detalhados</h3>
                        <p class="text-white leading-relaxed">${result.analysis.insights || 'Nenhum insight disponível'}</p>
                    </div>
                </div>
            </div>
            
            <!-- Botões de Ação -->
            <div class="flex justify-end space-x-2 mt-6">
                <button onclick="copyTranscription('${result.transcription.text.replace(/'/g, "\\'")}'))" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                    Copiar Transcrição
                </button>
                <button onclick="this.closest('.fixed').remove()" class="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700">
                    Fechar
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// Função para alternar entre abas da transcrição
function showTranscriptionTab(index) {
    const tabs = document.querySelectorAll('.transcription-tab');
    const panes = document.querySelectorAll('.transcription-pane');
    
    tabs.forEach((tab, i) => {
        if (i === index) {
            tab.classList.remove('border-transparent', 'text-gray-400');
            tab.classList.add('border-green-500', 'text-green-400');
        } else {
            tab.classList.remove('border-green-500', 'text-green-400');
            tab.classList.add('border-transparent', 'text-gray-400');
        }
    });
    
    panes.forEach((pane, i) => {
        if (i === index) {
            pane.classList.remove('hidden');
        } else {
            pane.classList.add('hidden');
        }
    });
}

// Função auxiliar para emoji de sentimento
function getSentimentEmoji(sentimento) {
    switch (sentimento?.toLowerCase()) {
        case 'positivo': return '😊';
        case 'negativo': return '😔';
        case 'neutro': return '😐';
        default: return '🤔';
    }
}

// Função para copiar transcrição
function copyTranscription(text) {
    navigator.clipboard.writeText(text).then(() => {
        // Mostrar feedback visual
        const button = event.target;
        const originalText = button.textContent;
        button.textContent = '✓ Copiado!';
        button.classList.add('bg-green-600');
        
        setTimeout(() => {
            button.textContent = originalText;
            button.classList.remove('bg-green-600');
        }, 2000);
    }).catch(err => {
        console.error('Erro ao copiar:', err);
        alert('Erro ao copiar texto');
    });
}

// Função para mostrar histórico de transformações de uma gravação
async function showTransformationHistory(recordingId) {
    try {
        const recording = await loadRecording(recordingId);
        if (!recording || !recording.transformations || recording.transformations.length === 0) {
            alert('Nenhuma transformação encontrada para esta gravação');
            return;
        }
        
        // Criar modal de histórico
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        
        const transformationsList = recording.transformations.map((transformation, index) => `
            <div class="bg-gray-900 rounded p-4 mb-3 cursor-pointer hover:bg-gray-800" onclick="showTranscriptionResults({title: '${recording.title}'}, {transcription: ${JSON.stringify(transformation.transcription).replace(/"/g, '&quot;')}, analysis: ${JSON.stringify(transformation.analysis).replace(/"/g, '&quot;')}, type: '${transformation.type}'})">
                <div class="flex justify-between items-center mb-2">
                    <h4 class="font-medium text-white">Transformação ${index + 1}</h4>
                    <div class="flex items-center space-x-2">
                        <span class="text-xs px-2 py-1 rounded ${transformation.type === 'real' ? 'bg-green-600' : 'bg-blue-600'} text-white">
                            ${transformation.type === 'real' ? 'API Real' : 'Demonstração'}
                        </span>
                        <span class="text-xs text-gray-400">${new Date(transformation.created).toLocaleDateString('pt-BR')}</span>
                    </div>
                </div>
                <p class="text-gray-400 text-sm line-clamp-2">${transformation.transcription.text.substring(0, 100)}...</p>
                <div class="flex items-center mt-2 space-x-4 text-xs text-gray-500">
                    <span>💭 ${transformation.analysis.sentimento}</span>
                    <span>🏷️ ${transformation.analysis.temas.length} temas</span>
                    <span>🎭 ${transformation.analysis.emocoes.length} emoções</span>
                </div>
            </div>
        `).join('');
        
        modal.innerHTML = `
            <div class="bg-gray-800 rounded-lg p-6 max-w-2xl max-h-[80vh] overflow-y-auto">
                <div class="flex justify-between items-center mb-4">
                    <h2 class="text-xl font-bold text-white">Histórico: ${recording.title}</h2>
                    <button onclick="this.closest('.fixed').remove()" class="text-gray-400 hover:text-white">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </button>
                </div>
                
                <div class="mb-4 p-3 bg-blue-900 bg-opacity-50 rounded">
                    <p class="text-blue-200 text-sm">
                        🧠 <strong>Múltiplas Versões:</strong> Esta gravação tem ${recording.transformations.length} transformação(ões). 
                        Clique em qualquer uma para visualizar os insights completos.
                    </p>
                </div>
                
                <div class="space-y-3">
                    ${transformationsList}
                </div>
                
                <div class="flex justify-end mt-6">
                    <button onclick="this.closest('.fixed').remove()" class="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700">
                        Fechar
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
    } catch (error) {
        console.error('Erro ao carregar histórico:', error);
        alert('Erro ao carregar transformações');
    }
}
