import mongoose from 'mongoose';

const checklistItemSchema = new mongoose.Schema(
  {
    systemKey: { type: String, default: null },
    title: { type: String, required: true },
    detail: { type: String, default: '' },
    category: {
      type: String,
      enum: ['pricing', 'photos', 'preparation', 'marketing', 'documents', 'custom'],
      default: 'custom',
    },
    priority: {
      type: String,
      enum: ['high', 'medium', 'low'],
      default: 'medium',
    },
    status: {
      type: String,
      enum: ['todo', 'in_progress', 'done'],
      default: 'todo',
    },
    source: {
      type: String,
      enum: ['system', 'user'],
      default: 'system',
    },
    providerCategoryKey: { type: String, default: '' },
    providerCategoryLabel: { type: String, default: '' },
    providerPrompt: { type: String, default: '' },
    readinessImpact: { type: Number, default: 10 },
    note: { type: String, default: '' },
    sortOrder: { type: Number, default: 0 },
    updatedByUser: { type: Boolean, default: false },
    completedAt: { type: Date, default: null },
  },
  {
    _id: true,
    timestamps: true,
  },
);

const checklistSchema = new mongoose.Schema(
  {
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Property',
      required: true,
    },
    items: { type: [checklistItemSchema], default: [] },
  },
  {
    timestamps: true,
    collection: 'propertyChecklists',
  },
);

checklistSchema.index({ propertyId: 1 }, { unique: true });

export const ChecklistModel =
  mongoose.models.PropertyChecklist || mongoose.model('PropertyChecklist', checklistSchema);
