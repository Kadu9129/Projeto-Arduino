const botaoConectar = document.getElementById('botaoConectar');
const caixaStatus = document.getElementById('caixa-status');
const textoStatus = document.getElementById('texto-status');
const controles = document.getElementById('controles');
const botaoAlternarSistema = document.getElementById('botaoAlternarSistema');
const botaoSilenciar = document.getElementById('botaoSilenciar');
const botaoTeste = document.getElementById('botaoTeste');
const tabelaHistorico = document.querySelector("#tabelaHistorico tbody");
const botaoLimparHistorico = document.getElementById('botaoLimparHistorico');

let porta, escritor, leitor;
let sistemaArmado = true;
const codificador = new TextEncoder();
const decodificador = new TextDecoder();

document.addEventListener('DOMContentLoaded', carregarHistorico);
botaoConectar.addEventListener('click', conectarArduino);
botaoAlternarSistema.addEventListener('click', alternarSistema);
botaoSilenciar.addEventListener('click', () => enviarComando('D'));
botaoTeste.addEventListener('click', () => enviarComando('T'));
botaoLimparHistorico.addEventListener('click', limparHistorico);

async function conectarArduino() {
    if (porta) {
        await porta.close();
        porta = null;
        atualizarStatus('Desconectado', 'status-desconectado');
        botaoConectar.textContent = 'Conectar ao Arduino';
        controles.classList.add('hidden');
    } else {
        try {
            porta = await navigator.serial.requestPort();
            await porta.open({ baudRate: 9600 });
            escritor = porta.writable.getWriter();
            leitor = porta.readable.getReader();

            botaoConectar.textContent = 'Desconectar';
            controles.classList.remove('hidden');
            await enviarComando(sistemaArmado ? 'A' : 'S');
            lerDados();
        } catch (erro) {
            alert(`Erro ao conectar: ${erro.message}`);
        }
    }
}

async function alternarSistema() {
    sistemaArmado = !sistemaArmado;
    await enviarComando(sistemaArmado ? 'A' : 'S');
}

async function enviarComando(comando) {
    if (escritor) {
        await escritor.write(codificador.encode(comando));
    }
}

async function lerDados() {
    let buffer = '';
    while (porta) {
        try {
            const { value, done } = await leitor.read();
            if (done) break;
            buffer += decodificador.decode(value, { stream: true });
            const linhas = buffer.split('\r\n');
            buffer = linhas.pop();
            linhas.forEach(linha => {
                if (linha.trim()) tratarMensagemSerial(linha.trim());
            });
        } catch (erro) {
            atualizarStatus('Erro de conexão', 'status-desconectado');
            break;
        }
    }
}

function tratarMensagemSerial(mensagem) {
    switch (mensagem) {
        case 'Invasao':
            atualizarStatus('INVASÃO DETECTADA!', 'status-invasao');
            registrarEvento('Invasão');
            break;
        case 'Alarme Silenciado':
            atualizarStatus('Sistema Armado', 'status-armado');
            registrarEvento('Alarme Silenciado');
            break;
        case 'Sistema Armado':
            sistemaArmado = true;
            atualizarStatus('Sistema Armado', 'status-armado');
            botaoAlternarSistema.textContent = 'Desarmar Sistema';
            break;
        case 'Sistema em Espera':
            sistemaArmado = false;
            atualizarStatus('Sistema Desarmado', 'status-desconectado');
            botaoAlternarSistema.textContent = 'Armar Sistema';
            break;
        case 'Testando sirene...':
            registrarEvento('Teste de Sirene');
            break;
    }
}

function atualizarStatus(texto, classe) {
    textoStatus.textContent = texto;
    caixaStatus.className = `status-box ${classe}`;
}

function registrarEvento(tipo) {
    const evento = { tipo, data: new Date().toLocaleString('pt-BR') };
    const historico = JSON.parse(localStorage.getItem('historicoAlarme')) || [];
    historico.unshift(evento);
    localStorage.setItem('historicoAlarme', JSON.stringify(historico));
    adicionarNaTabela(evento);
}

function carregarHistorico() {
    const historico = JSON.parse(localStorage.getItem('historicoAlarme')) || [];
    tabelaHistorico.innerHTML = '';
    historico.forEach(ev => adicionarNaTabela(ev, false));
}

function adicionarNaTabela(evento, noTopo = true) {
    const linha = noTopo ? tabelaHistorico.insertRow(0) : tabelaHistorico.insertRow();
    linha.insertCell(0).textContent = evento.tipo;
    linha.insertCell(1).textContent = evento.data;
}

function limparHistorico() {
    if (confirm('Tem certeza que deseja limpar?')) {
        localStorage.removeItem('historicoAlarme');
        carregarHistorico();
    }
}
