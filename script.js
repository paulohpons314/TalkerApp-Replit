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

let isMainRecording = false;
let isPromptRecording = false;

// Variáveis globais para controle de gravação de áudio
let mediaStream;
let mediaRecorder;

// Variáveis para timer de gravação
let recordingStartTime;
let recordingInterval;

// Variáveis para análise de volume e animação
let audioContext;
let analyser;
let dataArray;
let animationFrame;

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
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    
    const source = audioContext.createMediaStreamSource(mediaStream);
    source.connect(analyser);
    
    dataArray = new Uint8Array(analyser.frequencyBinCount);
    startVolumeAnimation();
}

// Função para animação baseada no volume
function startVolumeAnimation() {
    function animate() {
        if (!isMainRecording) return;
        
        analyser.getByteFrequencyData(dataArray);
        
        // Calcular volume médio
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        const normalizedVolume = Math.min(average / 50, 1); // Normalizar entre 0 e 1
        
        // Aplicar efeito luminoso verde reativo ao volume (estilo contador de decibéis) na torre
        const glowIntensity = normalizedVolume * 0.3; // Intensidade mais sutil para a torre
        
        if (normalizedVolume > 0.05) {
            towerVolumeGlow.style.background = `
                linear-gradient(45deg, 
                    rgba(110, 231, 183, ${glowIntensity}) 0%, 
                    rgba(34, 197, 94, ${glowIntensity * 0.7}) 50%, 
                    rgba(22, 163, 74, ${glowIntensity * 0.5}) 100%)
            `;
        } else {
            towerVolumeGlow.style.background = '';
        }
        
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
    if (audioContext) {
        audioContext.close();
        audioContext = null;
    }
    
    // Resetar estilos dos elementos visuais
    towerVolumeGlow.style.background = '';
    towerVolumeGlow.classList.add('hidden');
    recordingBorder.classList.add('hidden');
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
            mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(mediaStream);
            mediaRecorder.start();
            
            // Ativar efeitos visuais da gravação
            recordingBorder.classList.remove('hidden'); // Mostrar borda girando
            towerVolumeGlow.classList.remove('hidden'); // Mostrar efeito luminoso na torre
            
            // Iniciar o timer
            startRecordingTimer();
            
            // Iniciar análise de volume e animação
            setupVolumeAnalysis();
            
            console.log('Gravação iniciada');
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
