const express = require('express');
const router = express.Router();
const { saveMessageToApiApp } = require('../message_apis');

// Middleware to validate secret_key
function validateSecretKey(req, res, next) {
    const { secret_key } = req.body;
    if (secret_key !== 'ZMBPqLBaCetcv1f5dViDo') {
        return res.status(403).json({ success: false, error: 'Invalid secret key' });
    }
    next();
}

const BOT_NUMBER = '61424763104'
// Send Individual Message
router.post(`/send-individual/${BOT_NUMBER}`, async (req, res) => {
    const { chat_thread_id, content, callback_url } = req.body;
    console.log('-------');
    console.log('/whatsapp/send-individual');

    try {
        if (!req.app.locals.sock.user || !req.app.locals.isConnected) {
            throw new Error('WhatsApp connection not ready');
        }

        await new Promise(resolve => setTimeout(resolve, 1000));

        const messageContent = { text: content };
        const sendOptions = { quoted: null, mediaType: 'text' };

        let response;
        let retryCount = 0;
        const maxRetries = 3;

        while (retryCount < maxRetries) {
            try {
                response = await req.app.locals.sock.sendMessage(chat_thread_id, messageContent, sendOptions);
                console.log('Message sent successfully:', JSON.stringify(response, null, 2));

                const messageAcknowledged = await new Promise((resolve) => {
                    const timeout = setTimeout(() => {
                        console.log('Acknowledgment timeout reached');
                        resolve(false);
                    }, 10000);

                    const checkInterval = setInterval(() => {
                        if (response && response.key && response.status >= 1) {
                            clearTimeout(timeout);
                            clearInterval(checkInterval);
                            console.log('Message acknowledged');
                            resolve(true);
                        }
                    }, 1000);
                });

                if (messageAcknowledged) {
                    break;
                }

                throw new Error('Message not acknowledged');

            } catch (error) {
                console.error(`Attempt ${retryCount + 1} failed:`, error);
                retryCount++;

                if (['not-authorized', 'participant not in group', 'connection closed'].some(msg => error.message.includes(msg))) {
                    throw error;
                }

                if (retryCount === maxRetries) throw error;

                await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)));
            }
        }

        console.log('SEND SUCCESS');

        res.json({ 
            success: true, 
            messageId: response.key.id,
            details: {
                jid: chat_thread_id,
                timestamp: response.messageTimestamp
            }
        });

    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message,
            stack: error.stack
        });
    }
});

// Send Group Message
router.post(`/send-group/${BOT_NUMBER}`, validateSecretKey, async (req, res) => {
    const { chat_thread_id, content, callback_url } = req.body;
    console.log('-------');
    console.log('/whatsapp/send-group');

    try {
        if (!req.app.locals.sock.user || !req.app.locals.isConnected) {
            throw new Error('WhatsApp connection not ready');
        }

        const isGroup = chat_thread_id.endsWith('@g.us');
        await new Promise(resolve => setTimeout(resolve, 1000));

        const messageContent = { text: content };
        const sendOptions = isGroup ? {
            quoted: null,
            ephemeralExpiration: 0,
        } : undefined;

        let response;
        let retryCount = 0;
        const maxRetries = 3;

        while (retryCount < maxRetries) {
            try {
                response = await req.app.locals.sock.sendMessage(chat_thread_id, messageContent, sendOptions);

                await new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => {
                        req.app.locals.sock.ev.off('messages.update', messageUpdateHandler);
                        req.app.locals.sock.ev.off('message-receipt.update', receiptHandler);
                        reject(new Error('Message acknowledgment timeout'));
                    }, 10000);

                    const messageUpdateHandler = async (updates) => {
                        const relevantUpdate = updates.find(update => 
                            update.key.id === response.key.id && update.status >= 1
                        );
                        
                        if (relevantUpdate) {
                            clearTimeout(timeout);
                            req.app.locals.sock.ev.off('messages.update', messageUpdateHandler);
                            req.app.locals.sock.ev.off('message-receipt.update', receiptHandler);
                            resolve();
                        }
                    };

                    const receiptHandler = async (updates) => {
                        const relevantReceipt = updates.find(update => 
                            update.key.id === response.key.id
                        );
                        
                        if (relevantReceipt) {
                            clearTimeout(timeout);
                            req.app.locals.sock.ev.off('messages.update', messageUpdateHandler);
                            req.app.locals.sock.ev.off('message-receipt.update', receiptHandler);
                            resolve();
                        }
                    };

                    req.app.locals.sock.ev.on('messages.update', messageUpdateHandler);
                    req.app.locals.sock.ev.on('message-receipt.update', receiptHandler);
                });

                break;
            } catch (error) {
                console.error(`Attempt ${retryCount + 1} failed:`, error);
                retryCount++;
                if (retryCount === maxRetries) throw error;
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        console.log('SEND SUCCESS');
        console.log(JSON.stringify(response, null, 2));

        res.json({ 
            success: true, 
            messageId: response.key.id,
            details: {
                isGroup,
                jid: chat_thread_id,
                timestamp: response.messageTimestamp
            }
        });

    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message,
            stack: error.stack
        });
    }
});


module.exports = router;
