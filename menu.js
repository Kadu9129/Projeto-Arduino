// --- Seleção dos Elementos da Interface (HTML) ---
const connectButton = document.getElementById('connectButton');
const statusBox = document.getElementById('status-box');
const statusText = document.getElementById('status-text');
const controls = document.getElementById('controls');
// NOVOS BOTÕES
const toggleSystemButton = document.getElementById('toggleSystemButton');
const silenceButton = document.getElementById('silenceButton');
const testButton = document.getElementById('testButton');
// HISTÓRICO
const historyTableBody = document.querySelector("#historyTable tbody");
const clearHistoryButton = document.getElementById('clearHistoryButton');

// --- Variáveis de Controle ---
let port;
let writer;
let reader;
let systemIsArmed = true; // Controla o estado do sistema na interface
const encoder = new TextEncoder();
const decoder = new TextDecoder();

// --- Eventos ---
document.addEventListener('DOMContentLoaded', loadHistory);
connectButton.addEventListener('click', handleConnection);
// NOVOS EVENTOS
toggleSystemButton.addEventListener('click', toggleSystem);
silenceButton.addEventListener('click', () => sendCommand('D')); // 'D' = Silenciar
testButton.addEventListener('click', () => sendCommand('T'));    // 'T' = Testar
clearHistoryButton.addEventListener('click', clearHistory);

// --- Funções de Comunicação e Controle ---

async function handleConnection() {
    if (port) {
        await port.close();
        port = null;
        updateStatus('Desconectado', 'status-disconnected');
        connectButton.textContent = 'Conectar ao Arduino';
        controls.classList.add('hidden');
    } else {
        try {
            port = await navigator.serial.requestPort();
            await port.open({ baudRate: 9600 });
            writer = port.writable.getWriter();
            reader = port.readable.getReader();
            
            connectButton.textContent = 'Desconectar';
            controls.classList.remove('hidden');
            // Ao conectar, garante que o Arduino e a Interface estejam sincronizados
            await sendCommand(systemIsArmed ? 'A' : 'S'); 
            readLoop();
        } catch (error) {
            alert(`Erro ao conectar: ${error.message}`);
        }
    }
}

// NOVO: Função para alternar entre Armado e Desarmado (Standby)
async function toggleSystem() {
    systemIsArmed = !systemIsArmed; // Inverte o estado
    await sendCommand(systemIsArmed ? 'A' : 'S'); // Envia 'A' para Armar, 'S' para Standby
}

// NOVO: Função genérica para enviar comandos de um caractere
async function sendCommand(command) {
    if (writer) {
        await writer.write(encoder.encode(command));
    }
}

async function readLoop() {
    let buffer = '';
    while (port) {
        try {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\r\n');
            buffer = lines.pop();
            lines.forEach(line => {
                if (line.trim()) handleSerialMessage(line.trim());
            });
        } catch (error) {
            updateStatus('Erro de Conexão', 'status-disconnected');
            break;
        }
    }
}

function handleSerialMessage(message) {
    console.log(`Recebido: ${message}`);
    switch (message) {
        case 'Invasao':
            updateStatus('INVASÃO DETECTADA!', 'status-invasion');
            logEvent('Invasão');
            break;
        case 'Alarme Silenciado':
            updateStatus('Sistema Armado', 'status-safe'); // Volta ao normal, mas armado
            logEvent('Alarme Silenciado');
            break;
        case 'Sistema Armado':
            systemIsArmed = true;
            updateStatus('Sistema Armado', 'status-safe');
            toggleSystemButton.textContent = 'Desarmar Sistema';
            toggleSystemButton.className = 'armed';
            break;
        case 'Sistema em Espera':
            systemIsArmed = false;
            updateStatus('Sistema em Espera (Desarmado)', 'status-disconnected');
            toggleSystemButton.textContent = 'Armar Sistema';
            toggleSystemButton.className = 'disarmed';
            break;
        case 'Testando sirene...':
            logEvent('Teste de Sirene');
            break;
    }
}

// --- Funções Auxiliares e de Histórico (sem alterações) ---

function updateStatus(text, className) {
    statusText.textContent = text;
    statusBox.className = `status-box ${className}`;
}

function logEvent(eventType) {
    const event = { type: eventType, date: new Date().toLocaleString('pt-BR') };
    const history = JSON.parse(localStorage.getItem('alarmHistory')) || [];
    history.unshift(event);
    localStorage.setItem('alarmHistory', JSON.stringify(history));
    addEventToTable(event);
}

function loadHistory() {
    const history = JSON.parse(localStorage.getItem('alarmHistory')) || [];
    historyTableBody.innerHTML = '';
    history.forEach(event => addEventToTable(event, false));
}

function addEventToTable(event, atTop = true) {
    const row = atTop ? historyTableBody.insertRow(0) : historyTableBody.insertRow();
    row.insertCell(0).textContent = event.type;
    row.insertCell(1).textContent = event.date;
}

function clearHistory() {
    if (confirm('Tem certeza?')) {
        localStorage.removeItem('alarmHistory');
        loadHistory();
    }
}