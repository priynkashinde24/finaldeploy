import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IStoreTemplateSnapshot extends Document {
  storeId: mongoose.Types.ObjectId;
  templateId: mongoose.Types.ObjectId;
  templateVersion: string;
  appliedConfig: Record<string, any>;
  appliedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const StoreTemplateSnapshotSchema: Schema = new Schema(
  {
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true, index: true },
    templateId: { type: Schema.Types.ObjectId, ref: 'StoreTemplate', required: true, index: true },
    templateVersion: { type: String, required: true },
    appliedConfig: { type: Schema.Types.Mixed, required: true },
    appliedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

StoreTemplateSnapshotSchema.index({ storeId: 1, templateId: 1 }, { unique: true });

export const StoreTemplateSnapshot: Model<IStoreTemplateSnapshot> =
  mongoose.models.StoreTemplateSnapshot ||
  mongoose.model<IStoreTemplateSnapshot>('StoreTemplateSnapshot', StoreTemplateSnapshotSchema);


