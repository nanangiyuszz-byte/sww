const { default: makeWASocket, useMultiFileAuthState, delay } = require("@whiskeysockets/baileys");
const cron = require("node-cron");
const pino = require("pino");
const fs = require("fs");
const path = require("path");
const readline = require("readline");

// Membuat interface untuk input nomor HP di terminal jika belum disetting
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

async function startBot() {
    // Menyimpan session login di folder 'auth_info_baileys' agar tidak perlu pairing ulang jika restart
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }), // Menyembunyikan log spam sprit pino
        printQRInTerminal: false // Dimatikan karena kita menggunakan sistem Pairing Code
    });

    // SISTEM PAIRING CODE VIA TERMINAL
    if (!sock.authState.creds.registered) {
        console.clear();
        console.log("=================================================");
        console.log("       WHATSAPP AUTOPUSH STATUS PAIRING SYSTEM   ");
        console.log("=================================================");
        
        // SILAKAN GANTI NOMOR DI BAWAH INI DENGAN NOMOR WA KAMU (Gunakan kode negara, contoh: 628xxx)
        // Jika dikosongkan/tetap seperti ini, nanti script akan otomatis bertanya di terminal
        let phoneNumber = "6283109105308"; 

        if (!phoneNumber || phoneNumber.includes("xxxx")) {
            phoneNumber = await question('\n👉 Masukkan nomor WhatsApp kamu (contoh: 628123456789): ');
        }
        
        // Membersihkan karakter non-angka
        phoneNumber = phoneNumber.replace(/[^0-9]/g, '');
        
        // Beri jeda 3 detik agar memastikan socket benar-benar siap menerima request code
        await delay(3000);
        
        try {
            const code = await sock.requestPairingCode(phoneNumber);
            const formattedCode = code.match(/.{1,4}/g)?.join('-');
            console.log(`\n🔑 KODE PAIRING KAMU: ${formattedCode}`);
            console.log("=================================================");
            console.log("Langkah selanjutnya:");
            console.log("1. Buka WhatsApp di HP kamu.");
            console.log("2. Pergi ke Pengaturan / Titik Tiga di kanan atas -> Perangkat Tertaut.");
            console.log("3. Pilih 'Tautkan Perangkat'.");
            console.log("4. Pilih 'Tautkan dengan nomor telepon saja' di bagian bawah layar.");
            console.log(`5. Masukkan kode [ ${formattedCode} ] di atas.`);
            console.log("=================================================\n");
        } catch (error) {
            console.error("❌ Gagal request pairing code, silakan coba jalankan ulang script:", error);
            process.exit(1);
        }
    }

    // Menyimpan kredensial baru setiap kali ada pembaruan status koneksi
    sock.ev.on('creds.update', saveCreds);

    // Memantau status koneksi WhatsApp
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        
        if (connection === 'open') {
            console.clear();
            console.log("=================================================");
            console.log("✅ STATUS: Bot WhatsApp BERHASIL Terhubung!");
            console.log("=================================================");
            console.log("⏳ Bot standby... Menunggu waktu tepat jam 00:00 (tengah malam).");
            console.log("📌 Pastikan laptop tetap menyala/aktif dan internet stabil.");
            console.log("=================================================\n");
            
            if (!rl.closed) rl.close();

            // CRON JOB: Berjalan otomatis tepat pada menit 0, jam 0 (00:00 tengah malam)
            cron.schedule('0 0 * * *', async () => {
                try {
                    // Mendeteksi file video.mp4 yang ada di satu folder dengan script ini
                    const videoPath = path.join(__dirname, 'happy.mp4');
                    
                    // Validasi apakah filenya ada sebelum dikirim
                    if (!fs.existsSync(videoPath)) {
                        console.error(`\n❌ [${new Date().toLocaleTimeString()}] PUSH STATUS GAGAL: File 'video.mp4' tidak ditemukan di folder script!`);
                        return;
                    }

                    console.log(`\n🚀 [00:00] WAKTU NYA! Sedang memproses dan mengunggah video status...`);

                    // Keterangan / Caption Status Ulang Tahun Kamu
                    const statusCaption = "New age = New features. Bug fixes for life, upgrade logic, and keeping the system running. Happy birthday to me! 🚀💻✨ #Level18";

                    // Mengirimkan status ke JID status@broadcast (Fitur Story WhatsApp)
                    await sock.sendMessage('status@broadcast', { 
                        video: fs.readFileSync(videoPath), 
                        caption: statusCaption
                    });

                    console.log("=================================================");
                    console.log("🎉 SUKSES! Video status ulang tahun berhasil terposting!");
                    console.log("=================================================");
                } catch (error) {
                    console.error('❌ Terjadi error saat mencoba mengirim status:', error);
                }
            }, {
                scheduled: true,
                timezone: "Asia/Jakarta" // Mengunci waktu agar tepat mengikuti Waktu Indonesia Barat (WIB)
            });

        } else if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== 401;
            console.log(`🔄 Koneksi terputus. Mengubungkan kembali? -> ${shouldReconnect}`);
            if (shouldReconnect) {
                startBot();
            } else {
                console.log("❌ Sesi login salah atau telah dikeluarkan dari HP. Silakan hapus folder 'auth_info_baileys' dan scan ulang.");
                process.exit(1);
            }
        }
    });
}

// Menjalankan fungsi utama bot
startBot();
