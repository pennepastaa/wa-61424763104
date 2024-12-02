const express = require('express');
const whatsappRoutes = require('./routes/whatsapp');
const setupWhatsAppConnection = require('./whatsappConnection');

const app = express();
// const PORT = process.env.PORT || 3000;
const PORT = 5000;

app.use(express.json());

// Initialize app.locals to store shared variables
app.locals.sock = null;
app.locals.isConnected = false;

setupWhatsAppConnection(app);

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

// Use WhatsApp Routes
app.use('/whatsapp', whatsappRoutes);