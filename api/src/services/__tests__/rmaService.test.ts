import { calculateReturnFee } from '../rmaService';
import { Order } from '../../models/Order';
import { Product } from '../../models/Product';

// Mock the models
jest.mock('../../models/Order');
jest.mock('../../models/Product');

describe('RMA Service - calculateReturnFee', () => {
  const mockOrder = {
    orderId: 'order_123',
    createdAt: new Date(),
    items: [
      {
        productId: 'prod_1',
        sku: 'SKU001',
        name: 'Test Product',
        quantity: 2,
        unitPrice: 100,
        totalPrice: 200,
        supplierId: 'supplier_1',
      },
    ],
  };

  const mockProduct = {
    _id: 'prod_1',
    category: 'Uncategorized',
    name: 'Test Product',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (Order.findOne as jest.Mock).mockResolvedValue(mockOrder);
    (Product.findById as jest.Mock).mockResolvedValue(mockProduct);
  });

  describe('Within 7 days - zero fee', () => {
    it('should return zero fee for items returned within 7 days', async () => {
      // Set order date to 5 days ago
      const orderDate = new Date();
      orderDate.setDate(orderDate.getDate() - 5);
      (Order.findOne as jest.Mock).mockResolvedValue({
        ...mockOrder,
        createdAt: orderDate,
      });

      const result = await calculateReturnFee('order_123', [
        { productId: 'prod_1', sku: 'SKU001', quantity: 1 },
      ]);

      expect(result.totalFee).toBe(0);
      expect(result.itemFees[0].baseFee).toBe(0);
      expect(result.itemFees[0].categorySurcharge).toBe(0);
      expect(result.itemFees[0].itemTotalFee).toBe(0);
    });

    it('should return zero fee for items returned on day 7', async () => {
      const orderDate = new Date();
      orderDate.setDate(orderDate.getDate() - 7);
      (Order.findOne as jest.Mock).mockResolvedValue({
        ...mockOrder,
        createdAt: orderDate,
      });

      const result = await calculateReturnFee('order_123', [
        { productId: 'prod_1', sku: 'SKU001', quantity: 1 },
      ]);

      expect(result.totalFee).toBe(0);
    });
  });

  describe('Over 30 days - 20% fee', () => {
    it('should return 20% fee for items returned after 30 days', async () => {
      const orderDate = new Date();
      orderDate.setDate(orderDate.getDate() - 35);
      (Order.findOne as jest.Mock).mockResolvedValue({
        ...mockOrder,
        createdAt: orderDate,
      });

      const result = await calculateReturnFee('order_123', [
        { productId: 'prod_1', sku: 'SKU001', quantity: 1 },
      ]);

      // 20% of $100 = $20
      expect(result.totalFee).toBe(20);
      expect(result.itemFees[0].baseFee).toBe(20);
      expect(result.itemFees[0].itemTotalFee).toBe(20);
    });

    it('should calculate correctly for multiple quantities', async () => {
      const orderDate = new Date();
      orderDate.setDate(orderDate.getDate() - 35);
      (Order.findOne as jest.Mock).mockResolvedValue({
        ...mockOrder,
        createdAt: orderDate,
      });

      const result = await calculateReturnFee('order_123', [
        { productId: 'prod_1', sku: 'SKU001', quantity: 2 },
      ]);

      // 20% of $100 × 2 = $40
      expect(result.totalFee).toBe(40);
      expect(result.itemFees[0].itemTotalFee).toBe(40);
    });
  });

  describe('Electronics category surcharge', () => {
    it('should add 5% surcharge for electronics category', async () => {
      const orderDate = new Date();
      orderDate.setDate(orderDate.getDate() - 35);
      (Order.findOne as jest.Mock).mockResolvedValue({
        ...mockOrder,
        createdAt: orderDate,
      });

      (Product.findById as jest.Mock).mockResolvedValue({
        ...mockProduct,
        category: 'electronics',
      });

      const result = await calculateReturnFee('order_123', [
        { productId: 'prod_1', sku: 'SKU001', quantity: 1 },
      ]);

      // 20% base fee + 5% surcharge = 25% of $100 = $25
      expect(result.totalFee).toBe(25);
      expect(result.itemFees[0].baseFee).toBe(20);
      expect(result.itemFees[0].categorySurcharge).toBe(5);
      expect(result.itemFees[0].itemTotalFee).toBe(25);
    });

    it('should not add surcharge for non-electronics category', async () => {
      const orderDate = new Date();
      orderDate.setDate(orderDate.getDate() - 35);
      (Order.findOne as jest.Mock).mockResolvedValue({
        ...mockOrder,
        createdAt: orderDate,
      });

      (Product.findById as jest.Mock).mockResolvedValue({
        ...mockProduct,
        category: 'clothing',
      });

      const result = await calculateReturnFee('order_123', [
        { productId: 'prod_1', sku: 'SKU001', quantity: 1 },
      ]);

      // 20% base fee only = $20
      expect(result.totalFee).toBe(20);
      expect(result.itemFees[0].categorySurcharge).toBe(0);
    });
  });

  describe('Between 8-30 days - 10% fee', () => {
    it('should return 10% fee for items returned between 8-30 days', async () => {
      const orderDate = new Date();
      orderDate.setDate(orderDate.getDate() - 15);
      (Order.findOne as jest.Mock).mockResolvedValue({
        ...mockOrder,
        createdAt: orderDate,
      });

      const result = await calculateReturnFee('order_123', [
        { productId: 'prod_1', sku: 'SKU001', quantity: 1 },
      ]);

      // 10% of $100 = $10
      expect(result.totalFee).toBe(10);
      expect(result.itemFees[0].baseFee).toBe(10);
    });
  });

  describe('Error handling', () => {
    it('should throw error if order not found', async () => {
      (Order.findOne as jest.Mock).mockResolvedValue(null);

      await expect(
        calculateReturnFee('order_123', [{ productId: 'prod_1', sku: 'SKU001', quantity: 1 }])
      ).rejects.toThrow('Order not found: order_123');
    });

    it('should throw error if product not in order', async () => {
      await expect(
        calculateReturnFee('order_123', [{ productId: 'prod_999', sku: 'SKU999', quantity: 1 }])
      ).rejects.toThrow('Product prod_999 not found in order order_123');
    });

    it('should throw error if return quantity exceeds ordered quantity', async () => {
      await expect(
        calculateReturnFee('order_123', [{ productId: 'prod_1', sku: 'SKU001', quantity: 5 }])
      ).rejects.toThrow('Return quantity (5) exceeds ordered quantity (2)');
    });
  });

  describe('Multiple items', () => {
    it('should calculate fee for multiple different items', async () => {
      const orderDate = new Date();
      orderDate.setDate(orderDate.getDate() - 35);
      (Order.findOne as jest.Mock).mockResolvedValue({
        ...mockOrder,
        items: [
          {
            productId: 'prod_1',
            sku: 'SKU001',
            name: 'Product 1',
            quantity: 2,
            unitPrice: 100,
            totalPrice: 200,
            supplierId: 'supplier_1',
          },
          {
            productId: 'prod_2',
            sku: 'SKU002',
            name: 'Product 2',
            quantity: 1,
            unitPrice: 50,
            totalPrice: 50,
            supplierId: 'supplier_1',
          },
        ],
        createdAt: orderDate,
      });

      (Product.findById as jest.Mock).mockImplementation((id: string) => {
        if (id === 'prod_1') {
          return Promise.resolve({ ...mockProduct, _id: 'prod_1' });
        }
        return Promise.resolve({ ...mockProduct, _id: 'prod_2', category: 'electronics' });
      });

      const result = await calculateReturnFee('order_123', [
        { productId: 'prod_1', sku: 'SKU001', quantity: 1 },
        { productId: 'prod_2', sku: 'SKU002', quantity: 1 },
      ]);

      // prod_1: 20% of $100 = $20
      // prod_2: 20% + 5% = 25% of $50 = $12.50
      // Total: $32.50
      expect(result.totalFee).toBe(32.5);
      expect(result.itemFees.length).toBe(2);
    });
  });
});

