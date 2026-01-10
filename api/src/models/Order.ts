import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IOrderItem {
  globalProductId: mongoose.Types.ObjectId | string;
  globalVariantId?: mongoose.Types.ObjectId | string;
  productId: string; // Legacy: keep for backward compatibility
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number; // Reseller price (selling price)
  totalPrice: number; // Line total after discounts
  supplierId: mongoose.Types.ObjectId | string;
  supplierCost: number; // Supplier cost per unit
  resellerPrice: number; // Reseller selling price per unit
  lineSubtotal: number; // Line subtotal (after discounts, before tax)
  taxSnapshot?: {
    taxRate: number;
    taxAmount: number;
    taxBreakup: {
      cgst?: number;
      sgst?: number;
      igst?: number;
      vat?: number;
    };
  }; // Line-level tax snapshot
}

export interface IOrder extends Document {
  orderId: string; // Legacy: unique identifier
  orderNumber?: string; // Sequential order number (ORD-{STORECODE}-{YYYY}-{SEQ})
  storeId: mongoose.Types.ObjectId;
  customerId?: mongoose.Types.ObjectId | string; // Customer ID (if logged in)
  resellerId: string; // Store ownerId (reseller)
  supplierId?: mongoose.Types.ObjectId | string; // Primary supplier (if single supplier order)
  items: IOrderItem[];
  totalAmount: number; // Base amount before discounts and tax
  subtotal: number; // Amount after discounts, before tax
  taxTotal: number; // Total tax amount (from taxSnapshot.totalTax)
  grandTotal: number; // Final amount including tax and shipping (totalAmountWithTax)
  status: 'pending' | 'paid' | 'failed' | 'cancelled' | 'confirmed';
  orderStatus: 'created' | 'payment_pending' | 'confirmed' | 'processing' | 'shipped' | 'out_for_delivery' | 'delivered' | 'cancelled' | 'returned' | 'refunded';
  paymentMethod?: 'stripe' | 'paypal' | 'cod' | 'cod_partial' | 'crypto';
  paymentStatus?: 'pending' | 'paid' | 'failed' | 'cod_pending' | 'cod_collected' | 'cod_failed' | 'cod_partial_paid';
  paymentIntentId?: string | null;
  codAmount?: number; // COD amount (remaining amount after prepaid)
  prepaidAmount?: number; // Amount paid online (for partial prepaid COD)
  codEligible?: boolean; // Whether COD was eligible at order time
  codConfirmedAt?: Date | null; // When COD was collected
  inventoryStatus?: 'reserved' | 'consumed' | 'released'; // Inventory reservation status
  customerEmail?: string;
  customerName?: string;
  shippingAddress?: {
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  billingAddress?: {
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  couponCode?: string | null;
  couponId?: string | null;
  discountAmount?: number;
  taxType?: 'gst' | 'vat' | null; // Tax system type (legacy, use taxSnapshot)
  taxRate?: number; // Tax rate percentage (legacy, use taxSnapshot)
  taxAmount?: number; // Total tax amount (legacy, use taxSnapshot.totalTax)
  taxSnapshot?: {
    taxType: 'GST' | 'VAT';
    countryCode: string;
    stateCode?: string;
    placeOfSupply: {
      country: string;
      state?: string;
    };
    taxableAmount: number;
    taxBreakup: {
      cgst?: number;
      sgst?: number;
      igst?: number;
      vat?: number;
    };
    totalTax: number;
    exemptionReason?: string;
    calculatedAt: Date;
  }; // Immutable tax snapshot
  shippingSnapshot?: {
    zoneId: mongoose.Types.ObjectId | string;
    zoneName: string;
    rateType: 'weight' | 'order_value';
    slab: {
      min: number;
      max: number;
    };
    baseRate: number;
    variableRate: number; // unit * perUnitRate
    codSurcharge: number;
    totalShipping: number; // baseRate + variableRate + codSurcharge
    calculatedAt: Date;
  }; // Immutable shipping snapshot - never recalculate
  courierSnapshot?: {
    courierId: mongoose.Types.ObjectId | string;
    courierName: string;
    courierCode: string;
    ruleId?: mongoose.Types.ObjectId | string | null;
    assignedAt: Date;
    reason: string; // Rule match explanation
  }; // Immutable courier snapshot - frozen after assignment
  fulfillmentSnapshot?: {
    items: Array<{
      globalVariantId: mongoose.Types.ObjectId | string;
      quantity: number;
      supplierId: mongoose.Types.ObjectId | string;
      originId: mongoose.Types.ObjectId | string;
      originAddress: {
        name: string;
        country: string;
        state: string;
        city: string;
        pincode: string;
        street?: string;
      };
      courierId?: mongoose.Types.ObjectId | string;
      shippingZoneId?: mongoose.Types.ObjectId | string;
      shippingCost?: number;
    }>;
    shipmentGroups?: Array<{
      originId: mongoose.Types.ObjectId | string;
      items: Array<{
        globalVariantId: mongoose.Types.ObjectId | string;
        quantity: number;
      }>;
      shippingCost: number;
      courierId?: mongoose.Types.ObjectId | string;
      status: 'pending' | 'processing' | 'shipped' | 'delivered';
    }>;
    routedAt: Date;
  }; // Immutable fulfillment snapshot - frozen at order creation
  shippingAmount?: number; // Shipping charges (legacy, use shippingSnapshot.totalShipping)
  totalAmountWithTax?: number; // Final amount including tax and shipping
  storePriceApplied?: boolean; // Whether store price override was applied
  finalAmount?: number; // Deprecated: Use totalAmountWithTax instead
  referralSnapshot?: {
    referralCode: string;
    referrerId: mongoose.Types.ObjectId | string;
    referrerType: 'customer' | 'reseller' | 'influencer';
    userReferralId?: mongoose.Types.ObjectId | string;
    attributedAt: Date;
  }; // Immutable referral snapshot - frozen at order creation
  marketingAttribution?: {
    firstTouch?: {
      touchId: mongoose.Types.ObjectId;
      channel: string;
      source?: string;
      medium?: string;
      campaign?: string;
      occurredAt: Date;
    };
    lastTouch?: {
      touchId: mongoose.Types.ObjectId;
      channel: string;
      source?: string;
      medium?: string;
      campaign?: string;
      occurredAt: Date;
    };
    attributionModel: 'first_touch' | 'last_touch' | 'linear' | 'time_decay';
    channelCredits?: Array<{
      channel: string;
      credit: number; // 0-1
      touchId: mongoose.Types.ObjectId;
    }>;
    attributedAt: Date;
  }; // Immutable marketing attribution snapshot - frozen at order creation
  metadata?: {
    lastTransition?: {
      from: string;
      to: string;
      at: Date;
      actorRole: string;
      actorId?: string;
      metadata?: any;
    };
    trackingNumber?: string;
    deliveredAt?: Date;
    returnWindowEndsAt?: Date;
    cancellationReason?: string;
    cancelledAt?: Date;
    cancelledBy?: string;
    returnReason?: string;
    returnedAt?: Date;
    returnedBy?: string;
    refundedAt?: Date;
    [key: string]: any;
  };
  createdAt: Date;
  updatedAt: Date;
}

const OrderItemSchema: Schema = new Schema(
  {
    globalProductId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    globalVariantId: {
      type: Schema.Types.ObjectId,
      ref: 'ProductVariant',
      default: null,
    },
    productId: {
      type: String,
      required: true,
      // Legacy: keep for backward compatibility
    },
    sku: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0,
      // Reseller price (selling price)
    },
    totalPrice: {
      type: Number,
      required: true,
      min: 0,
      // Line total after discounts
    },
    supplierId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    supplierCost: {
      type: Number,
      required: true,
      min: 0,
      // Supplier cost per unit
    },
    resellerPrice: {
      type: Number,
      required: true,
      min: 0,
      // Reseller selling price per unit
    },
    lineSubtotal: {
      type: Number,
      required: true,
      min: 0,
      // Line subtotal (after discounts, before tax)
    },
    taxSnapshot: {
      type: {
        taxRate: Number,
        taxAmount: Number,
        taxBreakup: {
          cgst: Number,
          sgst: Number,
          igst: Number,
          vat: Number,
        },
      },
      default: null,
      // Line-level tax snapshot
    },
  },
  { _id: false }
);

const OrderSchema: Schema = new Schema(
  {
    orderId: {
      type: String,
      required: [true, 'Order ID is required'],
      unique: true,
      trim: true,
      index: true,
      // Legacy: unique identifier
    },
    orderNumber: {
      type: String,
      trim: true,
      index: true,
      // Sequential order number (ORD-{STORECODE}-{YYYY}-{SEQ})
    },
    storeId: {
      type: Schema.Types.ObjectId,
      ref: 'Store',
      required: [true, 'Store ID is required'],
      index: true,
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
      // Customer ID (if logged in)
    },
    resellerId: {
      type: String,
      required: [true, 'Reseller ID is required'],
      trim: true,
      index: true,
    },
    supplierId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
      // Primary supplier (if single supplier order)
    },
    items: {
      type: [OrderItemSchema],
      required: true,
      validate: {
        validator: (items: IOrderItem[]) => items.length > 0,
        message: 'Order must have at least one item',
      },
    },
    totalAmount: {
      type: Number,
      required: [true, 'Total amount is required'],
      min: [0, 'Total amount must be greater than or equal to 0'],
    },
    status: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'cancelled', 'confirmed'],
      default: 'pending',
      index: true,
      // Legacy: payment-focused status
    },
    orderStatus: {
      type: String,
      enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'],
      default: 'pending',
      index: true,
      // Order lifecycle status
    },
    paymentMethod: {
      type: String,
      enum: ['stripe', 'paypal', 'cod', 'cod_partial'],
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'cod_pending', 'cod_collected', 'cod_failed', 'cod_partial_paid'],
      default: 'pending',
      index: true,
    },
    paymentIntentId: {
      type: String,
      trim: true,
      default: null,
      index: true,
    },
    codAmount: {
      type: Number,
      min: 0,
      // COD amount (remaining amount after prepaid)
    },
    prepaidAmount: {
      type: Number,
      min: 0,
      // Amount paid online (for partial prepaid COD)
    },
    codEligible: {
      type: Boolean,
      default: false,
      // Whether COD was eligible at order time
    },
    codConfirmedAt: {
      type: Date,
      default: null,
      // When COD was collected
    },
    inventoryStatus: {
      type: String,
      enum: ['reserved', 'consumed', 'released'],
      default: 'reserved',
      index: true,
      // Inventory reservation status
    },
    customerEmail: {
      type: String,
      trim: true,
    },
    customerName: {
      type: String,
      trim: true,
    },
    shippingAddress: {
      street: String,
      city: String,
      state: String,
      zip: String,
      country: String,
    },
    billingAddress: {
      street: String,
      city: String,
      state: String,
      zip: String,
      country: String,
    },
    couponCode: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },
    couponId: {
      type: String,
      trim: true,
      default: null,
    },
    discountAmount: {
      type: Number,
      min: 0,
      default: 0,
    },
    subtotal: {
      type: Number,
      min: 0,
      // Amount after discounts, before tax
    },
    taxTotal: {
      type: Number,
      min: 0,
      default: 0,
      // Total tax amount (from taxSnapshot.totalTax)
    },
    grandTotal: {
      type: Number,
      min: 0,
      // Final amount including tax and shipping (alias for totalAmountWithTax)
    },
    taxType: {
      type: String,
      enum: ['gst', 'vat'],
      default: null,
    },
    taxRate: {
      type: Number,
      min: 0,
      max: 100,
      // Tax rate percentage
    },
    taxAmount: {
      type: Number,
      min: 0,
      default: 0,
      // Total tax amount (legacy - use taxSnapshot.totalTax)
    },
    taxSnapshot: {
      type: {
        taxType: {
          type: String,
          enum: ['GST', 'VAT'],
          required: true,
        },
        countryCode: {
          type: String,
          required: true,
        },
        stateCode: {
          type: String,
        },
        placeOfSupply: {
          country: { type: String, required: true },
          state: { type: String },
        },
        taxableAmount: {
          type: Number,
          required: true,
          min: 0,
        },
        taxBreakup: {
          cgst: Number,
          sgst: Number,
          igst: Number,
          vat: Number,
        },
        totalTax: {
          type: Number,
          required: true,
          min: 0,
        },
        exemptionReason: {
          type: String,
        },
        calculatedAt: {
          type: Date,
          required: true,
        },
      },
      default: null,
      // Immutable tax snapshot - never recalculate
    },
    shippingSnapshot: {
      type: {
        zoneId: {
          type: Schema.Types.ObjectId,
          required: true,
        },
        zoneName: {
          type: String,
          required: true,
        },
        rateType: {
          type: String,
          enum: ['weight', 'order_value'],
          required: true,
        },
        slab: {
          min: { type: Number, required: true },
          max: { type: Number, required: true },
        },
        baseRate: {
          type: Number,
          required: true,
          min: 0,
        },
        variableRate: {
          type: Number,
          required: true,
          min: 0,
        },
        codSurcharge: {
          type: Number,
          required: true,
          min: 0,
        },
        totalShipping: {
          type: Number,
          required: true,
          min: 0,
        },
        calculatedAt: {
          type: Date,
          required: true,
        },
      },
      default: null,
      // Immutable shipping snapshot - never recalculate
    },
    courierSnapshot: {
      type: {
        courierId: {
          type: Schema.Types.ObjectId,
          required: true,
        },
        courierName: {
          type: String,
          required: true,
        },
        courierCode: {
          type: String,
          required: true,
        },
        ruleId: {
          type: Schema.Types.ObjectId,
          default: null,
        },
        assignedAt: {
          type: Date,
          required: true,
        },
        reason: {
          type: String,
          required: true,
        },
      },
      default: null,
      // Immutable courier snapshot - frozen after assignment
    },
    fulfillmentSnapshot: {
      type: {
        items: [
          {
            globalVariantId: {
              type: Schema.Types.ObjectId,
              required: true,
            },
            quantity: {
              type: Number,
              required: true,
              min: 1,
            },
            supplierId: {
              type: Schema.Types.ObjectId,
              required: true,
            },
            originId: {
              type: Schema.Types.ObjectId,
              required: true,
            },
            originAddress: {
              name: { type: String, required: true },
              country: { type: String, required: true },
              state: { type: String, required: true },
              city: { type: String, required: true },
              pincode: { type: String, required: true },
              street: { type: String },
            },
            courierId: {
              type: Schema.Types.ObjectId,
              default: null,
            },
            shippingZoneId: {
              type: Schema.Types.ObjectId,
              default: null,
            },
            shippingCost: {
              type: Number,
              default: 0,
              min: 0,
            },
          },
        ],
        shipmentGroups: [
          {
            originId: {
              type: Schema.Types.ObjectId,
              required: true,
            },
            items: [
              {
                globalVariantId: {
                  type: Schema.Types.ObjectId,
                  required: true,
                },
                quantity: {
                  type: Number,
                  required: true,
                  min: 1,
                },
              },
            ],
            shippingCost: {
              type: Number,
              required: true,
              min: 0,
            },
            courierId: {
              type: Schema.Types.ObjectId,
              default: null,
            },
            status: {
              type: String,
              enum: ['pending', 'processing', 'shipped', 'delivered'],
              default: 'pending',
            },
          },
        ],
        routedAt: {
          type: Date,
          required: true,
          default: Date.now,
        },
      },
      default: null,
      // Immutable fulfillment snapshot - frozen at order creation
    },
    shippingAmount: {
      type: Number,
      min: 0,
      default: 0,
      // Shipping charges (legacy, use shippingSnapshot.totalShipping)
    },
    totalAmountWithTax: {
      type: Number,
      min: 0,
      // Final amount including tax and shipping
    },
    storePriceApplied: {
      type: Boolean,
      default: false,
      // Whether store price override was applied at checkout
    },
    finalAmount: {
      type: Number,
      min: 0,
      // Deprecated: Use totalAmountWithTax instead
    },
    referralSnapshot: {
      type: {
        referralCode: String,
        referrerId: Schema.Types.Mixed,
        referrerType: {
          type: String,
          enum: ['customer', 'reseller', 'influencer'],
        },
        userReferralId: Schema.Types.Mixed,
        attributedAt: Date,
      },
      default: null,
      // Immutable referral snapshot - frozen at order creation
    },
    marketingAttribution: {
      type: {
        firstTouch: {
          touchId: { type: Schema.Types.ObjectId, ref: 'MarketingTouch' },
          channel: String,
          source: String,
          medium: String,
          campaign: String,
          occurredAt: Date,
        },
        lastTouch: {
          touchId: { type: Schema.Types.ObjectId, ref: 'MarketingTouch' },
          channel: String,
          source: String,
          medium: String,
          campaign: String,
          occurredAt: Date,
        },
        attributionModel: {
          type: String,
          enum: ['first_touch', 'last_touch', 'linear', 'time_decay'],
        },
        channelCredits: [
          {
            channel: String,
            credit: Number,
            touchId: { type: Schema.Types.ObjectId, ref: 'MarketingTouch' },
          },
        ],
        attributedAt: Date,
      },
      default: null,
      // Immutable marketing attribution snapshot - frozen at order creation
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
      // Store transition history, tracking, return window, etc.
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes
OrderSchema.index({ resellerId: 1, status: 1 });
OrderSchema.index({ storeId: 1, status: 1 });

export const Order: Model<IOrder> =
  mongoose.models.Order || mongoose.model<IOrder>('Order', OrderSchema);

