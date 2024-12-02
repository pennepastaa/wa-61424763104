const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const qrcode = require('qrcode-terminal');

const BOT_NUMBER = '61424763104'

module.exports = async function(app) {
    if (app.locals.isConnected) {
        console.log('Already connected to WhatsApp.');
        return;
    }

    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
    });

    app.locals.sock = sock;

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            qrcode.generate(qr, { small: true });
            console.log('Scan the QR code above to log in');
        }
    
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error instanceof Boom &&
                lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut);
            console.log('Connection closed due to ', lastDisconnect.error, ', reconnecting ', shouldReconnect);
            app.locals.isConnected = false;
            if (shouldReconnect) {
                module.exports(app);
            } else {
                console.log('Connection closed. Please check your internet connection and try again.');
            }
        } else if (connection === 'open') {
            console.log('Connection opened');
            app.locals.isConnected = true;
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        
        console.log("======");
        console.log(m);
        
        if (m.message){ 
            const chatThreadId = m.key.remoteJid;
            await sock.sendPresenceUpdate('composing', chatThreadId);
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            const { saveMessageToApiApp } = require('./message_apis');
            const response = await saveMessageToApiApp(m, BOT_NUMBER);
        }
    });

    sock.ev.on('group-participants.update', ({ id, participants, action }) => {
        console.log('Group participants update:', { id, participants, action });
    });
    
    sock.ev.on('message-receipt.update', updates => {
        console.log('Message receipt updates:', updates);
    });
    
    sock.ev.on('messages.reaction', reactions => {
        console.log('Message reactions:', reactions);
    });

    sock.ev.on('creds.update', saveCreds);
};