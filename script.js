const talkerApp = document.getElementById('talkerApp');
const commandTower = document.getElementById('commandTower');
const contentWindow = document.getElementById('contentWindow');
const startRecordingBtn = document.getElementById('startRecordingBtn');
const newTransformationBtn = document.getElementById('newTransformationBtn');
const tabsNav = document.getElementById('tabs-nav');
const tabsContent = document.getElementById('tabs-content');
const promptStatus = document.getElementById('promptStatus');
const statusText = document.getElementById('statusText');

let isMainRecording = false;
let isPromptRecording = false;

// Variáveis para controle de gravação de áudio
let mediaRecorder = null;
let audioStream = null;
let audioChunks = [];

// Função para iniciar a gravação de áudio
async function startAudioRecording() {
    try {
        // Solicitar permissão para aceder ao microfone
        audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        // Configurar o MediaRecorder
        mediaRecorder = new MediaRecorder(audioStream);
        audioChunks = [];
        
        // Event listeners para o MediaRecorder
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };
        
        mediaRecorder.onstop = () => {
            console.log('Gravação de áudio parada');
            // Por enquanto não vamos guardar o áudio, apenas limpar os chunks
            audioChunks = [];
        };
        
        // Iniciar a gravação
        mediaRecorder.start();
        console.log('Gravação de áudio iniciada');
        
        return true;
    } catch (error) {
        console.error('Erro ao aceder ao microfone:', error);
        alert('Erro ao aceder ao microfone. Verifique as permissões do navegador.');
        return false;
    }
}

// Função para parar a gravação de áudio
function stopAudioRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        console.log('A parar gravação de áudio...');
    }
    
    if (audioStream) {
        // Parar todas as faixas do stream para libertar o microfone
        audioStream.getTracks().forEach(track => track.stop());
        audioStream = null;
    }
}

startRecordingBtn.addEventListener('click', async () => {
    // Se estamos a começar a gravar
    if (!isMainRecording) {
        const recordingStarted = await startAudioRecording();
        
        // Só atualizar o estado visual se a gravação foi iniciada com sucesso
        if (recordingStarted) {
            isMainRecording = true;
            commandTower.classList.add('is-recording');
            startRecordingBtn.classList.add('bg-red-500', 'text-white', 'border-white');
            
            // Colapsar a interface para modo de gravação
            talkerApp.style.width = '160px';
            contentWindow.classList.add('hidden');
            contentWindow.classList.remove('flex');
        }
    } else {
        // Parar a gravação
        stopAudioRecording();
        
        isMainRecording = false;
        commandTower.classList.remove('is-recording');
        startRecordingBtn.classList.remove('bg-red-500', 'text-white', 'border-white');
        
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
