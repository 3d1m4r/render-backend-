import { z } from 'zod';

// Customer schema and types
export const insertCustomerSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('E-mail inválido'),
  phone: z.string().min(10, 'Telefone deve ter pelo menos 10 dígitos'),
  taxId: z.string().min(11, 'CPF deve ter pelo menos 11 dígitos')
});

export type InsertCustomer = z.infer<typeof insertCustomerSchema>;

export interface Customer extends InsertCustomer {
  id: string;
  abacatePayId?: string;
  createdAt: Date;
}

// Billing schema and types
export const insertBillingSchema = z.object({
  customerId: z.string(),
  amount: z.string(),
  status: z.string().default('PENDING'),
  paymentMethod: z.string().default('PIX')
});

export type InsertBilling = z.infer<typeof insertBillingSchema>;

export interface Billing extends InsertBilling {
  id: string;
  abacatePayId?: string;
  paymentUrl?: string;
  pixCode?: string;
  qrCodeUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

// AbacatePay response types
export interface AbacatePayPixResponse {
  error?: any;
  data?: {
    id: string;
    brCode: string;
    brCodeBase64: string;
    status: string;
    amount: number;
    expiresAt: string;
  };
}

export interface AbacatePayCheckResponse {
  error?: any;
  data?: {
    status: string;
    expiresAt: string;
    amount: number;
  };
}