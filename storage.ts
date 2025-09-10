import { randomUUID } from 'crypto';
import { Customer, InsertCustomer, Billing, InsertBilling } from './types';

// In-memory storage interface
export interface IStorage {
  // Customers
  getCustomer(id: string): Promise<Customer | undefined>;
  getCustomerByEmail(email: string): Promise<Customer | undefined>;
  createCustomer(customer: InsertCustomer): Promise<Customer>;
  updateCustomer(id: string, updates: Partial<Customer>): Promise<Customer | undefined>;
  
  // Billings
  getBilling(id: string): Promise<Billing | undefined>;
  getBillingByAbacatePayId(abacatePayId: string): Promise<Billing | undefined>;
  createBilling(billing: InsertBilling): Promise<Billing>;
  updateBilling(id: string, updates: Partial<Billing>): Promise<Billing | undefined>;
  getBillingsByCustomerId(customerId: string): Promise<Billing[]>;
}

export class MemStorage implements IStorage {
  private customers: Map<string, Customer> = new Map();
  private billings: Map<string, Billing> = new Map();

  // Customers
  async getCustomer(id: string): Promise<Customer | undefined> {
    return this.customers.get(id);
  }

  async getCustomerByEmail(email: string): Promise<Customer | undefined> {
    return Array.from(this.customers.values()).find(
      (customer) => customer.email === email
    );
  }

  async createCustomer(insertCustomer: InsertCustomer): Promise<Customer> {
    const id = randomUUID();
    const customer: Customer = { 
      ...insertCustomer, 
      id,
      abacatePayId: undefined,
      createdAt: new Date()
    };
    this.customers.set(id, customer);
    return customer;
  }

  async updateCustomer(id: string, updates: Partial<Customer>): Promise<Customer | undefined> {
    const customer = this.customers.get(id);
    if (!customer) return undefined;
    
    const updatedCustomer = { ...customer, ...updates };
    this.customers.set(id, updatedCustomer);
    return updatedCustomer;
  }

  // Billings
  async getBilling(id: string): Promise<Billing | undefined> {
    return this.billings.get(id);
  }

  async getBillingByAbacatePayId(abacatePayId: string): Promise<Billing | undefined> {
    return Array.from(this.billings.values()).find(
      (billing) => billing.abacatePayId === abacatePayId
    );
  }

  async createBilling(insertBilling: InsertBilling): Promise<Billing> {
    const id = randomUUID();
    const billing: Billing = { 
      ...insertBilling, 
      id,
      abacatePayId: undefined,
      paymentUrl: undefined,
      pixCode: undefined,
      qrCodeUrl: undefined,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.billings.set(id, billing);
    return billing;
  }

  async updateBilling(id: string, updates: Partial<Billing>): Promise<Billing | undefined> {
    const billing = this.billings.get(id);
    if (!billing) return undefined;
    
    const updatedBilling = { ...billing, ...updates, updatedAt: new Date() };
    this.billings.set(id, updatedBilling);
    return updatedBilling;
  }

  async getBillingsByCustomerId(customerId: string): Promise<Billing[]> {
    return Array.from(this.billings.values()).filter(
      (billing) => billing.customerId === customerId
    );
  }
}

export const storage = new MemStorage();