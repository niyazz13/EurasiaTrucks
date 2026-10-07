let audioCtx = null;
let motorOsc = null, motorGain = null;

export function initAudioEngine() {
    if (audioCtx) return;
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioContext();
        motorOsc = audioCtx.createOscillator(); motorGain = audioCtx.createGain();
        motorOsc.type = 'sawtooth'; motorOsc.frequency.setValueAtTime(35, audioCtx.currentTime);
        motorGain.gain.setValueAtTime(0.0, audioCtx.currentTime);
        const filter = audioCtx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.setValueAtTime(120, audioCtx.currentTime);
        motorOsc.connect(filter); filter.connect(motorGain); motorGain.connect(audioCtx.destination);
        motorOsc.start();
    } catch(e) { console.error("Web Audio API заблокирован браузером."); }
}

export function updateMotorSound(speed) {
    if (!audioCtx || !motorOsc || audioCtx.state === 'suspended') return;
    const absSpeed = Math.abs(speed);
    motorOsc.frequency.setTargetAtTime(35 + (absSpeed * 45), audioCtx.currentTime, 0.1);
    motorGain.gain.setTargetAtTime(absSpeed > 0.05 ? 0.08 : 0.02, audioCtx.currentTime, 0.1);
}

export function playBrakeSqueal() {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
    osc.type = 'triangle'; osc.frequency.setValueAtTime(2500, audioCtx.currentTime); gain.gain.setValueAtTime(0.02, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
    osc.connect(gain); gain.connect(audioCtx.destination); osc.start(); osc.stop(audioCtx.currentTime + 0.3);
}

export function playTrafficHorn() {
    if (!audioCtx || Math.random() > 0.3) return;
    const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
    osc.type = 'sine'; osc.frequency.setValueAtTime(440, audioCtx.currentTime); gain.gain.setValueAtTime(0.03, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
    osc.connect(gain); gain.connect(audioCtx.destination); osc.start(); osc.stop(audioCtx.currentTime + 0.4);
}
