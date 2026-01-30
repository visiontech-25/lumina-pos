

import { Product, Supplier } from './types';

// Fix: Added missing storeId and lastUpdated to match the updated Product interface
export const INITIAL_PRODUCTS: Product[] = [
  { id: '1', storeId: '', name: 'Premium Coffee Beans', category: 'Groceries', price: 18.50, stock: 45, image: 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?auto=format&fit=crop&q=80&w=200&h=200', sku: 'GRO-001', barcode: '741258963', supplier: 'Bean Masters', tags: ['organic', 'bestseller'], lastUpdated: new Date().toISOString() },
  { id: '2', storeId: '', name: 'Organic Matcha Powder', category: 'Groceries', price: 24.99, stock: 30, image: 'https://images.unsplash.com/photo-1582722872445-41ca507ad33b?auto=format&fit=crop&q=80&w=200&h=200', sku: 'GRO-002', barcode: '963852741', supplier: 'Green Leaf Co', tags: ['organic', 'imported'], lastUpdated: new Date().toISOString() },
  { id: '3', storeId: '', name: 'Stainless Steel Kettle', category: 'Kitchenware', price: 55.00, stock: 12, image: 'https://images.unsplash.com/photo-1594824476967-48c8b964273f?auto=format&fit=crop&q=80&w=200&h=200', sku: 'KIT-001', barcode: '123456789', supplier: 'Chef Gear', tags: ['durable'], lastUpdated: new Date().toISOString() },
  { id: '4', storeId: '', name: 'Ceramic Coffee Mug', category: 'Kitchenware', price: 12.99, stock: 85, image: 'https://images.unsplash.com/photo-1514228742587-6b1558fbed20?auto=format&fit=crop&q=80&w=200&h=200', sku: 'KIT-002', barcode: '987654321', supplier: 'Chef Gear', tags: ['fragile', 'handmade'], lastUpdated: new Date().toISOString() },
  { id: '5', storeId: '', name: 'Handcrafted Chocolate', category: 'Groceries', price: 6.50, stock: 120, image: 'https://images.unsplash.com/photo-1511381939415-e44015466834?auto=format&fit=crop&q=80&w=200&h=200', sku: 'GRO-003', barcode: '456123789', supplier: 'Choco Delight', tags: ['sweet', 'gift'], lastUpdated: new Date().toISOString() },
  { id: '6', storeId: '', name: 'Waffle Maker Pro', category: 'Kitchenware', price: 89.99, stock: 8, image: 'https://images.unsplash.com/photo-1584992236310-6edddc08acff?auto=format&fit=crop&q=80&w=200&h=200', sku: 'KIT-003', barcode: '321654987', supplier: 'Home Tech', tags: ['clearance'], lastUpdated: new Date().toISOString() },
  { id: '7', storeId: '', name: 'Honey Roasted Almonds', category: 'Groceries', price: 14.25, stock: 60, image: 'https://images.unsplash.com/photo-1504113888839-1c8eb50233d3?auto=format&fit=crop&q=80&w=200&h=200', sku: 'GRO-004', barcode: '159753456', supplier: 'Nutri Harvest', tags: ['snack', 'seasonal'], lastUpdated: new Date().toISOString() },
  { id: '8', storeId: '', name: 'Digital Kitchen Scale', category: 'Kitchenware', price: 29.99, stock: 25, image: 'https://images.unsplash.com/photo-1591461329246-0a41d9966779?auto=format&fit=crop&q=80&w=200&h=200', sku: 'KIT-004', barcode: '852963741', supplier: 'Home Tech', tags: ['tech'], lastUpdated: new Date().toISOString() },
];

// Fix: Added missing storeId to match the updated Supplier interface
export const INITIAL_SUPPLIERS: Supplier[] = [
  { id: 's1', storeId: '', name: 'Bean Masters', contactPerson: 'Aris Thorne', email: 'aris@beanmasters.com', phone: '+1 555-0101', category: 'Groceries', address: '42 Roaster Way, Portland', tags: ['local', 'artisanal', 'high-priority'] },
  { id: 's2', storeId: '', name: 'Green Leaf Co', contactPerson: 'Lana Green', email: 'sales@greenleaf.co', phone: '+1 555-0202', category: 'Groceries', address: '78 Tea Garden, Kyoto', tags: ['imported', 'organic', 'certified'] },
  { id: 's3', storeId: '', name: 'Chef Gear', contactPerson: 'Mark Steel', email: 'm.steel@chefgear.net', phone: '+1 555-0303', category: 'Kitchenware', address: '12 Industrial Blvd, Chicago', tags: ['bulk-discount', 'industrial'] },
  { id: 's4', storeId: '', name: 'Home Tech', contactPerson: 'Sara Watt', email: 'sara@hometech.io', phone: '+1 555-0404', category: 'Kitchenware', address: '90 Silicon Dr, San Francisco', tags: ['technology', 'reliable'] },
  { id: 's5', storeId: '', name: 'Choco Delight', contactPerson: 'Coco Sweet', email: 'hello@chocodelight.com', phone: '+1 555-0505', category: 'Groceries', address: '15 Cocoa St, Brussels', tags: ['imported', 'luxury'] },
  { id: 's6', storeId: '', name: 'Nutri Harvest', contactPerson: 'Ben Almond', email: 'ben@nutriharvest.org', phone: '+1 555-0606', category: 'Groceries', address: '55 Orchard Rd, Napa Valley', tags: ['eco-friendly', 'local'] },
];

export const TAX_RATE = 0.08; // 8% tax
