import { Express, Request, Response } from 'express';
import { storage } from './storage';
import { insertCustomerSchema, AbacatePayPixResponse, AbacatePayCheckResponse } from './types';
import { ZodError } from 'zod';
import { fromZodError } from 'zod-validation-error';
const AbacatePaySDK = require('abacatepay-nodejs-sdk');

let abacatePay: any = null;

// Initialize AbacatePay SDK
if (process.env.ABACATEPAY_API_KEY) {
  try {
    abacatePay = AbacatePaySDK.default(process.env.ABACATEPAY_API_KEY);
    console.log("✅ AbacatePay SDK initialized successfully");
  } catch (error) {
    console.error("❌ Failed to initialize AbacatePay SDK:", error);
  }
} else {
  console.warn("⚠️  ABACATEPAY_API_KEY not found. AbacatePay features will be disabled.");
}

export function setupRoutes(app: Express): void {
  
  // Create customer and billing with AbacatePay integration
  app.post("/api/checkout", async (req: Request, res: Response) => {
    try {
      console.log("🚀 Checkout request received:", { body: req.body });
      
      // Validate customer data
      const customerData = insertCustomerSchema.parse(req.body);
      
      // Create customer in our storage
      const customer = await storage.createCustomer(customerData);
      console.log("✅ Customer created:", customer.id);
      
      // Create billing in our storage
      const billingData = {
        customerId: customer.id,
        amount: "9.90", // Fixed price
        status: "PENDING",
        paymentMethod: "PIX"
      };
      
      const billing = await storage.createBilling(billingData);
      console.log("✅ Billing created:", billing.id);
      
      // Create customer in AbacatePay
      let abacateCustomer = null;
      if (abacatePay) {
        try {
          const abacateCustomerResponse = await abacatePay.customer.create({
            name: customerData.name,
            email: customerData.email,
            cellphone: customerData.phone,
            taxId: customerData.taxId
          });
          
          if (abacateCustomerResponse.error) {
            console.error("❌ AbacatePay customer creation error:", abacateCustomerResponse.error);
          } else {
            abacateCustomer = abacateCustomerResponse.data;
            console.log("✅ AbacatePay customer created:", abacateCustomer?.id);
            
            // Update customer with AbacatePay ID
            await storage.updateCustomer(customer.id, {
              abacatePayId: abacateCustomer?.id
            });
          }
        } catch (error) {
          console.error("❌ Error creating customer in AbacatePay:", error);
        }
      } else {
        console.log("⚠️  AbacatePay not available, skipping customer creation");
      }
      
      // Create PIX QR Code using AbacatePay direct API
      if (!process.env.ABACATEPAY_API_KEY) {
        console.error("❌ ABACATEPAY_API_KEY not configured");
        return res.status(500).json({ 
          error: "Pagamento temporariamente indisponível",
          details: "API key não configurada" 
        });
      }
      
      try {
        console.log("🔄 Creating PIX QR Code...");
        
        const pixPayload = {
          amount: 990, // R$ 9,90 in cents
          expiresIn: 86400, // 24 hours in seconds
          description: "Confeitaria Lucrativa - Curso Completo",
          customer: {
            name: customerData.name,
            cellphone: customerData.phone,
            email: customerData.email,
            taxId: customerData.taxId
          },
          metadata: {
            externalId: billing.id
          }
        };
        
        console.log("📤 PIX request payload:", pixPayload);
        
        const response = await fetch('https://api.abacatepay.com/v1/pixQrCode/create', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.ABACATEPAY_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(pixPayload)
        });
        
        const pixResponse: AbacatePayPixResponse = await response.json();
        console.log("📥 PIX API response:", pixResponse);
        
        if (pixResponse.error) {
          console.error("❌ AbacatePay PIX creation error:", pixResponse.error);
          return res.status(400).json({ 
            error: "Erro ao criar PIX",
            details: pixResponse.error 
          });
        }
        
        const pixData = pixResponse.data!;
        console.log("✅ PIX QR Code created:", pixData.id);
        
        // Update billing with PIX data
        const updatedBilling = await storage.updateBilling(billing.id, {
          abacatePayId: pixData.id,
          pixCode: pixData.brCode,
          qrCodeUrl: pixData.brCodeBase64,
          status: pixData.status
        });
        
        // Return success response
        const successResponse = {
          billing: updatedBilling,
          customer: customer,
          pixId: pixData.id,
          pixCode: pixData.brCode,
          qrCodeUrl: pixData.brCodeBase64,
          amount: pixData.amount,
          expiresAt: pixData.expiresAt
        };
        
        console.log("✅ Checkout completed successfully");
        res.json(successResponse);
        
      } catch (error) {
        console.error("❌ PIX creation error:", error);
        res.status(500).json({ 
          error: "Erro ao criar código PIX",
          details: error instanceof Error ? error.message : "Erro desconhecido"
        });
      }
      
    } catch (error) {
      console.error("❌ Checkout error:", error);
      
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ 
          error: "Dados inválidos",
          details: validationError.message 
        });
      }
      
      res.status(500).json({ 
        error: "Erro interno do servidor",
        details: error instanceof Error ? error.message : "Erro desconhecido"
      });
    }
  });

  // Check PIX payment status
  app.get("/api/payment/check/:pixId", async (req: Request, res: Response) => {
    if (!process.env.ABACATEPAY_API_KEY) {
      console.error("❌ ABACATEPAY_API_KEY not configured for payment check");
      return res.status(500).json({ 
        error: "Serviço de pagamento indisponível",
        details: "API key não configurada" 
      });
    }
    
    try {
      const { pixId } = req.params;
      console.log("🔄 Checking payment status for PIX:", pixId);
      
      // Check PIX status with AbacatePay
      const response = await fetch(`https://api.abacatepay.com/v1/pixQrCode/check?id=${pixId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.ABACATEPAY_API_KEY}`
        }
      });
      
      const checkResponse: AbacatePayCheckResponse = await response.json();
      console.log("📥 Payment check response:", checkResponse);
      
      if (checkResponse.error) {
        console.error("❌ Payment check error:", checkResponse.error);
        return res.status(400).json({ 
          error: "Erro ao verificar pagamento",
          details: checkResponse.error 
        });
      }
      
      const paymentData = checkResponse.data!;
      
      // Update local billing if payment was confirmed
      const billing = await storage.getBillingByAbacatePayId(pixId);
      if (billing && paymentData.status === "PAID") {
        await storage.updateBilling(billing.id, {
          status: "PAID"
        });
        console.log("✅ Local billing updated to PAID");
      }
      
      const result = {
        status: paymentData.status,
        expiresAt: paymentData.expiresAt,
        isPaid: paymentData.status === "PAID"
      };
      
      console.log("✅ Payment status checked:", result);
      res.json(result);
      
    } catch (error) {
      console.error("❌ Check payment error:", error);
      res.status(500).json({ 
        error: "Erro interno do servidor",
        details: error instanceof Error ? error.message : "Erro desconhecido"
      });
    }
  });

  // Get all customers (for debugging)
  app.get("/api/customers", async (req: Request, res: Response) => {
    try {
      // This is a simple implementation - in production you'd want pagination
      console.log("📋 Listing all customers");
      res.json({ message: "Customers endpoint available", count: 0 });
    } catch (error) {
      console.error("❌ Error listing customers:", error);
      res.status(500).json({ error: "Erro interno do servidor" });
    }
  });

  console.log("🛣️  Routes configured successfully");
}