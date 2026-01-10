import mongoose, { ClientSession } from 'mongoose';
import { withTransaction } from '../utils/withTransaction';
import { Order, IOrder } from '../models/Order';
import { RMA, IRMA } from '../models/RMA';
import { ShippingLabel, IShippingLabel, LabelType } from '../models/ShippingLabel';
import { Store } from '../models/Store';
import { TaxProfile } from '../models/TaxProfile';
import { User } from '../models/User';
import { SupplierOrigin } from '../models/SupplierOrigin';
import { generateLabelNumber } from '../utils/labelNumber';
import { generateShippingLabelPdf, ShippingLabelPdfData } from '../utils/shippingLabelPdf';
import { logAudit } from '../utils/auditLogger';
import { eventStreamEmitter } from '../controllers/eventController';
import { Request } from 'express';
import path from 'path';
import fs from 'fs';
import { mapCourierForLogistics, mapCourierForReturns, mapCourierForCRM } from './courierMapping.service';

/**
 * Unified Label Generator Service
 * 
 * PURPOSE:
 * - Generate shipping labels for Logistics (outbound)
 * - Generate shipping labels for Returns (reverse logistics)
 * - Generate shipping labels for CRM (customer service)
 * - Support all label types with scenario-specific logic
 * - Integrate with courier mapping system
 */

export interface GenerateLabelParams {
  labelType: LabelType;
  // For logistics
  orderId?: mongoose.Types.ObjectId | string;
  // For returns
  rmaId?: mongoose.Types.ObjectId | string;
  // For CRM
  crmTicketId?: string;
  scenario?: 'support_ticket' | 'document_delivery' | 'replacement' | 'warranty';
  urgency?: 'low' | 'medium' | 'high' | 'critical';
  customerTier?: 'standard' | 'premium' | 'vip';
  // Common
  storeId: mongoose.Types.ObjectId | string;
  generatedBy: mongoose.Types.ObjectId | string;
  courierId?: mongoose.Types.ObjectId | string; // Optional: override courier
  req?: Request;
}

export interface GenerateLabelResult {
  success: boolean;
  label?: IShippingLabel;
  error?: string;
}

/**
 * Generate label for Logistics (outbound shipping)
 */
async function generateLogisticsLabel(
  params: GenerateLabelParams,
  session: ClientSession
): Promise<GenerateLabelResult> {
  const { orderId, storeId, generatedBy, courierId, req } = params;

  if (!orderId) {
    return { success: false, error: 'Order ID is required for logistics label' };
  }

  const orderObjId = typeof orderId === 'string' ? new mongoose.Types.ObjectId(orderId) : orderId;
  const storeObjId = typeof storeId === 'string' ? new mongoose.Types.ObjectId(storeId) : storeId;
  const userObjId = typeof generatedBy === 'string' ? new mongoose.Types.ObjectId(generatedBy) : generatedBy;

  // Fetch order
  const order = await Order.findById(orderObjId).session(session);
  if (!order) {
    return { success: false, error: 'Order not found' };
  }

  // Validate order status
  const validStatuses = ['confirmed', 'processing'];
  if (!validStatuses.includes(order.orderStatus)) {
    return {
      success: false,
      error: `Label can only be generated when order status is 'confirmed' or 'processing'. Current status: ${order.orderStatus}`,
    };
  }

  // Check for existing label
  const existingLabel = await ShippingLabel.findOne({
    orderId: orderObjId,
    labelType: 'logistics',
    status: 'generated',
  }).session(session);

  if (existingLabel) {
    return { success: false, error: 'Shipping label already exists for this order' };
  }

  // Get or map courier
  let courier;
  if (courierId) {
    const { Courier } = await import('../models/Courier');
    courier = await Courier.findById(courierId).session(session);
    if (!courier || !courier.isActive) {
      return { success: false, error: 'Invalid or inactive courier' };
    }
  } else if (order.courierSnapshot) {
    const { Courier } = await import('../models/Courier');
    courier = await Courier.findById(order.courierSnapshot.courierId).session(session);
    if (!courier) {
      return { success: false, error: 'Courier not found' };
    }
  } else {
    // Map courier using courier mapping service
    if (!order.shippingSnapshot) {
      return { success: false, error: 'Shipping zone not found. Cannot map courier.' };
    }

    const courierMapping = await mapCourierForLogistics({
      storeId: storeObjId,
      shippingZoneId: order.shippingSnapshot.zoneId,
      orderWeight: order.items.reduce((total, item) => total + (item.quantity * 0.5), 0),
      orderValue: order.subtotal,
      paymentMethod: order.paymentMethod === 'cod' || order.paymentMethod === 'cod_partial' ? 'cod' : 'prepaid',
      shippingPincode: order.shippingAddress?.zip,
      priority: 'cost',
    });

    const { Courier } = await import('../models/Courier');
    courier = await Courier.findById(courierMapping.courier._id).session(session);
    if (!courier) {
      return { success: false, error: 'Mapped courier not found' };
    }
  }

  // Generate label
  return await createLabel({
    labelType: 'logistics',
    order,
    courier,
    storeId: storeObjId,
    generatedBy: userObjId,
    req,
    session,
  });
}

/**
 * Generate label for Returns (reverse logistics)
 */
async function generateReturnsLabel(
  params: GenerateLabelParams,
  session: ClientSession
): Promise<GenerateLabelResult> {
  const { rmaId, storeId, generatedBy, courierId, req } = params;

  if (!rmaId) {
    return { success: false, error: 'RMA ID is required for returns label' };
  }

  const rmaObjId = typeof rmaId === 'string' ? new mongoose.Types.ObjectId(rmaId) : rmaId;
  const storeObjId = typeof storeId === 'string' ? new mongoose.Types.ObjectId(storeId) : storeId;
  const userObjId = typeof generatedBy === 'string' ? new mongoose.Types.ObjectId(generatedBy) : generatedBy;

  // Fetch RMA
  const rma = await RMA.findById(rmaObjId).populate('orderId').session(session);
  if (!rma) {
    return { success: false, error: 'RMA not found' };
  }

  // Validate RMA status
  const validStatuses = ['approved', 'pickup_scheduled', 'picked_up'];
  if (!validStatuses.includes(rma.status)) {
    return {
      success: false,
      error: `Label can only be generated when RMA status is 'approved', 'pickup_scheduled', or 'picked_up'. Current status: ${rma.status}`,
    };
  }

  // Check for existing label
  const existingLabel = await ShippingLabel.findOne({
    rmaId: rmaObjId,
    labelType: 'returns',
    status: 'generated',
  }).session(session);

  if (existingLabel) {
    return { success: false, error: 'Shipping label already exists for this RMA' };
  }

  const order = rma.orderId as any as IOrder;

  // Get origin zone for returns
  let originZoneId: mongoose.Types.ObjectId | undefined;
  const firstFulfillmentItem = order.fulfillmentSnapshot?.items?.[0];
  if (firstFulfillmentItem?.originId) {
    const origin = await SupplierOrigin.findById(firstFulfillmentItem.originId).session(session);
    if (origin && origin.address) {
      const { getShippingZone } = await import('../utils/shippingEngine');
      const zone = await getShippingZone(storeId, {
        country: origin.address.country,
        state: origin.address.state,
        zip: origin.address.pincode,
      });
      if (zone) {
        originZoneId = zone._id;
      }
    }
  }

  // Get customer zone
  let customerZoneId: mongoose.Types.ObjectId | undefined;
  if (order.shippingSnapshot?.zoneId) {
    customerZoneId = typeof order.shippingSnapshot.zoneId === 'string'
      ? new mongoose.Types.ObjectId(order.shippingSnapshot.zoneId)
      : order.shippingSnapshot.zoneId;
  }

  // Get or map courier
  let courier;
  if (courierId) {
    const { Courier } = await import('../models/Courier');
    courier = await Courier.findById(courierId).session(session);
    if (!courier || !courier.isActive) {
      return { success: false, error: 'Invalid or inactive courier' };
    }
  } else {
    // Map courier for returns
    const courierMapping = await mapCourierForReturns({
      storeId: storeObjId,
      rmaId: rmaObjId,
      returnReason: rma.items[0]?.reason,
      itemCondition: rma.items[0]?.condition,
      returnValue: rma.refundAmount,
      originZoneId,
      customerZoneId,
      requiresPickup: true,
      priority: 'cost',
    });

    const { Courier } = await import('../models/Courier');
    courier = await Courier.findById(courierMapping.courier._id).session(session);
    if (!courier) {
      return { success: false, error: 'Mapped courier not found' };
    }
  }

  // Generate label
  return await createReturnsLabel({
    rma,
    order,
    courier,
    storeId: storeObjId,
    generatedBy: userObjId,
    req,
    session,
  });
}

/**
 * Generate label for CRM scenarios
 */
async function generateCRMLabel(
  params: GenerateLabelParams,
  session: ClientSession
): Promise<GenerateLabelResult> {
  const { crmTicketId, scenario, urgency, customerTier, storeId, generatedBy, courierId, req } = params;

  if (!crmTicketId || !scenario) {
    return { success: false, error: 'CRM ticket ID and scenario are required' };
  }

  const storeObjId = typeof storeId === 'string' ? new mongoose.Types.ObjectId(storeId) : storeId;
  const userObjId = typeof generatedBy === 'string' ? new mongoose.Types.ObjectId(generatedBy) : generatedBy;

  // Check for existing label
  const existingLabel = await ShippingLabel.findOne({
    crmTicketId,
    labelType: 'crm',
    status: 'generated',
  }).session(session);

  if (existingLabel) {
    return { success: false, error: 'Shipping label already exists for this CRM ticket' };
  }

  // Get or map courier
  let courier;
  if (courierId) {
    const { Courier } = await import('../models/Courier');
    courier = await Courier.findById(courierId).session(session);
    if (!courier || !courier.isActive) {
      return { success: false, error: 'Invalid or inactive courier' };
    }
  } else {
    // Map courier for CRM
    // Note: For CRM, we may need destination zone from ticket data
    // This is a simplified version - you may need to fetch ticket data
    const courierMapping = await mapCourierForCRM({
      storeId: storeObjId,
      scenario: scenario!,
      urgency: urgency || 'medium',
      customerTier: customerTier || 'standard',
      priority: 'speed',
    });

    const { Courier } = await import('../models/Courier');
    courier = await Courier.findById(courierMapping.courier._id).session(session);
    if (!courier) {
      return { success: false, error: 'Mapped courier not found' };
    }
  }

  // Generate label
  return await createCRMLabel({
    crmTicketId,
    scenario: scenario!,
    urgency: urgency || 'medium',
    courier,
    storeId: storeObjId,
    generatedBy: userObjId,
    req,
    session,
  });
}

/**
 * Create logistics label
 */
async function createLabel(params: {
  labelType: 'logistics';
  order: IOrder;
  courier: any;
  storeId: mongoose.Types.ObjectId;
  generatedBy: mongoose.Types.ObjectId;
  req?: Request;
  session: ClientSession;
}): Promise<GenerateLabelResult> {
  const { order, courier, storeId, generatedBy, req, session } = params;

  // Generate label number
  const labelNumber = await generateLabelNumber(storeId, 'logistics');

  // Get store and pickup address
  const store = await Store.findById(storeId).session(session);
  if (!store) {
    return { success: false, error: 'Store not found' };
  }

  // Get pickup address
  let pickupAddress = await getPickupAddress(storeId, order, session);

  // Build delivery address
  const deliveryAddress = {
    name: order.customerName || 'Customer',
    street: order.shippingAddress?.street || '',
    city: order.shippingAddress?.city || '',
    state: order.shippingAddress?.state || '',
    zip: order.shippingAddress?.zip || '',
    country: order.shippingAddress?.country || '',
    phone: '',
  };

  // Calculate package details
  const orderWeight = order.items.reduce((total, item) => total + (item.quantity * 0.5), 0);
  const packageDetails = {
    weight: orderWeight,
    dimensions: {
      length: 20,
      width: 15,
      height: 10,
    },
  };

  const orderDetails = {
    orderNumber: order.orderNumber || order.orderId,
    orderId: order.orderId,
    itemCount: order.items.length,
    codAmount: order.paymentMethod === 'cod' || order.paymentMethod === 'cod_partial' ? (order.codAmount || order.grandTotal) : null,
    prepaidAmount: order.paymentMethod !== 'cod' ? order.grandTotal : null,
  };

  // Generate PDF
  const pdfUrl = await generateLabelPdf({
    labelNumber,
    labelType: 'logistics',
    courierName: courier.name,
    courierCode: courier.code,
    pickupAddress,
    deliveryAddress,
    packageDetails,
    orderDetails,
    returnDetails: null,
    crmDetails: null,
  });

  // Save label
  const label = new ShippingLabel({
    storeId,
    labelType: 'logistics',
    orderId: order._id,
    courierId: courier._id,
    courierName: courier.name,
    courierCode: courier.code,
    labelNumber,
    awbNumber: null,
    pickupAddress,
    deliveryAddress,
    packageDetails,
    orderDetails,
    returnDetails: null,
    crmDetails: null,
    pdfUrl,
    status: 'generated',
    generatedAt: new Date(),
    generatedBy,
  });

  await label.save({ session });

  // Emit event
  eventStreamEmitter.emit('event', {
    eventType: 'LABEL_GENERATED',
    payload: {
      labelType: 'logistics',
      orderId: order.orderId,
      orderNumber: order.orderNumber,
      labelNumber,
      courierName: courier.name,
    },
    storeId: storeId.toString(),
    userId: generatedBy.toString(),
    occurredAt: new Date(),
  });

  // Audit log
  if (req) {
    await logAudit({
      req,
      action: 'SHIPPING_LABEL_GENERATED',
      entityType: 'ShippingLabel',
      entityId: label._id.toString(),
      description: `Shipping label generated: ${labelNumber} for order ${order.orderNumber}`,
      after: {
        labelType: 'logistics',
        labelNumber,
        orderId: order.orderId,
        orderNumber: order.orderNumber,
        courierName: courier.name,
      },
    });
  }

  return { success: true, label };
}

/**
 * Create returns label
 */
async function createReturnsLabel(params: {
  rma: IRMA;
  order: IOrder;
  courier: any;
  storeId: mongoose.Types.ObjectId;
  generatedBy: mongoose.Types.ObjectId;
  req?: Request;
  session: ClientSession;
}): Promise<GenerateLabelResult> {
  const { rma, order, courier, storeId, generatedBy, req, session } = params;

  // Generate label number
  const labelNumber = await generateLabelNumber(storeId, 'returns');

  // Pickup address (customer address)
  const pickupAddress = {
    name: order.customerName || 'Customer',
    street: order.shippingAddress?.street || '',
    city: order.shippingAddress?.city || '',
    state: order.shippingAddress?.state || '',
    zip: order.shippingAddress?.zip || '',
    country: order.shippingAddress?.country || '',
    phone: '',
  };

  // Delivery address (origin/warehouse)
  const deliveryAddress = await getPickupAddress(storeId, order, session);

  // Package details
  const packageWeight = rma.items.reduce((total, item) => total + (item.quantity * 0.5), 0);
  const packageDetails = {
    weight: packageWeight,
    dimensions: {
      length: 20,
      width: 15,
      height: 10,
    },
  };

  const returnDetails = {
    rmaNumber: rma.rmaNumber,
    returnReason: rma.items[0]?.reason,
    itemCondition: rma.items[0]?.condition,
    itemCount: rma.items.reduce((total, item) => total + item.quantity, 0),
  };

  // Generate PDF
  const pdfUrl = await generateLabelPdf({
    labelNumber,
    labelType: 'returns',
    courierName: courier.name,
    courierCode: courier.code,
    pickupAddress,
    deliveryAddress,
    packageDetails,
    orderDetails: null,
    returnDetails,
    crmDetails: null,
  });

  // Save label
  const label = new ShippingLabel({
    storeId,
    labelType: 'returns',
    rmaId: rma._id,
    courierId: courier._id,
    courierName: courier.name,
    courierCode: courier.code,
    labelNumber,
    awbNumber: null,
    pickupAddress,
    deliveryAddress,
    packageDetails,
    orderDetails: null,
    returnDetails,
    crmDetails: null,
    pdfUrl,
    status: 'generated',
    generatedAt: new Date(),
    generatedBy,
  });

  await label.save({ session });

  // Emit event
  eventStreamEmitter.emit('event', {
    eventType: 'LABEL_GENERATED',
    payload: {
      labelType: 'returns',
      rmaId: rma.rmaNumber,
      labelNumber,
      courierName: courier.name,
    },
    storeId: storeId.toString(),
    userId: generatedBy.toString(),
    occurredAt: new Date(),
  });

  // Audit log
  if (req) {
    await logAudit({
      req,
      action: 'SHIPPING_LABEL_GENERATED',
      entityType: 'ShippingLabel',
      entityId: label._id.toString(),
      description: `Returns label generated: ${labelNumber} for RMA ${rma.rmaNumber}`,
      after: {
        labelType: 'returns',
        labelNumber,
        rmaNumber: rma.rmaNumber,
        courierName: courier.name,
      },
    });
  }

  return { success: true, label };
}

/**
 * Create CRM label
 */
async function createCRMLabel(params: {
  crmTicketId: string;
  scenario: 'support_ticket' | 'document_delivery' | 'replacement' | 'warranty';
  urgency: 'low' | 'medium' | 'high' | 'critical';
  courier: any;
  storeId: mongoose.Types.ObjectId;
  generatedBy: mongoose.Types.ObjectId;
  req?: Request;
  session: ClientSession;
}): Promise<GenerateLabelResult> {
  const { crmTicketId, scenario, urgency, courier, storeId, generatedBy, req, session } = params;

  // Generate label number
  const labelNumber = await generateLabelNumber(storeId, 'crm');

  // For CRM, addresses would come from ticket data
  // This is a simplified version - you may need to fetch ticket data
  const pickupAddress = await getStoreAddress(storeId, session);
  const deliveryAddress = pickupAddress; // Would come from ticket

  const packageDetails = {
    weight: 0.5, // Default for documents/replacements
    dimensions: {
      length: 25,
      width: 20,
      height: 5,
    },
  };

  const crmDetails = {
    ticketId: crmTicketId,
    scenario,
    urgency,
    description: `CRM ${scenario} label`,
  };

  // Generate PDF
  const pdfUrl = await generateLabelPdf({
    labelNumber,
    labelType: 'crm',
    courierName: courier.name,
    courierCode: courier.code,
    pickupAddress,
    deliveryAddress,
    packageDetails,
    orderDetails: null,
    returnDetails: null,
    crmDetails,
  });

  // Save label
  const label = new ShippingLabel({
    storeId,
    labelType: 'crm',
    crmTicketId,
    courierId: courier._id,
    courierName: courier.name,
    courierCode: courier.code,
    labelNumber,
    awbNumber: null,
    pickupAddress,
    deliveryAddress,
    packageDetails,
    orderDetails: null,
    returnDetails: null,
    crmDetails,
    pdfUrl,
    status: 'generated',
    generatedAt: new Date(),
    generatedBy,
  });

  await label.save({ session });

  // Emit event
  eventStreamEmitter.emit('event', {
    eventType: 'LABEL_GENERATED',
    payload: {
      labelType: 'crm',
      crmTicketId,
      labelNumber,
      courierName: courier.name,
    },
    storeId: storeId.toString(),
    userId: generatedBy.toString(),
    occurredAt: new Date(),
  });

  // Audit log
  if (req) {
    await logAudit({
      req,
      action: 'SHIPPING_LABEL_GENERATED',
      entityType: 'ShippingLabel',
      entityId: label._id.toString(),
      description: `CRM label generated: ${labelNumber} for ticket ${crmTicketId}`,
      after: {
        labelType: 'crm',
        labelNumber,
        crmTicketId,
        scenario,
        courierName: courier.name,
      },
    });
  }

  return { success: true, label };
}

/**
 * Get pickup address from store/supplier
 */
async function getPickupAddress(
  storeId: mongoose.Types.ObjectId,
  order: IOrder,
  session: ClientSession
): Promise<{
  name: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  phone: string;
}> {
  // Try store tax profile
  const storeTaxProfile = await TaxProfile.findOne({
    storeId,
    entityType: 'store',
    entityId: storeId.toString(),
    isActive: true,
  }).session(session);

  if (storeTaxProfile?.businessAddress) {
    const addr = storeTaxProfile.businessAddress;
    return {
      name: storeTaxProfile.businessName || 'Store',
      street: addr.street || '',
      city: addr.city || '',
      state: addr.state || '',
      zip: addr.zip || '',
      country: addr.country || 'India',
      phone: '',
    };
  }

  // Try supplier origin from fulfillment snapshot
  const firstFulfillmentItem = order.fulfillmentSnapshot?.items?.[0];
  if (firstFulfillmentItem?.originId) {
    const origin = await SupplierOrigin.findById(firstFulfillmentItem.originId).session(session);
    if (origin && origin.address) {
      return {
        name: origin.name,
        street: origin.address.street || '',
        city: origin.address.city || '',
        state: origin.address.state || '',
        zip: origin.address.pincode || '',
        country: origin.address.country || 'India',
        phone: '',
      };
    }
  }

  // Default
  return {
    name: 'Store',
    street: 'Store Address',
    city: 'Mumbai',
    state: 'Maharashtra',
    zip: '400001',
    country: 'India',
    phone: '',
  };
}

/**
 * Get store address
 */
async function getStoreAddress(
  storeId: mongoose.Types.ObjectId,
  session: ClientSession
): Promise<{
  name: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  phone: string;
}> {
  const storeTaxProfile = await TaxProfile.findOne({
    storeId,
    entityType: 'store',
    entityId: storeId.toString(),
    isActive: true,
  }).session(session);

  if (storeTaxProfile?.businessAddress) {
    const addr = storeTaxProfile.businessAddress;
    return {
      name: storeTaxProfile.businessName || 'Store',
      street: addr.street || '',
      city: addr.city || '',
      state: addr.state || '',
      zip: addr.zip || '',
      country: addr.country || 'India',
      phone: '',
    };
  }

  return {
    name: 'Store',
    street: 'Store Address',
    city: 'Mumbai',
    state: 'Maharashtra',
    zip: '400001',
    country: 'India',
    phone: '',
  };
}

/**
 * Generate label PDF
 */
async function generateLabelPdf(params: {
  labelNumber: string;
  labelType: LabelType;
  courierName: string;
  courierCode: string;
  pickupAddress: any;
  deliveryAddress: any;
  packageDetails: any;
  orderDetails: any;
  returnDetails: any;
  crmDetails: any;
}): Promise<string> {
  const { labelNumber, labelType, courierName, courierCode, pickupAddress, deliveryAddress, packageDetails, orderDetails, returnDetails, crmDetails } = params;

  const tempDir = path.join(process.cwd(), 'temp', 'labels');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const pdfFileName = `${labelNumber}.pdf`;
  const pdfPath = path.join(tempDir, pdfFileName);

  // Build PDF data
  const pdfData: ShippingLabelPdfData = {
    labelNumber,
    orderNumber: orderDetails?.orderNumber || returnDetails?.rmaNumber || crmDetails?.ticketId || labelNumber,
    orderId: orderDetails?.orderId || returnDetails?.rmaNumber || crmDetails?.ticketId || labelNumber,
    courierName,
    courierCode,
    pickupAddress,
    deliveryAddress,
    packageDetails,
    orderDetails: orderDetails || undefined,
    awbNumber: null,
    outputPath: pdfPath,
  };

  await generateShippingLabelPdf(pdfData);

  return `/api/shipping-labels/${labelNumber}/download`;
}

/**
 * Main label generation function
 */
export async function generateLabel(params: GenerateLabelParams): Promise<GenerateLabelResult> {
  const { labelType } = params;

  try {
    return await withTransaction(async (session: ClientSession) => {
      switch (labelType) {
        case 'logistics':
          return await generateLogisticsLabel(params, session);
        case 'returns':
          return await generateReturnsLabel(params, session);
        case 'crm':
          return await generateCRMLabel(params, session);
        default:
          return { success: false, error: `Invalid label type: ${labelType}` };
      }
    });
  } catch (error: any) {
    console.error('[LABEL GENERATION] Error:', error);
    return {
      success: false,
      error: error.message || 'Label generation failed',
    };
  }
}

/**
 * Get label by ID or reference
 */
export async function getLabel(
  labelType: LabelType,
  referenceId: mongoose.Types.ObjectId | string,
  storeId?: mongoose.Types.ObjectId | string
): Promise<IShippingLabel | null> {
  const refObjId = typeof referenceId === 'string' ? new mongoose.Types.ObjectId(referenceId) : referenceId;

  const filter: any = {
    labelType,
    status: 'generated',
  };

  switch (labelType) {
    case 'logistics':
      filter.orderId = refObjId;
      break;
    case 'returns':
      filter.rmaId = refObjId;
      break;
    case 'crm':
      filter.crmTicketId = referenceId.toString();
      break;
  }

  if (storeId) {
    const storeObjId = typeof storeId === 'string' ? new mongoose.Types.ObjectId(storeId) : storeId;
    filter.storeId = storeObjId;
  }

  return await ShippingLabel.findOne(filter).lean();
}

