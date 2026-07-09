// export function playNotificationSound() {
//     try {
//         const AudioContextClass =
//             window.AudioContext || (window as any).webkitAudioContext;

//         if (!AudioContextClass) return;

//         const audioContext = new AudioContextClass();
//         const oscillator = audioContext.createOscillator();
//         const gainNode = audioContext.createGain();

//         oscillator.type = 'sine';
//         oscillator.frequency.value = 880;

//         gainNode.gain.setValueAtTime(0.08, audioContext.currentTime);
//         gainNode.gain.exponentialRampToValueAtTime(
//             0.001,
//             audioContext.currentTime + 0.25
//         );

//         oscillator.connect(gainNode);
//         gainNode.connect(audioContext.destination);

//         oscillator.start();
//         oscillator.stop(audioContext.currentTime + 0.25);
//     } catch {
//         // Ignore sound errors
//     }
// }
let audio: HTMLAudioElement | null = null;

export function playNotificationSound() {
    try {
        if (!audio) {
            audio = new Audio('/sounds/mixkit-bell-notification-933.wav');
            audio.volume = 1.0;
            audio.preload = 'auto';
            audio.volume = 0.8;
        }

        audio.currentTime = 0;

        audio.play().catch(() => {});
    } catch {
        // Ignore
    }
}