const instruments = {
    guitar: [
        { string: "6ª", name: "E2", freq: 82.41 },
        { string: "5ª", name: "A2", freq: 110.00 },
        { string: "4ª", name: "D3", freq: 146.83 },
        { string: "3ª", name: "G3", freq: 196.00 },
        { string: "2ª", name: "B3", freq: 246.94 },
        { string: "1ª", name: "E4", freq: 329.63 }
    ],
    bass: [
        { string: "4ª", name: "E1", freq: 41.20 },
        { string: "3ª", name: "A1", freq: 55.00 },
        { string: "2ª", name: "D2", freq: 73.42 },
        { string: "1ª", name: "G2", freq: 98.00 }
    ],
    banjo: [
        { string: "5ª", name: "G4", freq: 392.00 },
        { string: "4ª", name: "D3", freq: 146.83 },
        { string: "3ª", name: "G3", freq: 196.00 },
        { string: "2ª", name: "B3", freq: 246.94 },
        { string: "1ª", name: "D4", freq: 293.66 }
    ]
};

let currentInstrument = 'guitar';
let audioContext, analyser, dataArray;
let isListening = false;
const noteStrings = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function autoCorrelate(buf, sampleRate) {
    let SIZE = buf.length;
    let rms = 0;
    for (let i = 0; i < SIZE; i++) rms += buf[i] * buf[i];
    rms = Math.sqrt(rms / SIZE);
    if (rms < 0.01) return -1; // Señal muy débil

    let r1 = 0, r2 = SIZE - 1, thres = 0.2;
    for (let i = 0; i < SIZE / 2; i++) if (Math.abs(buf[i]) < thres) { r1 = i; break; }
    for (let i = 1; i < SIZE / 2; i++) if (Math.abs(buf[SIZE - i]) < thres) { r2 = SIZE - i; break; }
    buf = buf.slice(r1, r2);
    SIZE = buf.length;

    let c = new Array(SIZE).fill(0);
    for (let i = 0; i < SIZE; i++) {
        for (let j = 0; j < SIZE - i; j++) {
            c[i] = c[i] + buf[j] * buf[j + i];
        }
    }

    let d = 0;
    while (c[d] > c[d + 1]) d++;
    let maxval = -1, maxpos = -1;
    for (let i = d; i < SIZE; i++) {
        if (c[i] > maxval) {
            maxval = c[i];
            maxpos = i;
        }
    }
    let T0 = maxpos;
    return sampleRate / T0;
}

function updatePitch() {
    if (!isListening) return;

    analyser.getFloatTimeDomainData(dataArray);
    const freq = autoCorrelate(dataArray, audioContext.sampleRate);

    // Rango extendido para detectar frecuencias graves de bajos (desde 30 Hz)
    if (freq !== -1 && freq > 30 && freq < 1000) {
        const noteNum = 12 * (Math.log(freq / 440) / Math.log(2));
        const n = Math.round(noteNum) + 69;
        const noteName = noteStrings[n % 12];
        const cents = Math.floor(100 * (noteNum - Math.round(noteNum)));

        document.getElementById('note').textContent = noteName;
        document.getElementById('frequency').textContent = freq.toFixed(1) + " Hz";
        
        // Centrar la aguja: -50 cents es 0%, 0 cents es 50%, 50 cents es 100%
        let move = 50 + (cents); 
        document.getElementById('needle').style.left = move + "%";
    }
    requestAnimationFrame(updatePitch);
}

async function startMicrophone() {
    const button = document.getElementById('micButton');
    const status = document.getElementById('status');

    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const source = audioContext.createMediaStreamSource(stream);
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 4096; // Tamaño aumentado para mejor resolución en frecuencias bajas/graves (bajos)
        dataArray = new Float32Array(analyser.fftSize);
        source.connect(analyser);
        
        isListening = true;
        button.textContent = "🎤 Escuchando...";
        button.style.background = "#00ccaa";
        
        let instrumentName = 'Guitarra';
        if (currentInstrument === 'bass') instrumentName = 'Bajo';
        if (currentInstrument === 'banjo') instrumentName = 'Banjo';
        
        status.textContent = "Toca una cuerda de tu " + instrumentName;
        
        if (audioContext.state === 'suspended') {
            await audioContext.resume();
        }
        updatePitch();
    } catch (err) {
        status.textContent = "Error: Acceso al micro denegado.";
        status.style.color = "#ff6666";
    }
}

function renderStrings() {
    const container = document.getElementById('strings');
    container.innerHTML = '';
    instruments[currentInstrument].forEach(str => {
        const div = document.createElement('div');
        div.className = 'string';
        div.innerHTML = `
            <div class="string-name">${str.string}</div>
            <div class="string-note">${str.name.replace(/\d/, '')}</div>
            <small style="color:#888;">${str.freq} Hz</small>
        `;
        container.appendChild(div);
    });
}

document.querySelectorAll('.btn-instrument').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.btn-instrument').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentInstrument = btn.dataset.instrument;
        renderStrings();
    });
});

document.getElementById('micButton').addEventListener('click', startMicrophone);

window.onload = () => {
    renderStrings();
};
