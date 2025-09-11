const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security and middleware
app.use(helmet());
app.use(compression());

// CORS configuration
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      process.env.FRONTEND_URL || 'https://your-app.netlify.app',
      'http://localhost:5173',
      'http://localhost:3000',
      'http://localhost:5000'
    ];
    
    if (allowedOrigins.includes(origin) || origin.endsWith('.netlify.app')) {
      return callback(null, true);
    }
    
    console.warn('🚫 CORS blocked origin:', origin);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Simple checkout endpoint
app.post('/api/checkout', async (req, res) => {
  try {
    console.log('🚀 Checkout request:', req.body);
    
    if (!process.env.ABACATEPAY_API_KEY) {
      return res.status(500).json({ 
        error: 'API key não configurada' 
      });
    }

    const { name, email, phone, taxId } = req.body;
    
    if (!name || !email || !phone || !taxId) {
      return res.status(400).json({ 
        error: 'Dados obrigatórios: name, email, phone, taxId' 
      });
    }

    // Create PIX with AbacatePay
    const pixPayload = {
      amount: 990, // R$ 9,90 em centavos
      expiresIn: 86400, // 24 horas
      description: "Confeitaria Lucrativa - Curso Completo",
      customer: { name, cellphone: phone, email, taxId }
    };

    console.log('📤 Criando PIX...');
    
    const response = await fetch('https://api.abacatepay.com/v1/pixQrCode/create', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.ABACATEPAY_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(pixPayload)
    });

    const pixResponse = await response.json();
    console.log('📥 PIX Response:', pixResponse);

    if (pixResponse.error) {
      return res.status(400).json({ 
        error: 'Erro ao criar PIX',
        details: pixResponse.error 
      });
    }

    const pixData = pixResponse.data;
    
    const result = {
      pixId: pixData.id,
      pixCode: pixData.brCode,
      qrCodeUrl: pixData.brCodeBase64,
      amount: pixData.amount,
      expiresAt: pixData.expiresAt
    };

    console.log('✅ PIX criado com sucesso');
    res.json(result);

  } catch (error) {
    console.error('❌ Erro:', error);
    res.status(500).json({ 
      error: 'Erro interno',
      details: error.message 
    });
  }
});

// Check payment status
app.get('/api/payment/check/:pixId', async (req, res) => {
  try {
    const { pixId } = req.params;
    console.log('🔄 Verificando pagamento:', pixId);

    const response = await fetch(`https://api.abacatepay.com/v1/pixQrCode/check?id=${pixId}`, {
      headers: {
        'Authorization': `Bearer ${process.env.ABACATEPAY_API_KEY}`
      }
    });

    const checkResponse = await response.json();
    
    if (checkResponse.error) {
      return res.status(400).json({ 
        error: 'Erro ao verificar pagamento',
        details: checkResponse.error 
      });
    }

    const paymentData = checkResponse.data;
    
    res.json({
      status: paymentData.status,
      expiresAt: paymentData.expiresAt,
      isPaid: paymentData.status === "PAID"
    });

  } catch (error) {
    console.error('❌ Erro ao verificar:', error);
    res.status(500).json({ 
      error: 'Erro interno',
      details: error.message 
    });
  }
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Rota não encontrada',
    path: req.originalUrl
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`🔑 AbacatePay: ${process.env.ABACATEPAY_API_KEY ? 'Configurado' : 'Não configurado'}`);
});
