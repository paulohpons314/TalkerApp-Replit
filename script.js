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

// Elementos para visualização de forma de onda
const waveformCanvas = document.getElementById('waveformCanvas');
const waveformProgress = document.getElementById('waveformProgress');
const waveformCtx = waveformCanvas.getContext('2d');

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
function handleRecordingComplete(audioURL, audioBlob) {
    console.log('=== GRAVAÇÃO COMPLETA ===');
    console.log('Tamanho do arquivo:', audioBlob.size, 'bytes');
    console.log('Tipo MIME:', audioBlob.type);
    console.log('URL para reprodução:', audioURL);
    
    // Criar elemento de áudio e mostrar controles
    createAudioElement(audioURL, audioBlob);
    showAudioControls();
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
    
    const barWidth = canvasWidth / waveformData.length;
    const centerY = canvasHeight / 2;
    const canvasRect = waveformCanvas.getBoundingClientRect();
    const scaleFactor = canvasRect.width / canvasWidth;
    
    // Desenhar cada barra da forma de onda
    waveformData.forEach((amplitude, index) => {
        const barHeight = amplitude * centerY * 0.8; // 80% da altura máxima
        const x = (index * barWidth) * scaleFactor;
        const y = centerY - barHeight / 2;
        
        // Desenhar barra vertical
        waveformCtx.fillRect(x, y, Math.max(1, (barWidth - 1) * scaleFactor), barHeight);
    });
}

// Função para desenhar forma de onda placeholder (quando há erro)
function drawPlaceholderWaveform() {
    waveformCtx.clearRect(0, 0, canvasWidth, canvasHeight);
    
    waveformCtx.fillStyle = '#374151'; // Cinza escuro
    const barWidth = canvasWidth / 50; // 50 barras
    const centerY = canvasHeight / 2;
    
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
    
    console.log(`Seeking para: ${formatAudioTime(newTime)}`);
}

// Função para ajustar tamanho do canvas
function adjustCanvasSize() {
    const rect = waveformCanvas.getBoundingClientRect();
    const devicePixelRatio = window.devicePixelRatio || 1;
    
    // Ajustar resolução do canvas
    canvasWidth = Math.floor(rect.width * devicePixelRatio);
    canvasHeight = Math.floor(rect.height * devicePixelRatio);
    
    waveformCanvas.width = canvasWidth;
    waveformCanvas.height = canvasHeight;
    
    // Ajustar escala do contexto
    waveformCtx.scale(devicePixelRatio, devicePixelRatio);
    
    console.log(`Canvas ajustado: ${canvasWidth}x${canvasHeight}`);
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

// Event listener para seeking na forma de onda (já adicionado, mas verificando se está funcionando)
waveformCanvas.addEventListener('click', handleWaveformClick);

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
