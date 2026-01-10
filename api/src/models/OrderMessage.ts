import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IOrderMessageAttachment {
  url: string;
  filename: string;
  mimeType: string;
  size: number; // in bytes
}

export interface IOrderMessageReadBy {
  role: 'customer' | 'admin' | 'supplier' | 'reseller';
  userId: mongoose.Types.ObjectId | string;
  readAt: Date;
}

export interface IOrderMessage extends Document {
  _id: mongoose.Types.ObjectId;
  threadId: mongoose.Types.ObjectId;
  orderId: mongoose.Types.ObjectId | string;
  storeId: mongoose.Types.ObjectId;
  senderRole: 'customer' | 'admin' | 'supplier' | 'reseller' | 'system';
  senderId?: mongoose.Types.ObjectId | string | null; // null for system messages
  channel: 'in_app' | 'email' | 'whatsapp' | 'sms';
  messageType: 'text' | 'attachment' | 'system_event';
  content: string;
  attachments?: IOrderMessageAttachment[];
  isRead: boolean; // Legacy field for backward compatibility
  readBy: IOrderMessageReadBy[]; // Detailed read receipts
  isInternal: boolean; // If true, only visible to admin (for system notes, fraud flags, etc.)
  createdAt: Date;
  updatedAt: Date;
}

const OrderMessageAttachmentSchema: Schema = new Schema(
  {
    url: {
      type: String,
      required: true,
    },
    filename: {
      type: String,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

const OrderMessageReadBySchema: Schema = new Schema(
  {
    role: {
      type: String,
      enum: ['customer', 'admin', 'supplier', 'reseller'],
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    readAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const OrderMessageSchema: Schema = new Schema(
  {
    threadId: {
      type: Schema.Types.ObjectId,
      ref: 'OrderMessageThread',
      required: [true, 'Thread ID is required'],
      index: true,
    },
    orderId: {
      type: String,
      required: [true, 'Order ID is required'],
      index: true,
    },
    storeId: {
      type: Schema.Types.ObjectId,
      ref: 'Store',
      required: [true, 'Store ID is required'],
      index: true,
    },
    senderRole: {
      type: String,
      enum: ['customer', 'admin', 'supplier', 'reseller', 'system'],
      required: [true, 'Sender role is required'],
      index: true,
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    channel: {
      type: String,
      enum: ['in_app', 'email', 'whatsapp', 'sms'],
      required: [true, 'Channel is required'],
      index: true,
    },
    messageType: {
      type: String,
      enum: ['text', 'attachment', 'system_event'],
      required: [true, 'Message type is required'],
      default: 'text',
    },
    content: {
      type: String,
      required: [true, 'Content is required'],
      trim: true,
    },
    attachments: {
      type: [OrderMessageAttachmentSchema],
      default: [],
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readBy: {
      type: [OrderMessageReadBySchema],
      default: [],
    },
    isInternal: {
      type: Boolean,
      default: false,
      index: true,
      // If true, only visible to admin (for system notes, fraud flags, escalation notes)
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for efficient queries
OrderMessageSchema.index({ threadId: 1, createdAt: 1 }); // Get messages in thread order
OrderMessageSchema.index({ orderId: 1, createdAt: -1 }); // Get messages by order
OrderMessageSchema.index({ storeId: 1, createdAt: -1 }); // Get messages by store
OrderMessageSchema.index({ storeId: 1, isRead: 1, createdAt: -1 }); // Get unread messages by store
OrderMessageSchema.index({ threadId: 1, isRead: 1 }); // Get unread count per thread
OrderMessageSchema.index({ senderRole: 1, createdAt: -1 }); // Get messages by sender role
OrderMessageSchema.index({ channel: 1, createdAt: -1 }); // Get messages by channel
OrderMessageSchema.index({ isInternal: 1 }); // Filter internal messages

// Prevent updates and deletes (messages are immutable)
OrderMessageSchema.pre(['updateOne', 'findOneAndUpdate', 'deleteOne', 'findOneAndDelete'], function () {
  throw new Error('OrderMessage records are immutable and cannot be updated or deleted');
});

export const OrderMessage: Model<IOrderMessage> =
  mongoose.models.OrderMessage || mongoose.model<IOrderMessage>('OrderMessage', OrderMessageSchema);

