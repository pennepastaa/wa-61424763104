// messaging funcs go here
A1BASE_KEY = 'g231hk21782LgeFAqfda3'
module.exports.saveMessageToApiApp = async function(m, bot_number) {
    // Remove the messages[0] access since m is already the message object
    // const msg = m;
    // if (!msg.message) return;
    
    const messageType = Object.keys(m.message)[0];
    let messageContent = '';

    switch(messageType) {
        case 'conversation':
            messageContent = m.message.conversation;
            break;
        case 'extendedTextMessage':
            messageContent = m.message.extendedTextMessage.text;
            break;
        case 'imageMessage':
            messageContent = '[Image]';
            break;
        case 'videoMessage':
            messageContent = '[Video]';
            break;
        case 'audioMessage':
            messageContent = '[Audio]';
            break;
        // Add more cases as needed
        default:
            messageContent = '[Unsupported Message Type]';
    }

    
    console.log(`content: ${messageContent}`)

    let chat_type = '';
    let service_user_id = '';
    let sender_number = '';
    let sender_name = m.pushName || bot_number;
    let participants = [];
    participants.push(bot_number)
    if (m.key.remoteJid.includes('@g.us')) {
        chat_type = 'group';
        service_user_id = m.key.participant; 
        sender_number = m.key.participant?.split('@')[0]; 
    } else if (m.key.remoteJid.includes('@s.whatsapp.net')) {
        chat_type = 'individual';
        sender_number = m.fromMe ? bot_number : m.key.remoteJid.split('@')[0];
    } else if (m.broadcast) {
        chat_type = 'broadcast';
        service_user_id = 'broadcast';
    }
    if (!participants.includes(sender_number)) {
        participants.push(sender_number);
    }
    body = {
        // auth_id: m.auth_id,
        external_thread_id: m.key.remoteJid,
        external_message_id: m.key.id,
        chat_type: chat_type,
        content: messageContent,
        sender_name: sender_name,
        sender_number: sender_number,
        participants: participants,
        a1_account_number: bot_number,
        secret_key: A1BASE_KEY,

        // updated_at: Date.now(),

    }
    const response = await fetch('http://127.0.0.1:8000/v1/wa/whatsapp/incoming', {
    // const response = await fetch('https://a1base-main.fly.dev/v1/wa/whatsapp/incoming', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body)
    });

    return await response.json();
}